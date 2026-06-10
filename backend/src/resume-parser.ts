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
  // fallback by extension
  const name = (originalname ?? "").toLowerCase();
  if (name.endsWith(".pdf"))  return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".doc"))  return "doc";
  return null;
}

function deduplicateExtractedText(text: string): string {
  // Some DOCX files (e.g. two-column layouts, text boxes) cause mammoth to
  // extract content twice. Deduplicate line by line, keeping first occurrence.
  const lines = text.split("\n");
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const key = line.trim().replace(/\s+/g, " ").slice(0, 100);
    if (key.length > 25 && seen.has(key)) continue;
    if (key.length > 25) seen.add(key);
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
  // .doc (legacy binary format) — mammoth doesn't fully support it but try anyway
  if (format === "doc") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value, format };
    } catch {
      throw new Error("Legacy .doc format not supported. Please save as .docx or PDF and re-upload.");
    }
  }
  throw new Error("Unsupported file format");
}

export const ACCEPTED_MIMETYPES = [PDF_MIME, DOCX_MIME, DOC_MIME];
