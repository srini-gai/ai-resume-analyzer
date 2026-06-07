import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import pdf from "pdf-parse";
import { analyzeResume } from "./analyzer.js";

const maxBytes = Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype === "application/pdf")
});

export const app = express();
app.set("trust proxy", 1);
app.use(helmet());
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(",").map(o => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : false }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.post("/api/analyze", upload.single("resume"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "A PDF resume is required." });
    const jobDescription = String(req.body.jobDescription ?? "").trim();
    if (jobDescription.length < 40) return res.status(400).json({ message: "Job description must be at least 40 characters." });
    const parsed = await pdf(req.file.buffer);
    if (!parsed.text.trim()) return res.status(422).json({ message: "No readable text was found in the PDF." });
    return res.json(analyzeResume(parsed.text, jobDescription));
  } catch (error) {
    return next(error);
  }
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ message: `PDF must be smaller than ${process.env.MAX_FILE_SIZE_MB || 5}MB.` });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Unable to analyze the resume. Please try another PDF." });
};
app.use(errorHandler);
