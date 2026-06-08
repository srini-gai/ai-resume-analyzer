// ─── In-place DOCX XML editor ─────────────────────────────────────────────────
// A DOCX file is a ZIP archive. We open it, patch word/document.xml so that
// paragraph text matching original bullets is replaced with rewritten bullets,
// then re-pack the ZIP. All original formatting, tables, fonts, and styles are
// preserved — only <w:t> text content changes.

import JSZip from "jszip";
import type { ResumeSection } from "./ai-rewriter.js";

// ─── XML text helpers ─────────────────────────────────────────────────────────

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function encodeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Collect all visible text from a paragraph XML block
function getParaText(paraXml: string): string {
  const parts: string[] = [];
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paraXml)) !== null) {
    parts.push(decodeXml(m[1] ?? ""));
  }
  return parts.join("");
}

// Normalise for fuzzy comparison
function normText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

// Similarity: 1.0 on prefix hit, word-overlap ratio otherwise
function similarity(paraText: string, bulletText: string): number {
  const pn = normText(paraText);
  const bn = normText(bulletText);
  if (!pn || !bn || pn.length < 8 || bn.length < 8) return 0;

  const pfx = bn.slice(0, 15);
  if (pfx.length >= 10 && pn.startsWith(pfx)) return 1.0;

  const pWords = new Set(pn.split(" ").filter(w => w.length > 3));
  const bWords = bn.split(" ").filter(w => w.length > 3);
  if (!bWords.length) return 0;
  return bWords.filter(w => pWords.has(w)).length / bWords.length;
}

// Replace the text content of all <w:t> in a paragraph:
//   • First <w:t> gets the full rewritten bullet
//   • Subsequent <w:t> elements are emptied (runs and their formatting are kept)
function replaceParagraphText(paraXml: string, rewritten: string): string {
  const encoded = encodeXml(rewritten);
  let first = true;
  return paraXml.replace(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g, (_m, attrs: string) => {
    if (first) {
      first = false;
      const a = attrs.includes("preserve") ? attrs : ` xml:space="preserve"`;
      return `<w:t${a}>${encoded}</w:t>`;
    }
    return `<w:t${attrs}></w:t>`;
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function editDocxInPlace(
  originalBuffer: Buffer,
  sections: ResumeSection[]
): Promise<Buffer> {
  // Build original→rewritten pairs from all bullet sections
  const pairs: Array<{ original: string; rewritten: string }> = [];
  for (const sec of sections) {
    if (!["experience", "projects", "other"].includes(sec.type)) continue;
    for (let i = 0; i < sec.bullets.length; i++) {
      const orig = sec.bullets[i];
      const rew = sec.rewrittenBullets[i];
      if (orig && rew && orig !== rew) pairs.push({ original: orig, rewritten: rew });
    }
  }

  if (pairs.length === 0) return originalBuffer;

  const zip = await JSZip.loadAsync(originalBuffer);
  const entry = zip.file("word/document.xml");
  if (!entry) return originalBuffer;

  let xml = await entry.async("string");
  const used = new Set<number>();

  xml = xml.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, (paraXml) => {
    const text = getParaText(paraXml);
    if (text.trim().length < 8) return paraXml;

    let bestIdx = -1;
    let bestScore = 0.6; // minimum similarity to accept a match

    for (let j = 0; j < pairs.length; j++) {
      if (used.has(j)) continue;
      const p = pairs[j];
      if (!p) continue;
      const score = similarity(text, p.original);
      if (score > bestScore) { bestScore = score; bestIdx = j; }
    }

    if (bestIdx === -1) return paraXml;
    const p = pairs[bestIdx];
    if (!p) return paraXml;
    used.add(bestIdx);
    return replaceParagraphText(paraXml, p.rewritten);
  });

  zip.file("word/document.xml", xml);
  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return Buffer.from(out);
}
