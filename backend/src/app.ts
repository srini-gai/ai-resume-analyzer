import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import cookieParser from "cookie-parser";
import passport from "passport";
import Anthropic from "@anthropic-ai/sdk";
import { analyzeResume, analyzeResumeSync } from "./analyzer.js";
import { rewriteResume } from "./ai-rewriter.js";
import { buildGapAnalysis } from "./gap-analyzer.js";
import { editPdfInPlace } from "./pdf-editor.js";
import { generateOptimizedDocx } from "./docx-generator.js";
import { editDocxInPlace } from "./docx-xml-editor.js";
import { parseResume, detectFormat, ACCEPTED_MIMETYPES } from "./resume-parser.js";
import { generateCoverLetterDocx } from "./cover-letter-generator.js";
import type { OptimizedResume } from "./ai-rewriter.js";
import { requireAuth, authRouter, adminRouter } from "./auth.js";
import { query } from "./db.js";

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
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : false, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "4mb" }));
app.use(passport.initialize());
app.use("/api", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));

// ─── Auth + Admin routes (no auth required) ───────────────────────────────────
app.use("/auth", authRouter);
app.use("/admin", adminRouter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ─── Auth guard on all v2 API routes ─────────────────────────────────────────
app.use("/api/v2", requireAuth);

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
    return res.json(analyzeResumeSync(parsed.text, jobDescription));
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
    const baseResult = await analyzeResume(parsed.text, jobDescription);
    const [optimizedResume, gapAnalysis] = await Promise.all([
      rewriteResume(parsed.text, jobDescription, baseResult),
      Promise.resolve(buildGapAnalysis(parsed.text, jobDescription, baseResult)),
    ]);
    const data = { ...baseResult, optimizedResume, gapAnalysis, inputFormat: parsed.format };

    if (req.authUser?.id) {
      try {
        await query(
          "INSERT INTO analyses (user_id, filename, job_description, result) VALUES ($1, $2, $3, $4)",
          [req.authUser.id, req.file?.originalname ?? null, jobDescription.slice(0, 500), JSON.stringify(data)]
        );
      } catch (dbErr) {
        console.error("Failed to save analysis history:", dbErr);
      }
    }

    return res.json(data);
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
    const baseResult = analyzeResumeSync(parsed.text, jobDescription);
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

// ─── Helper: extract candidate name from raw resume text ─────────────────────
function nameFromResumeText(text: string): string {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (/@|http|\d{3}[-.]?\d{3}|\d{10}/.test(line.toLowerCase())) continue;
    if (line.length > 60 || line.length < 2) continue;
    const words = line.split(/\s+/).filter(w => /^[A-Za-z][a-zA-Z'-]*$/.test(w));
    if (words.length >= 1 && words.length <= 4)
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }
  return (lines[0] ?? "Candidate").slice(0, 50);
}

// ─── Batch Cover Letters ─────────────────────────────────────────────────────
app.post("/api/v2/batch-cover-letters", upload.single("resume"), async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(503).json({ message: "AI features are not configured on this server." });

    let resumeText = "";
    let candidateName = "the candidate";
    if (req.file) {
      const fmt = detectFormat(req.file.mimetype, req.file.originalname);
      if (fmt) {
        try {
          const parsed = await parseResume(req.file.buffer, fmt);
          resumeText = parsed.text;
          candidateName = nameFromResumeText(resumeText);
        } catch { /* continue */ }
      }
    }

    const jobDescription  = String(req.body.jobDescription  ?? "").trim();
    const companiesText   = String(req.body.companiesText   ?? "").trim();

    // Parse "Company - Role" lines (max 10)
    interface CompanyPair { company: string; role: string }
    const companies: CompanyPair[] = companiesText
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .slice(0, 10)
      .map(line => {
        const di = line.indexOf(" - ");
        if (di > 0) return { company: line.slice(0, di).trim(), role: line.slice(di + 3).trim() };
        return { company: line.trim(), role: "the position" };
      })
      .filter(c => c.company.length > 0);

    if (companies.length === 0)
      return res.status(400).json({ message: "Provide at least one company in 'Company - Role' format." });

    const client = new Anthropic();
    const startMs = Date.now();

    interface BatchLetter { company: string; role: string; coverLetter: string; wordCount: number; error?: string }
    const letters: BatchLetter[] = [];

    for (const { company, role } of companies) {
      // 30-second per-letter timeout
      const letterText: string = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 30_000);
        client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system: "You are an expert career coach writing professional cover letters.",
          messages: [{
            role: "user",
            content:
              `Write a professional cover letter for a ${role} position at ${company}.\n` +
              (resumeText ? `\nResume:\n${resumeText.slice(0, 3000)}\n` : "") +
              (jobDescription ? `\nJob Description:\n${jobDescription.slice(0, 800)}\n` : "") +
              `\nRequirements:\n` +
              `- Formal tone, 250-300 words\n` +
              `- Highlight 3 most relevant skills matching the role\n` +
              `- Strong opening hook connecting candidate to ${company}\n` +
              `- Specific achievements from resume with context\n` +
              `- Clear call to action in closing\n` +
              `- Do NOT invent facts not in the resume\n` +
              `- Return plain text only, no markdown`,
          }],
        }).then(msg => {
          clearTimeout(timer);
          resolve((msg.content[0] as { type: string; text?: string })?.text?.trim() ?? "");
        }, err => { clearTimeout(timer); reject(err); });
      }).catch(e => {
        return e instanceof Error && e.message === "timeout"
          ? `[Cover letter for ${company} timed out after 30 seconds. Please try again.]`
          : "";
      });

      const wordCount = letterText ? letterText.split(/\s+/).filter(Boolean).length : 0;
      letters.push({ company, role, coverLetter: letterText, wordCount });
    }

    const elapsed = Math.round((Date.now() - startMs) / 1000);
    return res.json({ letters, elapsed, candidateName });
  } catch (error) { return next(error); }
});

// ─── Cover Letter: generate using Claude ─────────────────────────────────────
app.post("/api/v2/cover-letter", upload.single("resume"), async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(503).json({ message: "AI features are not configured on this server." });

    let resumeText = "";
    let candidateName = "the candidate";

    if (req.file) {
      const fmt = detectFormat(req.file.mimetype, req.file.originalname);
      if (fmt) {
        try {
          const parsed = await parseResume(req.file.buffer, fmt);
          resumeText = parsed.text;
          candidateName = nameFromResumeText(resumeText);
        } catch { /* continue without resume */ }
      }
    }

    const companyName    = String(req.body.companyName    ?? "").trim() || "the company";
    const jobRole        = String(req.body.jobRole        ?? "").trim() || "the position";
    const jobDescription = String(req.body.jobDescription ?? "").trim();

    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: "You are an expert career coach writing professional cover letters.",
      messages: [{
        role: "user",
        content:
          `Write a professional cover letter for a ${jobRole} position at ${companyName}.\n` +
          (resumeText ? `\nResume:\n${resumeText.slice(0, 3000)}\n` : "") +
          (jobDescription ? `\nJob Description:\n${jobDescription.slice(0, 1000)}\n` : "") +
          `\nRequirements:\n` +
          `- Formal professional tone\n` +
          `- Highlight 3 most relevant skills or achievements from the resume that match the role\n` +
          `- Opening paragraph: strong hook connecting the candidate to ${companyName}\n` +
          `- Middle paragraph: specific achievements with context from the resume\n` +
          `- Closing paragraph: clear call to action\n` +
          `- 250-300 words maximum\n` +
          `- Do NOT invent facts, metrics, or experience not present in the resume\n` +
          `- Return plain text only — no markdown, no bullet symbols, no formatting`,
      }],
    });

    const coverLetter = (msg.content[0] as { type: string; text?: string })?.text?.trim() ?? "";
    const wordCount = coverLetter.split(/\s+/).filter(Boolean).length;

    return res.json({ coverLetter, wordCount, candidateName });
  } catch (error) { return next(error); }
});

// ─── Cover Letter: download as DOCX ──────────────────────────────────────────
app.post("/api/v2/cover-letter-docx", async (req, res, next) => {
  try {
    const { coverLetter, candidateName, companyName, jobRole } = req.body as {
      coverLetter?: string; candidateName?: string; companyName?: string; jobRole?: string;
    };
    if (!coverLetter?.trim()) return res.status(400).json({ message: "coverLetter is required." });

    const docxBuffer = await generateCoverLetterDocx({
      coverLetter,
      candidateName: candidateName ?? "Candidate",
      companyName:   companyName   ?? "Company",
      jobRole:       jobRole       ?? "Position",
    });

    const safeName = (candidateName ?? "CoverLetter").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="CoverLetter_${safeName}.docx"`);
    return res.end(docxBuffer);
  } catch (error) { return next(error); }
});

// ─── Interview Prep: generate Q&A using Claude ────────────────────────────────
app.post("/api/v2/interview-prep", upload.single("resume"), async (req, res, next) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(503).json({ message: "AI features are not configured on this server." });

    let resumeText = "";
    if (req.file) {
      const fmt = detectFormat(req.file.mimetype, req.file.originalname);
      if (fmt) {
        try {
          const parsed = await parseResume(req.file.buffer, fmt);
          resumeText = parsed.text.slice(0, 3000);
        } catch { /* continue without resume */ }
      }
    }

    const jobRole        = String(req.body.jobRole        ?? "").trim() || "Software Engineer";
    const jobDescription  = String(req.body.jobDescription  ?? "").trim();
    const interviewType   = String(req.body.interviewType   ?? "Mixed").trim();
    const difficulty      = String(req.body.difficulty      ?? "Intermediate").trim();
    const targetCompany   = String(req.body.targetCompany   ?? "").trim();
    const followUps       = req.body.followUps === "true" || req.body.followUps === true;
    const questionCount   = Math.min(3, Math.max(1, parseInt(String(req.body.questionCount ?? "5")) || 5));

    const DIFF_DESC: Record<string, string> = {
      "Beginner":     "fundamental concepts, definitions, simple scenarios, basic knowledge checks",
      "Intermediate": "real project experience, problem-solving, practical application, trade-off analysis",
      "Advanced":     "system design, architecture decisions, edge cases, deep technical depth, optimisation",
    };
    const COMPANY_STYLE: Record<string, string> = {
      "google":       "Emphasise scalability, data-driven decisions, and Googleyness/culture-fit.",
      "amazon":       "Heavy focus on Leadership Principles — every behavioural answer must tie to a specific LP.",
      "microsoft":    "Growth mindset, collaboration, technical depth in chosen domain.",
      "meta":         "Impact at scale, move fast, data-informed decision making.",
      "apple":        "Attention to detail, user-first thinking, system coherence.",
      "tcs":          "Domain certifications, process adherence, breadth of technical skills.",
      "accenture":    "Client delivery, stakeholder management, cross-functional collaboration.",
      "infosys":      "Domain expertise, continuous learning, delivery excellence.",
      "wipro":        "Technical fundamentals, adaptability, client service orientation.",
      "deloitte":     "Business acumen, consulting skills, risk and compliance awareness.",
      "mckinsey":     "Structured problem-solving, top-down communication, data-driven insights.",
    };
    const companyStyle = COMPANY_STYLE[targetCompany.toLowerCase()] ?? "";
    const diffDesc = DIFF_DESC[difficulty] ?? DIFF_DESC["Intermediate"]!;

    const jsonSchema =
      `[{"question":"...","type":"technical|behavioural","difficulty":"${difficulty}",` +
      `"keyPoints":["..."],"modelAnswer":"...","tip":"..."` +
      (followUps ? `,"followUpQuestions":["follow-up 1","follow-up 2"]` : "") +
      `}]`;

    const promptContent = resumeText
      ? `You are an expert interview coach reviewing this candidate's actual resume for a ${jobRole} position` +
        (targetCompany ? ` at ${targetCompany}` : "") + `.\n\n` +
        `Candidate's Resume:\n${resumeText}\n\n` +
        (jobDescription ? `Job Description: ${jobDescription.slice(0, 1000)}\n` : "") +
        `Difficulty: ${difficulty}\n\n` +
        `Generate exactly ${questionCount} interview questions that reference the candidate's SPECIFIC experience. For example:\n` +
        `- 'You mentioned working on [specific project from resume] — walk me through your approach to...'\n` +
        `- 'Your resume shows [X years/skill from resume] — describe a situation where...'\n\n` +
        `Questions must reference actual companies, roles, projects, technologies from the resume. Do NOT ask generic questions if a resume is provided.\n` +
        (targetCompany && companyStyle ? `Mirror ${targetCompany} interview style: ${companyStyle}\n` : "") +
        (followUps ? `Include 2 follow-up questions per question — make them progressively harder.\n` : "") +
        `\nReturn ONLY a valid JSON array — no markdown, no code fences:\n` +
        jsonSchema
      : `You are an expert ${difficulty} level interview coach${targetCompany ? ` for ${targetCompany} interviews` : ""}.\n\n` +
        `Role: ${jobRole}\n` +
        `Interview type: ${interviewType}\n` +
        `Difficulty: ${difficulty} — ${diffDesc}\n` +
        (targetCompany ? `Target Company: ${targetCompany}${companyStyle ? ` — ${companyStyle}` : ""}\n` : "") +
        (jobDescription ? `Job Description: ${jobDescription.slice(0, 1000)}\n` : "") +
        `\nGenerate exactly ${questionCount} mock interview questions with detailed answers.\n\n` +
        `Rules:\n` +
        `- Technical questions: focus on role-specific skills; at ${difficulty} level\n` +
        `- Behavioural questions: STAR format (Situation, Task, Action, Result)\n` +
        `- Mixed: alternate between technical and behavioural\n` +
        `- Tailor difficulty: ${diffDesc}\n` +
        (targetCompany && companyStyle ? `- Mirror ${targetCompany} interview style: ${companyStyle}\n` : "") +
        (followUps ? `- Include 2 follow-up questions per question — make them progressively harder\n` : "") +
        `\nReturn ONLY a valid JSON array — no markdown, no code fences:\n` +
        jsonSchema;

    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2500,
      messages: [{
        role: "user",
        content: promptContent,
      }],
    });

    const raw = (msg.content[0] as { type: string; text?: string })?.text ?? "[]";
    let questions: unknown[];
    try {
      const m = raw.match(/\[[\s\S]*\]/);
      questions = JSON.parse(m ? m[0] : raw) as unknown[];
    } catch {
      return res.status(500).json({ message: "AI returned an unexpected format. Please try again." });
    }

    return res.json({ questions, jobRole, interviewType, difficulty, targetCompany });
  } catch (error) { return next(error); }
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

// ─── Analysis history ─────────────────────────────────────────────────────────
app.get("/api/v2/history", async (req, res, next) => {
  try {
    if (!req.authUser?.id) return res.json({ analyses: [] });

    const result = await query<{
      id: string;
      filename: string | null;
      created_at: string;
      result: unknown;
    }>(
      `SELECT id, filename, created_at, result
       FROM analyses
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.authUser.id]
    );

    return res.json({ analyses: result.rows });
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
