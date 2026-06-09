import * as docxLib from "docx";
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, convertInchesToTwip,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} = docxLib as any;

export interface CoverLetterDocxInput {
  candidateName: string;
  companyName: string;
  jobRole: string;
  coverLetter: string;
}

const FONT = "Calibri";
const BODY_COLOR = "2A2E33";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function run(text: string, opts: Record<string, unknown> = {}): any {
  return new TextRun({ text, font: FONT, size: 22, color: BODY_COLOR, ...opts });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function para(runs: unknown[], opts: Record<string, unknown> = {}): any {
  return new Paragraph({
    spacing: { line: 310, before: 0, after: 180 },
    ...opts,
    children: runs,
  });
}

export async function generateCoverLetterDocx(data: CoverLetterDocxInput): Promise<Buffer> {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Split the letter text into paragraphs (double-newline separated)
  const paragraphs = data.coverLetter
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [
    // Candidate name block
    para([run(data.candidateName, { bold: true, size: 26, color: "0F2A4D" })], { spacing: { after: 80 } }),

    // Date
    para([run(date, { color: "64748B" })], { spacing: { before: 200, after: 80 } }),

    // Company + role
    para([run(data.companyName, { bold: true })], { spacing: { before: 200, after: 40 } }),
    para([run(`Re: Application for ${data.jobRole}`, { bold: true, color: "4338CA" })], { spacing: { after: 280 } }),

    // Salutation
    para([run("Dear Hiring Manager,")]),

    // Letter paragraphs
    ...paragraphs.map(p => para([run(p)], { spacing: { before: 160, after: 0 } })),

    // Closing
    para([run("Sincerely,")], { spacing: { before: 360, after: 80 } }),
    para([run(data.candidateName, { bold: true })]),
  ];

  const doc = new Document({
    creator: "ResumeIQ",
    title: `Cover Letter — ${data.candidateName}`,
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1.0),
            bottom: convertInchesToTwip(1.0),
            left:   convertInchesToTwip(1.15),
            right:  convertInchesToTwip(1.15),
          },
        },
      },
      children,
    }],
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22, color: BODY_COLOR },
          paragraph: { spacing: { line: 310 } },
        },
      },
    },
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
