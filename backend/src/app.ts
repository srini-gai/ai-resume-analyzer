import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { analyzeResume } from "./analyzer.js";
import { rewriteResume } from "./ai-rewriter.js";
import { buildGapAnalysis } from "./gap-analyzer.js";
import { editPdfInPlace } from "./pdf-editor.js";
import { generateOptimizedDocx } from "./docx-generator.js";
import { editDocxInPlace } from "./docx-xml-editor.js";
import { parseResume, detectFormat, ACCEPTED_MIMETYPES } from "./resume-parser.js";
import type { OptimizedResume } from "./ai-rewriter.js";

const maxBytes = Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes },
  fileFilter: (_req, file, cb) => {
    const accepted = ACCEPTED_MIMETYPES.includes(file.mimetype)
      || /\.(pdf|docx?|DOCX?)$/i.test(file.originalname);
    cb(null, accepted);
  },
});

export const app = express();
app.set("trust proxy", 1);
app.use(helmet());
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(",").map(o => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : false }));
app.use(express.json({ limit: "4mb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ─── Helper: parse uploaded resume (PDF or DOCX) ─────────────────────────────
async function readResumeFromRequest(req: express.Request): Promise<{ text: string; format: "pdf" | "docx" | "doc" } | { error: string; status: number }> {
  if (!req.file) return { error: "A resume file (PDF or Word) is required.", status: 400 };
  const format = detectFormat(req.file.mimetype, req.file.originalname);
  if (!format) return { error: "Unsupported file type. Please upload PDF, DOC, or DOCX.", status: 415 };
  try {
    const parsed = await parseResume(req.file.buffer, format);
    if (!parsed.text.trim()) return { error: "No readable text was found in the file.", status: 422 };
    return { text: parsed.text, format };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to parse file.", status: 422 };
  }
}

// ─── v1: legacy analyze (kept for backward compat) ───────────────────────────
app.post("/api/analyze", upload.single("resume"), async (req, res, next) => {
  try {
    const parsed = await readResumeFromRequest(req);
    if ("error" in parsed) return res.status(parsed.status).json({ message: parsed.error });
    const jobDescription = String(req.body.jobDescription ?? "").trim();
    if (jobDescription.length < 40) return res.status(400).json({ message: "Job description must be at least 40 characters." });
    return res.json(analyzeResume(parsed.text, jobDescription));
  } catch (error) {
    return next(error);
  }
});

// ─── v2: full analysis with rewrite + gap ────────────────────────────────────
app.post("/api/v2/analyze", upload.single("resume"), async (req, res, next) => {
  try {
    const parsed = await readResumeFromRequest(req);
    if ("error" in parsed) return res.status(parsed.status).json({ message: parsed.error });
    const jobDescription = String(req.body.jobDescription ?? "").trim();
    if (jobDescription.length < 40) return res.status(400).json({ message: "Job description must be at least 40 characters." });
    const baseResult = analyzeResume(parsed.text, jobDescription);
    const [optimizedResume, gapAnalysis] = await Promise.all([
      rewriteResume(parsed.text, jobDescription, baseResult),
      Promise.resolve(buildGapAnalysis(parsed.text, jobDescription, baseResult)),
    ]);
    return res.json({ ...baseResult, optimizedResume, gapAnalysis, inputFormat: parsed.format });
  } catch (error) {
    return next(error);
  }
});

// ─── v2: optimized PDF download ──────────────────────────────────────────────
// If input is PDF → in-place text replacement, preserving original template
// If input is DOCX/DOC → generate a clean PDF from the rewritten content
app.post("/api/v2/optimized-pdf", upload.single("resume"), async (req, res, next) => {
  try {
    const parsed = await readResumeFromRequest(req);
    if ("error" in parsed) return res.status(parsed.status).json({ message: parsed.error });
    const jobDescription = String(req.body.jobDescription ?? "").trim();
    if (jobDescription.length < 40) return res.status(400).json({ message: "Job description must be at least 40 characters." });
    const baseResult = analyzeResume(parsed.text, jobDescription);
    const optimizedResume = await rewriteResume(parsed.text, jobDescription, baseResult);

    let outputBuffer: Buffer;

    if (parsed.format === "pdf" && req.file) {
      // PDF input — edit in place to preserve original template
      outputBuffer = await editPdfInPlace(req.file.buffer, optimizedResume.sections);
    } else {
      // DOCX/DOC input — return 200 with a flag telling frontend to generate client-side
      // (frontend uses react-pdf to render from optimizedResume JSON)
      return res.status(200).json({
        useClientSide: true,
        optimizedResume,
        message: "For Word uploads, the PDF is generated on the client. Use the returned optimizedResume.",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="ResumeIQ_Optimized.pdf"');
    return res.end(outputBuffer);
  } catch (error) {
    return next(error);
  }
});

// ─── v2: in-place DOCX edit — preserves original template (multipart) ────────
// Send: resume file (original DOCX) + optimizedResume (JSON string field)
app.post("/api/v2/optimized-docx-v2", upload.single("resume"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Resume file required." });
    const optimizedResumeStr = req.body.optimizedResume as string | undefined;
    if (!optimizedResumeStr) return res.status(400).json({ message: "optimizedResume field required." });

    const optimizedResume = JSON.parse(optimizedResumeStr) as OptimizedResume;
    const format = detectFormat(req.file.mimetype, req.file.originalname);

    let docxBuffer: Buffer;
    if (format === "docx") {
      try {
        docxBuffer = await editDocxInPlace(req.file.buffer, optimizedResume.sections);
      } catch {
        docxBuffer = await generateOptimizedDocx(optimizedResume);
      }
    } else {
      docxBuffer = await generateOptimizedDocx(optimizedResume);
    }

    const safeName = (optimizedResume.candidateName ?? "Resume").replace(/[^a-zA-Z0-9_-]/g, "_");
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="ResumeIQ_Optimized_${safeName}_${date}.docx"`);
    return res.end(docxBuffer);
  } catch (error) {
    return next(error);
  }
});

// ─── v2: optimized DOCX download (works for any input format) ────────────────
app.post("/api/v2/optimized-docx", async (req, res, next) => {
  try {
    const body = req.body as { optimizedResume?: OptimizedResume };
    if (!body.optimizedResume) return res.status(400).json({ message: "optimizedResume is required." });

    const docxBuffer = await generateOptimizedDocx(body.optimizedResume);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", 'attachment; filename="ResumeIQ_Optimized.docx"');
    return res.end(docxBuffer);
  } catch (error) {
    return next(error);
  }
});

// ─── AI Assist: 3-sentence professional summary ───────────────────────────────
app.post("/api/v2/ai-assist/summary", async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ message: "AI assist is not configured on this server." });
    }
    const { name, currentRole, experience, skills } = req.body as {
      name?: string; currentRole?: string;
      experience?: Array<{ role?: string; company?: string }>;
      skills?: string[];
    };

    const expLine = (experience ?? [])
      .slice(0, 3)
      .map(e => [e.role, e.company].filter(Boolean).join(" at "))
      .filter(Boolean)
      .join("; ");
    const skillLine = (skills ?? []).slice(0, 8).join(", ");

    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      messages: [{
        role: "user",
        content:
          `Write a 3-sentence professional resume summary for ${name || "this candidate"}.\n` +
          `Role: ${currentRole || "professional"}\n` +
          `Recent experience: ${expLine || "various roles"}\n` +
          `Key skills: ${skillLine || "various skills"}\n\n` +
          `RULES:\n` +
          `- Exactly 3 sentences, professional tone\n` +
          `- Do NOT invent metrics, years, or facts not provided\n` +
          `- Start with expertise area or seniority level\n` +
          `- Return ONLY the summary text, no labels or quotes`,
      }],
    });

    const text = (msg.content[0] as { type: string; text?: string })?.text ?? "";
    return res.json({ summary: text.trim() });
  } catch (error) {
    return next(error);
  }
});

// ─── AI Assist: rewrite a single experience bullet ────────────────────────────
app.post("/api/v2/ai-assist/bullet", async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ message: "AI assist is not configured on this server." });
    }
    const { bullet, role, company } = req.body as {
      bullet?: string; role?: string; company?: string;
    };
    if (!bullet?.trim()) return res.status(400).json({ message: "bullet is required." });

    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      messages: [{
        role: "user",
        content:
          `Rewrite this resume bullet point more professionally for a ${role || "professional"} at ${company || "a company"}.\n\n` +
          `Original: "${bullet}"\n\n` +
          `STRICT RULES:\n` +
          `- Keep ALL facts exactly as stated — do NOT invent metrics, tools, or outcomes\n` +
          `- Use a strong action verb at the start (Delivered, Implemented, Spearheaded, etc.)\n` +
          `- Keep it concise — no more than 25 words longer than the original\n` +
          `- Return ONLY the improved bullet text, no quotes or labels`,
      }],
    });

    const text = (msg.content[0] as { type: string; text?: string })?.text ?? "";
    return res.json({ improved: text.trim() || bullet });
  } catch (error) {
    return next(error);
  }
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ message: `File must be smaller than ${process.env.MAX_FILE_SIZE_MB || 5}MB.` });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Unable to process the resume. Please try again." });
};
app.use(errorHandler);
