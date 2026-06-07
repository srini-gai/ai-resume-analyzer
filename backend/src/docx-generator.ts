import * as docxLib from "docx";
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, TabStopType, TabStopPosition,
  Table, TableRow, TableCell, WidthType, HeightRule,
  convertInchesToTwip,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} = docxLib as any;
import type { OptimizedResume, ResumeSection } from "./ai-rewriter.js";

// ─── Design palette (Executive CV) ───────────────────────────────────────────
const C = {
  navy:    "0F2A4D",   // deep navy — header & section titles
  accent:  "B8860B",   // refined gold accent — divider & marks
  body:    "2A2E33",   // body text — near-black slate
  muted:   "6B7280",   // captions, dates
  rule:    "C9A14A",   // gold rule lines
  thinRule:"D8DEE9",   // light divider
};

const FONT = "Calibri";   // clean ATS-safe executive font

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rn(text: string, opts: Record<string, unknown> = {}): unknown {
  return new TextRun({ text, font: FONT, color: C.body, size: 20, ...opts });
}

function divider(color: string = C.rule, size = 12): unknown {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    border: { bottom: { color, size, style: BorderStyle.SINGLE } },
  });
}

function sectionHeading(title: string): unknown {
  return new Paragraph({
    spacing: { before: 280, after: 80 },
    border: { bottom: { color: C.thinRule, size: 6, style: BorderStyle.SINGLE } },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        font: FONT,
        bold: true,
        size: 22,            // 11pt
        color: C.navy,
        characterSpacing: 60,
      }),
    ],
  });
}

function bullet(text: string): unknown {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    indent: { left: convertInchesToTwip(0.28), hanging: convertInchesToTwip(0.18) },
    children: [
      new TextRun({ text: "▪  ", font: FONT, color: C.accent, size: 20, bold: true }),
      rn(text),
    ],
  });
}

function paragraph(text: string): unknown {
  return new Paragraph({
    spacing: { before: 60, after: 100, line: 300 },
    children: [rn(text)],
  });
}

// ─── Tightly-formatted skills table (two cols, no borders) ───────────────────
function skillsTable(skills: string[]): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const cellBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };

  for (let i = 0; i < skills.length; i += 2) {
    const l = skills[i] ?? "";
    const r = skills[i + 1] ?? "";
    rows.push(new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          children: [new Paragraph({
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({ text: "▪  ", font: FONT, color: C.accent, size: 20, bold: true }),
              rn(l),
            ],
          })],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          children: [new Paragraph({
            spacing: { before: 20, after: 20 },
            children: r
              ? [new TextRun({ text: "▪  ", font: FONT, color: C.accent, size: 20, bold: true }), rn(r)]
              : [rn("")],
          })],
        }),
      ],
    }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

// ─── Experience entry detector — splits an experience block into entries ─────
// Heuristic: lines that look like "Role – Company" or "Company | Date" become
// entry headers; subsequent bullets attach to that entry.
interface ExpEntry {
  title: string;
  meta: string;   // optional secondary line
  bullets: string[];
}

function parseExperience(section: ResumeSection): ExpEntry[] {
  // If the section has clean bullets, treat the whole thing as one entry with
  // bullets — we don't have entry boundaries detectable here.
  if (section.rewrittenBullets.length > 0) {
    return [{ title: "", meta: "", bullets: section.rewrittenBullets }];
  }
  // Fallback — split rewrittenContent
  const bullets = section.rewrittenContent
    .split(/\n+/)
    .map(l => l.replace(/^[•▪◦\-*]\s*/, "").trim())
    .filter(Boolean);
  return [{ title: "", meta: "", bullets }];
}

// ─── Render an experience section ────────────────────────────────────────────
function renderExperienceSection(section: ResumeSection): unknown[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [sectionHeading(section.originalTitle)];
  const entries = parseExperience(section);
  for (const e of entries) {
    if (e.title) {
      out.push(new Paragraph({
        spacing: { before: 100, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: e.title, font: FONT, bold: true, size: 22, color: C.navy }),
          new TextRun({ text: `\t${e.meta}`, font: FONT, size: 19, color: C.muted, italics: true }),
        ],
      }));
    }
    for (const b of e.bullets) out.push(bullet(b));
  }
  return out;
}

// ─── Render education / certifications (preserve original line-by-line) ──────
function renderListSection(section: ResumeSection): unknown[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [sectionHeading(section.originalTitle)];
  const lines = section.originalContent.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    out.push(new Paragraph({
      spacing: { before: 60, after: 40 },
      indent: { left: convertInchesToTwip(0.0) },
      children: [
        new TextRun({ text: "▪  ", font: FONT, color: C.accent, size: 20, bold: true }),
        rn(line),
      ],
    }));
  }
  return out;
}

// ─── Render the summary section ──────────────────────────────────────────────
function renderSummary(section: ResumeSection): unknown[] {
  return [
    sectionHeading(section.originalTitle),
    paragraph(section.rewrittenContent || section.originalContent),
  ];
}

// ─── Render skills as a two-column table ─────────────────────────────────────
function renderSkillsSection(section: ResumeSection): unknown[] {
  const skills = section.rewrittenBullets.length
    ? section.rewrittenBullets
    : section.rewrittenContent.split(/[•,|\n]+/).map(s => s.trim()).filter(Boolean);
  if (skills.length === 0) {
    return [sectionHeading(section.originalTitle), paragraph(section.rewrittenContent)];
  }
  return [sectionHeading(section.originalTitle), skillsTable(skills)];
}

// ─── Main generator ──────────────────────────────────────────────────────────

export async function generateOptimizedDocx(resume: OptimizedResume): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  // ── Header block ──────────────────────────────────────────────────────────
  const headerSection = resume.sections.find(s => s.type === "header");
  const headerLines = headerSection
    ? headerSection.originalContent.split("\n").map(l => l.trim()).filter(Boolean)
    : [resume.candidateName];

  const fullName = headerLines[0] ?? resume.candidateName;

  // Try to detect a tagline / title line (second line if it's short and lacks digits/@)
  let taglineIdx = -1;
  if (headerLines[1]
      && headerLines[1].length < 80
      && !/[@\d]/.test(headerLines[1])
      && !/\bemail\b|\bphone\b/i.test(headerLines[1])) {
    taglineIdx = 1;
  }
  const tagline = taglineIdx > 0 ? headerLines[taglineIdx] : "";
  const contactLines = headerLines.slice(1).filter((_, i) => i !== taglineIdx - 1);

  // ── Name (centered, large) ─
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 40 },
    children: [
      new TextRun({
        text: fullName.toUpperCase(),
        font: FONT,
        bold: true,
        size: 44,                  // 22pt
        color: C.navy,
        characterSpacing: 80,
      }),
    ],
  }));

  // ── Tagline / title ─
  if (tagline) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: tagline,
          font: FONT,
          size: 22,                // 11pt
          color: C.accent,
          italics: true,
          characterSpacing: 30,
        }),
      ],
    }));
  }

  // ── Contact line (pipe-separated, centered) ─
  if (contactLines.length > 0) {
    const contactText = contactLines.join("  |  ");
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({ text: contactText, font: FONT, size: 18, color: C.muted }),
      ],
    }));
  }

  // ── Gold divider ─
  children.push(divider(C.rule, 12));

  // ── Body sections ─────────────────────────────────────────────────────────
  const order: ResumeSection["type"][] = [
    "summary", "experience", "projects", "skills",
    "education", "certifications", "other",
  ];

  const bodySections = resume.sections.filter(s => s.type !== "header");
  const orderedSections = [...bodySections].sort((a, b) => {
    const ai = order.indexOf(a.type); const bi = order.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const section of orderedSections) {
    if (section.type === "summary") {
      children.push(...renderSummary(section));
    } else if (section.type === "experience" || section.type === "projects") {
      children.push(...renderExperienceSection(section));
    } else if (section.type === "skills") {
      children.push(...renderSkillsSection(section));
    } else if (section.type === "education" || section.type === "certifications") {
      children.push(...renderListSection(section));
    } else {
      children.push(sectionHeading(section.originalTitle));
      children.push(paragraph(section.rewrittenContent));
    }
  }

  // ── Footer divider + branding ─────────────────────────────────────────────
  children.push(new Paragraph({ spacing: { before: 240 } }));
  children.push(divider(C.thinRule, 4));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40 },
    children: [
      new TextRun({
        text: "Optimized by ResumeIQ  •  resumeanalyzer.pro",
        font: FONT,
        size: 14,
        color: C.muted,
        italics: true,
        characterSpacing: 30,
      }),
    ],
  }));

  const doc = new Document({
    creator: "ResumeIQ",
    title: `${fullName} — Optimized Resume`,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 20, color: C.body },
          paragraph: { spacing: { line: 288 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(0.7),
            bottom: convertInchesToTwip(0.7),
            left:   convertInchesToTwip(0.85),
            right:  convertInchesToTwip(0.85),
          },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
