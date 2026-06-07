import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ResumeSection } from "./ai-rewriter.js";

// Disable workers in Node.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = false;

interface PdfTextItem {
  str: string;
  transform: number[]; // [a, b, c, d, e=x, f=y]
  width: number;
  height: number;
  fontName?: string;
}

interface LineMatch {
  pageIndex: number;
  y: number; // PDF coord (from bottom)
  x: number;
  width: number;
  height: number;
  fontSize: number;
  originalText: string;
  items: PdfTextItem[];
}

// ── Normalization & similarity ───────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^[\s•\-*▪◦➤→·●]+/, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // substring boost
  if (na.length > 10 && nb.includes(na)) return 0.95;
  if (nb.length > 10 && na.includes(nb)) return 0.95;
  // token overlap
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.max(ta.size, tb.size);
}

// ── Extract lines from PDF using pdfjs ───────────────────────────────────────

async function extractLines(buffer: Buffer): Promise<{ lines: LineMatch[]; pageHeights: number[] }> {
  const uint8 = new Uint8Array(buffer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadingTask = (pdfjsLib as any).getDocument({
    data: uint8,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const lines: LineMatch[] = [];
  const pageHeights: number[] = [];

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    pageHeights.push(viewport.height);
    const content = await page.getTextContent();
    const items = (content.items as PdfTextItem[]).filter(it => it && typeof it.str === "string");

    // Group by similar y
    const ty = (it: PdfTextItem) => it.transform[5] ?? 0;
    const tx = (it: PdfTextItem) => it.transform[4] ?? 0;
    const sorted = [...items].sort((a, b) => ty(b) - ty(a));
    const groups: PdfTextItem[][] = [];
    const Y_TOL = 3;
    for (const it of sorted) {
      const y = ty(it);
      const g = groups.find(grp => {
        const first = grp[0];
        return first ? Math.abs(ty(first) - y) <= Y_TOL : false;
      });
      if (g) g.push(it);
      else groups.push([it]);
    }

    for (const g of groups) {
      g.sort((a, b) => tx(a) - tx(b));
      const text = g.map(i => i.str).join("").trim();
      if (!text) continue;
      const first = g[0];
      if (!first) continue;
      const xs = g.map(tx);
      const x = Math.min(...xs);
      const right = Math.max(...g.map(i => tx(i) + i.width));
      const y = ty(first);
      const height = Math.max(...g.map(i => i.height || 10));
      const fontSize = height > 0 ? height : 10;
      lines.push({
        pageIndex,
        y,
        x,
        width: right - x,
        height,
        fontSize,
        originalText: text,
        items: g,
      });
    }
  }

  return { lines, pageHeights };
}

// ── Match bullets to lines & rewrite ─────────────────────────────────────────

export async function editPdfInPlace(
  originalBuffer: Buffer,
  sections: ResumeSection[]
): Promise<Buffer> {
  try {
    const { lines } = await extractLines(originalBuffer);

    // Build list of replacements: original text → rewritten text
    const replacements: Array<{ original: string; rewritten: string }> = [];
    for (const section of sections) {
      if (section.type === "header") continue;
      const origs = section.bullets;
      const news = section.rewrittenBullets;
      const len = Math.min(origs.length, news.length);
      for (let i = 0; i < len; i++) {
        const o = origs[i]?.trim();
        const n = news[i]?.trim();
        if (o && n && o !== n) replacements.push({ original: o, rewritten: n });
      }
    }

    if (replacements.length === 0) return originalBuffer;

    // Match each replacement to best line (consume matched lines)
    const used = new Set<number>();
    const matches: Array<{ line: LineMatch; rewritten: string; continuation?: LineMatch[] }> = [];

    for (const rep of replacements) {
      let bestIdx = -1;
      let bestScore = 0.7; // threshold
      for (let i = 0; i < lines.length; i++) {
        if (used.has(i)) continue;
        const ln = lines[i];
        if (!ln) continue;
        const score = similarity(rep.original, ln.originalText);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) {
        // Try matching by first ~6 words of original (multi-line bullet head)
        const head = normalize(rep.original).split(" ").slice(0, 6).join(" ");
        if (head.length < 8) continue;
        for (let i = 0; i < lines.length; i++) {
          if (used.has(i)) continue;
          const lineItem = lines[i];
          if (!lineItem) continue;
          const ln = normalize(lineItem.originalText);
          if (ln.startsWith(head) || ln.includes(head)) {
            bestIdx = i;
            break;
          }
        }
      }
      if (bestIdx === -1) continue;
      used.add(bestIdx);

      // Detect continuation lines (next line(s) at similar x indent on same page just below)
      const head = lines[bestIdx];
      if (!head) continue;
      const continuation: LineMatch[] = [];
      for (let j = 0; j < lines.length; j++) {
        if (used.has(j)) continue;
        const cand = lines[j];
        if (!cand) continue;
        if (cand.pageIndex !== head.pageIndex) continue;
        if (cand.y >= head.y) continue;
        if (head.y - cand.y > head.fontSize * 2.5) continue;
        if (Math.abs(cand.x - head.x) > 8) continue;
        // Only treat as continuation if the original bullet is long
        if (rep.original.length > 80) {
          continuation.push(cand);
          used.add(j);
          if (continuation.length >= 2) break;
        }
      }

      matches.push({ line: head, rewritten: rep.rewritten, continuation });
    }

    if (matches.length === 0) return originalBuffer;

    // Use pdf-lib to overlay
    const pdfDoc = await PDFDocument.load(originalBuffer);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const textColor = rgb(0.2, 0.225, 0.255);
    const white = rgb(1, 1, 1);

    for (const m of matches) {
      const page = pages[m.line.pageIndex];
      if (!page) continue;
      const { height: pageHeight } = page.getSize();

      // Determine covering rectangle: head + continuations
      const allLines = [m.line, ...(m.continuation ?? [])];
      const minY = Math.min(...allLines.map(l => l.y));
      const maxY = Math.max(...allLines.map(l => l.y + l.height));
      const minX = Math.min(...allLines.map(l => l.x));
      const maxX = Math.max(...allLines.map(l => l.x + l.width));

      // pdfjs y is already bottom-up (matches pdf-lib). Pad a touch.
      const padX = 1;
      const padY = 1;
      const rectX = minX - padX;
      const rectY = minY - padY;
      const rectW = (maxX - minX) + padX * 2;
      const rectH = (maxY - minY) + padY * 2;

      // pdfjs uses top-left origin in viewport, but text transform[5] is from page bottom
      // in PDF native space. pdf-lib coords also from bottom. Safe to use directly.
      // But some pdfjs builds report transform in viewport space; if the rect lands above page,
      // skip. Validate:
      if (rectY < 0 || rectY > pageHeight || rectX < 0) continue;

      page.drawRectangle({ x: rectX, y: rectY, width: rectW, height: rectH, color: white });

      // Draw rewritten text wrapped within rectW
      const fontSize = Math.max(8, Math.min(m.line.fontSize, 11));
      const maxWidth = rectW - 2;
      const text = m.rewritten;

      // Word-wrap
      const words = text.split(/\s+/);
      const wrapped: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        const wWidth = helvetica.widthOfTextAtSize(test, fontSize);
        if (wWidth > maxWidth && cur) {
          wrapped.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) wrapped.push(cur);

      // If wrapped exceeds available vertical space, shrink font
      let drawFontSize = fontSize;
      const lineHeight = drawFontSize * 1.15;
      if (wrapped.length * lineHeight > rectH + 2) {
        const targetLines = Math.max(1, Math.floor(rectH / lineHeight));
        if (wrapped.length > targetLines) {
          drawFontSize = Math.max(7, fontSize * (targetLines / wrapped.length));
        }
      }

      const finalLineHeight = drawFontSize * 1.15;
      // Draw top-down
      let cursorY = rectY + rectH - drawFontSize;
      for (const line of wrapped) {
        if (cursorY < rectY - 1) break;
        page.drawText(line, {
          x: rectX + 1,
          y: cursorY,
          size: drawFontSize,
          font: helvetica,
          color: textColor,
        });
        cursorY -= finalLineHeight;
      }
    }

    const out = await pdfDoc.save();
    return Buffer.from(out);
  } catch (err) {
    console.error("editPdfInPlace failed, returning original:", err);
    return originalBuffer;
  }
}
