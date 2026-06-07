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

export async function parseResume(buffer: Buffer, format: ResumeFormat): Promise<ParsedResume> {
  if (format === "pdf") {
    const parsed = await pdf(buffer);
    return { text: parsed.text, format };
  }
  if (format === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, format };
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
