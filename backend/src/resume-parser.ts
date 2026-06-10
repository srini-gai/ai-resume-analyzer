import pdf from "pdf-parse";
import mammoth from "mammoth";

export type ResumeFormat = "pdf" | "docx" | "doc";

export interface ParsedResume {
  text: string;
  format: ResumeFormat;
}

const PDF_MIME  = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME  = "application/msword";

export function detectFormat(mimetype: string, originalname?: string): ResumeFormat | null {
  if (mimetype === PDF_MIME) return "pdf";
  if (mimetype === DOCX_MIME) return "docx";
  if (mimetype === DOC_MIME)  return "doc";
  const name = (originalname ?? "").toLowerCase();
  if (name.endsWith(".pdf"))  return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".doc"))  return "doc";
  return null;
}

function deduplicateExtractedText(text: string): string {
  // Strategy 1: detect two-column table layout where mammoth reads both columns
  // Compare first 20% of text against the 40-60% range — if highly similar, truncate at midpoint
  const len = text.length;
  if (len > 500) {
    const probe = text.slice(0, Math.floor(len * 0.2))
      .replace(/\s+/g, " ").trim().slice(0, 150);
    const middle = text.slice(Math.floor(len * 0.4), Math.floor(len * 0.6))
      .replace(/\s+/g, " ").trim();
    // Check if first 80 chars of probe appear in the middle section
    if (probe.length > 50 && middle.includes(probe.slice(0, 60))) {
      return text.slice(0, Math.floor(len / 2)).trim();
    }
  }

  // Strategy 2: line-by-line dedup for exact duplicate lines
  const lines = text.split("\n");
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const key = line.trim().replace(/\s+/g, " ").slice(0, 100);
    if (key.length > 30 && seen.has(key)) continue;
    if (key.length > 30) seen.add(key);
    unique.push(line);
  }
  return unique.join("\n");
}

export async function parseResume(buffer: Buffer, format: ResumeFormat): Promise<ParsedResume> {
  if (format === "pdf") {
    const parsed = await pdf(buffer);
    return { text: parsed.text, format };
  }
  if (format === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { text: deduplicateExtractedText(result.value), format };
  }
  if (format === "doc") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return { text: deduplicateExtractedText(result.value), format };
    } catch {
      throw new Error("Legacy .doc format not supported. Please save as .docx or PDF and re-upload.");
    }
  }
  throw new Error("Unsupported file format");
}

export const ACCEPTED_MIMETYPES = [PDF_MIME, DOCX_MIME, DOC_MIME];
