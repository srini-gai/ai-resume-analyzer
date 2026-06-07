import * as docxLib from "docx";
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, TableRow, TableCell,
  Table, WidthType, convertInchesToTwip,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} = docxLib as any;
import type { OptimizedResume, ResumeSection } from "./ai-rewriter.js";

// ─── Design tokens (match premium feel) ──────────────────────────────────────
const INDIGO   = "4338CA";
const SLATE700 = "334155";
const SLATE500 = "64748B";
const SLATE100 = "F1F5F9";
const WHITE    = "FFFFFF";

// ─── Helper: thin horizontal rule ────────────────────────────────────────────
function sectionRule(): unknown {
  return new Paragraph({
    border: { bottom: { color: "C7D2FE", size: 6, style: BorderStyle.SINGLE } },
    spacing: { before: 0, after: 0 },
  });
}

// ─── Helper: section heading ──────────────────────────────────────────────────
function sectionHeading(title: string): unknown {
  return new Paragraph({
    spacing: { before: 240, after: 60 },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: 20,
        color: INDIGO,
        characterSpacing: 60,
      }),
    ],
    border: { bottom: { color: "C7D2FE", size: 4, style: BorderStyle.SINGLE } },
  });
}

// ─── Helper: bullet paragraph ─────────────────────────────────────────────────
function bulletPara(text: string, isOptimized = false): unknown {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.15) },
    children: [
      new TextRun({ text: "• ", color: isOptimized ? INDIGO : SLATE500, size: 19 }),
      new TextRun({ text, color: SLATE700, size: 19 }),
    ],
  });
}

// ─── Helper: body paragraph ───────────────────────────────────────────────────
function bodyPara(text: string): unknown {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    children: [new TextRun({ text, color: SLATE700, size: 19 })],
  });
}

// ─── Main generator ──────────────────────────────────────────────────────────

export async function generateOptimizedDocx(resume: OptimizedResume): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  // ── Header: Name ──────────────────────────────────────────────────────────
  const headerSection = resume.sections.find(s => s.type === "header");
  const headerLines = headerSection
    ? headerSection.originalContent.split("\n").filter(Boolean)
    : [resume.candidateName];

  const name = headerLines[0] ?? resume.candidateName;
  const contactLines = headerLines.slice(1);

  children.push(
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: name, bold: true, size: 52, color: SLATE700 })],
    })
  );

  if (contactLines.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: contactLines.join("  |  "),
            size: 17,
            color: SLATE500,
          }),
        ],
      })
    );
  }

  children.push(sectionRule());

  // ── Body sections ─────────────────────────────────────────────────────────
  const bodySections = resume.sections.filter(s => s.type !== "header");

  for (const section of bodySections) {
    children.push(sectionHeading(section.originalTitle));

    const hasBullets = section.rewrittenBullets.length > 0;

    if (hasBullets) {
      for (const bullet of section.rewrittenBullets) {
        children.push(bulletPara(bullet, true));
      }
    } else if (section.type === "skills") {
      // Skills: comma-separated on one line, or as pills
      const skills = section.rewrittenBullets.length
        ? section.rewrittenBullets
        : section.rewrittenContent.split(/[•,\n]+/).map(s => s.trim()).filter(Boolean);

      // Render in two-column table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [];
      for (let i = 0; i < skills.length; i += 2) {
        rows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                children: [
                  new Paragraph({
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({ text: `• ${skills[i] ?? ""}`, color: SLATE700, size: 18 }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                children: [
                  new Paragraph({
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({ text: skills[i + 1] ? `• ${skills[i + 1]}` : "", color: SLATE700, size: 18 }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );
      }

      if (rows.length > 0) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          })
        );
      }
    } else if (section.type === "education" || section.type === "certifications") {
      // Preserve original line-by-line
      for (const line of section.originalContent.split("\n").filter(Boolean)) {
        children.push(
          new Paragraph({
            spacing: { before: 40, after: 20 },
            children: [new TextRun({ text: line.trim(), color: SLATE700, size: 19 })],
          })
        );
      }
    } else {
      children.push(bodyPara(section.rewrittenContent));
    }
  }

  // ── Footer note ───────────────────────────────────────────────────────────
  children.push(new Paragraph({ spacing: { before: 400 } }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Optimized by ResumeIQ • resumeanalyzer.pro",
          size: 14,
          color: "94A3B8",
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 19, color: SLATE700 },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.8),
            bottom: convertInchesToTwip(0.8),
            left: convertInchesToTwip(0.9),
            right: convertInchesToTwip(0.9),
          },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
