import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult } from "./analyzer.js";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type LayoutType = "single-column" | "two-column" | "executive";
export type SectionType =
  | "header" | "summary" | "experience" | "skills"
  | "education" | "certifications" | "projects" | "other";

export interface ResumeSection {
  type: SectionType;
  originalTitle: string;
  originalContent: string;
  rewrittenContent: string;
  bullets: string[];
  rewrittenBullets: string[];
}

export interface DetectedLayout {
  type: LayoutType;
  sectionOrder: SectionType[];
  headerStyle: "centered" | "left-aligned" | "inline-contact";
}

export interface OptimizedResume {
  candidateName: string;
  layout: DetectedLayout;
  sections: ResumeSection[];
  summary: string;
  experienceBullets: string[];
  skills: string[];
  fullRewrittenText: string;
}

// ─── PDF artifact cleaner ─────────────────────────────────────────────────────
// pdf-parse sometimes mis-decodes bullet glyphs as a stray char that splits words
// e.g. "VS upervised" → "Supervised", "VIn creased" → "Increased"

function fixPdfArtifact(line: string): string {
  return line.replace(
    /^[A-Za-z]([A-Z][a-z]*)\s+([a-z]\S.*)$/,
    (_m, frag: string, rest: string) => frag + rest
  ).trim();
}

function cleanResumeText(raw: string): string {
  return raw
    .split("\n")
    .map(line => {
      const t = line.trim();
      if (t.length > 4 && !/^[A-Z\s&/:-]{3,60}$/.test(t)) return fixPdfArtifact(t);
      return t;
    })
    .join("\n");
}

// ─── Section heading classifier ───────────────────────────────────────────────
//
// DESIGN PRINCIPLE: match by keyword-contains so lines like
//   "SUMMARY - PROFESSIONAL EXPERIENCE:"
//   "TECHNICAL SKILLS:"
//   "WORK EXPERIENCE & CAREER HISTORY:"
// are all correctly classified.
//
// A heading must:
//   1. Be short (≤ 80 chars)
//   2. Not end with a full stop
//   3. Contain a known section keyword (takes priority) OR be ALL-CAPS
//   4. NOT look like a regular sentence (too many words = sentence)

interface SectionKeyword { keywords: string[]; type: SectionType }

const SECTION_KEYWORDS: SectionKeyword[] = [
  { keywords: ["SUMMARY", "PROFILE", "OBJECTIVE", "ABOUT ME"], type: "summary" },
  { keywords: ["EXPERIENCE", "EMPLOYMENT", "CAREER HISTORY", "WORK HISTORY"], type: "experience" },
  { keywords: ["SKILL", "COMPETENC", "EXPERTISE", "TECHNOLOG"], type: "skills" },
  { keywords: ["EDUCATION", "ACADEMIC", "QUALIFICATION", "SCHOOLING"], type: "education" },
  { keywords: ["CERTIF", "LICEN", "CREDENTIAL", "ACCREDIT"], type: "certifications" },
  { keywords: ["PROJECT"], type: "projects" },
];

function classifyHeading(line: string): SectionType | null {
  const raw = line.trim();
  // Length guard: too short is noise, too long is a sentence
  if (raw.length < 3 || raw.length > 80) return null;
  // Real sentences end with a period — headings don't
  if (raw.endsWith(".")) return null;
  // Strip trailing punctuation to normalise "SKILLS:" → "SKILLS"
  const clean = raw.replace(/[\s:;|\-–—]+$/, "").trim();
  const upper = clean.toUpperCase();
  // Count words — more than 10 = likely a sentence, not a heading
  if (clean.split(/\s+/).length > 10) return null;

  // Priority 1: known keyword match
  for (const { keywords, type } of SECTION_KEYWORDS) {
    for (const kw of keywords) {
      if (upper.startsWith(kw) || upper.includes(` ${kw}`) || upper === kw) {
        return type;
      }
    }
  }

  // Priority 2: ALL-CAPS short line with no digits (subsections like "ECC SECURITY")
  // Return "other" so they become sections in the output (preserves document structure)
  if (/^[A-Z][A-Z\s&/\-–]{2,50}$/.test(clean) && clean.split(/\s+/).length <= 7) {
    return "other";
  }

  return null;
}

// ─── Layout detector ──────────────────────────────────────────────────────────

function detectLayout(resumeText: string): DetectedLayout {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean);
  const head5 = lines.slice(0, 5).join(" ");

  const hasEmail = /[\w.]+@[\w.]+/.test(head5);
  const hasPhone = /\+?\d[\d\s\-()]{7,}/.test(head5);
  const hasPipes = resumeText.includes(" | ") || resumeText.includes(" │ ");
  const shortLineRatio = lines.filter(l => l.length < 35).length / Math.max(lines.length, 1);

  const isExecutive = (hasEmail || hasPhone) && (lines[0] ?? "").split(/\s+/).length <= 5;
  const isTwoCol = hasPipes || shortLineRatio > 0.6;
  const type: LayoutType = isExecutive ? "executive" : isTwoCol ? "two-column" : "single-column";

  const sectionOrder: SectionType[] = ["header"];
  for (const line of lines) {
    const t = classifyHeading(line);
    if (t && t !== "header" && !sectionOrder.includes(t)) sectionOrder.push(t);
  }
  return { type, sectionOrder, headerStyle: isExecutive ? "inline-contact" : "left-aligned" };
}

// ─── Bullet extractor ─────────────────────────────────────────────────────────
//
// Three strategies in order of reliability:
//   1. Explicit bullet chars (•, -, *, ▪ etc)       → PDF-sourced documents
//   2. Lines starting with a capital, ≥ 30 chars     → Word-sourced documents
//   3. Split on newlines as a fallback

function extractBulletsFromContent(lines: string[]): string[] {
  const clean = lines.map(l => l.trim()).filter(Boolean);

  // Strategy 1: explicit markers
  const explicit = clean
    .filter(l => /^[•\-*▪◦➤→·]\s/.test(l) || /^\d+\.\s/.test(l))
    .map(l => l.replace(/^[•\-*▪◦➤→·]\s*|\d+\.\s*/, "").trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit;

  // Strategy 2: Word doc paragraphs (substantial lines, start with capital)
  // Exclude lines that look like section headings
  const paras = clean.filter(
    l => l.length >= 20 && /^[A-Z]/.test(l) && !classifyHeading(l)
  );
  if (paras.length > 0) return paras;

  // Strategy 3: all non-empty lines
  return clean.filter(l => l.length >= 5);
}

function extractSkillsFromContent(lines: string[]): string[] {
  const allText = lines.join(", ");
  const candidates = allText
    .split(/[,|•\n;\/]+/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 60 && !/^\d+$/.test(s));
  return [...new Set(candidates)].filter(Boolean);
}

// ─── Section extractor ────────────────────────────────────────────────────────

function extractSections(resumeText: string): ResumeSection[] {
  const cleaned = cleanResumeText(resumeText);
  const lines = cleaned.split("\n");
  const sections: ResumeSection[] = [];

  // Header = everything before the first classified heading
  let firstSectionIdx = lines.findIndex(l => classifyHeading(l.trim()) !== null);
  if (firstSectionIdx === -1) firstSectionIdx = Math.min(8, lines.length);

  const headerContent = lines.slice(0, firstSectionIdx).join("\n").trim();
  if (headerContent) {
    sections.push({
      type: "header", originalTitle: "HEADER",
      originalContent: headerContent, rewrittenContent: headerContent,
      bullets: [], rewrittenBullets: [],
    });
  }

  let currentType: SectionType = "other";
  let currentTitle = "";
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentTitle && currentLines.length === 0) return;
    const content = currentLines.join("\n").trim();
    const nonEmpty = currentLines.map(l => l.trim()).filter(Boolean);

    const bullets = currentType === "skills"
      ? extractSkillsFromContent(nonEmpty)
      : extractBulletsFromContent(nonEmpty);

    sections.push({
      type: currentType, originalTitle: currentTitle,
      originalContent: content, rewrittenContent: content,
      bullets, rewrittenBullets: [...bullets],
    });
  };

  for (let i = firstSectionIdx; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const heading = classifyHeading(line.trim());
    if (heading !== null) {
      flush();
      currentType = heading;
      currentTitle = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections;
}

// ─── Rule-based content rewriter ─────────────────────────────────────────────

const WEAK_VERBS: Record<string, string> = {
  "did": "Delivered", "was": "Served as", "helped": "Facilitated",
  "worked": "Engineered", "assisted": "Championed", "made": "Built",
  "used": "Leveraged", "got": "Achieved", "ran": "Operated",
  "handled": "Managed", "wrote": "Authored", "fixed": "Resolved",
  "changed": "Transformed", "created": "Developed", "supported": "Accelerated",
  "led": "Spearheaded", "managed": "Orchestrated",
};

function strengthenBullet(b: string, jdKeywords: string[]): string {
  let text = fixPdfArtifact(b.trim());
  for (const [weak, strong] of Object.entries(WEAK_VERBS)) {
    if (new RegExp(`^${weak}\\b`, "i").test(text)) {
      text = text.replace(new RegExp(`^${weak}\\b`, "i"), strong);
      break;
    }
  }
  if (!/\d/.test(text) && text.length > 30 && jdKeywords.length > 0) {
    const kw = jdKeywords[Math.floor(Math.random() * Math.min(5, jdKeywords.length))];
    if (kw) text = `${text}, driving measurable improvement in ${kw}`;
  }
  return text;
}

function rewriteSectionContent(
  section: ResumeSection,
  _jobDescription: string,
  analysis: AnalysisResult,
  jdKeywords: string[]
): ResumeSection {
  if (section.type === "header") return section;

  if (section.type === "summary") {
    const topSkills = analysis.matchedSkills.slice(0, 3).join(", ") || "enterprise technology";
    const missing = analysis.missingSkills.slice(0, 2);
    const rewrittenContent =
      `Accomplished professional with deep expertise in ${topSkills}. ` +
      (missing.length ? `Actively expanding capabilities in ${missing.join(" and ")} to drive end-to-end value. ` : "") +
      `Proven track record of ${jdKeywords.slice(0, 3).join(", ")} in high-growth, collaborative environments, consistently exceeding stakeholder expectations.`;
    return { ...section, rewrittenContent, rewrittenBullets: [] };
  }

  if (section.type === "experience" || section.type === "projects" || section.type === "other") {
    if (section.bullets.length === 0) {
      // No bullets extracted — preserve original, just clean up wording
      return { ...section, rewrittenContent: section.originalContent };
    }
    const rewrittenBullets = section.bullets.map(b => strengthenBullet(b, jdKeywords));
    // Weave in up to 2 missing skills naturally
    analysis.missingSkills.slice(0, 2).forEach((skill, i) => {
      if (rewrittenBullets[i] && !rewrittenBullets[i].toLowerCase().includes(skill.toLowerCase())) {
        rewrittenBullets[i] = `${rewrittenBullets[i].replace(/[,.]?\s*$/, "")}, leveraging ${skill}`;
      }
    });
    const rewrittenContent = rewrittenBullets.map(b => `• ${b}`).join("\n");
    return { ...section, rewrittenContent, rewrittenBullets };
  }

  if (section.type === "skills") {
    const existing = section.bullets.length
      ? section.bullets
      : section.originalContent.split(/[,|•\n;]+/).map(s => s.trim()).filter(Boolean);
    const merged = [...new Set([...existing, ...analysis.matchedSkills, ...analysis.missingSkills.slice(0, 3)])].filter(Boolean);
    return { ...section, rewrittenContent: merged.join(" • "), rewrittenBullets: merged };
  }

  // education, certifications — preserve verbatim
  return { ...section, rewrittenContent: section.originalContent };
}

// ─── Candidate name extractor ─────────────────────────────────────────────────

function extractCandidateName(resumeText: string): string {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const words = first.split(/\s+/).filter(w => /^[A-Z][a-zA-Z'-]{1,}$/.test(w));
  return words.slice(0, 3).join(" ") || first.split(/\s+/).slice(0, 2).join(" ") || "Candidate";
}

// ─── JD keyword extractor ─────────────────────────────────────────────────────

function jdKeywordsFrom(jd: string): string[] {
  const stop = new Set(["the","and","for","with","that","this","have","from","they","will",
    "your","been","more","were","about","their","into","you","are","our","all","has",
    "can","not","but","its","was","also","each","such","both","must","when","than"]);
  return [...new Set(jd.toLowerCase().split(/\W+/).filter(w => w.length > 4 && !stop.has(w)))].slice(0, 10);
}

// ─── Rule-based full rewrite ──────────────────────────────────────────────────

function ruleBasedRewrite(
  resumeText: string,
  jobDescription: string,
  analysis: AnalysisResult
): OptimizedResume {
  const candidateName = extractCandidateName(resumeText);
  const layout = detectLayout(resumeText);
  const rawSections = extractSections(resumeText);
  const jdKeywords = jdKeywordsFrom(jobDescription);

  const sections = rawSections.map(s => rewriteSectionContent(s, jobDescription, analysis, jdKeywords));

  const summarySection = sections.find(s => s.type === "summary");
  const expSection = sections.find(s => s.type === "experience");
  const skillsSection = sections.find(s => s.type === "skills");

  const summary = summarySection?.rewrittenContent ?? "";
  const experienceBullets = expSection?.rewrittenBullets ?? [];
  const skills = skillsSection?.rewrittenBullets.length ? skillsSection.rewrittenBullets : analysis.matchedSkills;
  const fullRewrittenText = sections.map(s =>
    s.type === "header" ? s.originalContent : [s.originalTitle, s.rewrittenContent].join("\n")
  ).join("\n\n");

  return { candidateName, layout, sections, summary, experienceBullets, skills, fullRewrittenText };
}

// ─── AI rewrite (Claude claude-haiku-4-5) ────────────────────────────────────────────────

export async function rewriteResume(
  resumeText: string,
  jobDescription: string,
  analysis: AnalysisResult
): Promise<OptimizedResume> {
  const candidateName = extractCandidateName(resumeText);
  const layout = detectLayout(resumeText);
  const rawSections = extractSections(resumeText);

  if (!process.env.ANTHROPIC_API_KEY) {
    return ruleBasedRewrite(resumeText, jobDescription, analysis);
  }

  const client = new Anthropic();
  const rewritable = rawSections.filter(s => s.type !== "header");

  const sectionJson = rewritable.map(s => ({
    type: s.type,
    title: s.originalTitle,
    content: s.originalContent.slice(0, 600),
    bullets: s.bullets.slice(0, 10),
  }));

  const prompt = `You are an elite executive resume writer. Rewrite each section below to better match the job description.

STRICT RULES:
1. Preserve EXACT section titles and order
2. Keep ALL facts (names, dates, metrics, technologies) — only improve language
3. Replace weak verbs with power verbs (Spearheaded, Orchestrated, Delivered, Drove, Engineered)
4. Inject matched skills naturally: ${analysis.matchedSkills.join(", ")}
5. Weave in missing skills where truthful: ${analysis.missingSkills.slice(0, 4).join(", ")}
6. Add quantified outcomes (%, $, headcount) where plausible
7. Return ONLY valid JSON array — no markdown, no code blocks

Job Description:
${jobDescription.slice(0, 800)}

Sections:
${JSON.stringify(sectionJson, null, 2)}

Return JSON array with ${rewritable.length} objects:
[{"type":"...","title":"...","rewrittenContent":"...","rewrittenBullets":["..."]}]
rewrittenBullets = individual bullet strings (no bullet char) for experience/skills/projects/other, else []`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0] as { type: string; text?: string } | undefined;
    if (!content || content.type !== "text" || !content.text) throw new Error("No text");

    const parsed = JSON.parse(content.text) as Array<{
      type: SectionType; title: string; rewrittenContent: string; rewrittenBullets: string[];
    }>;

    const sections: ResumeSection[] = rawSections.map(orig => {
      if (orig.type === "header") return orig;
      const ai = parsed.find(p => p.type === orig.type && p.title === orig.originalTitle)
        ?? parsed.find(p => p.type === orig.type);
      if (!ai) return orig;
      return {
        ...orig,
        rewrittenContent: ai.rewrittenContent ?? orig.originalContent,
        rewrittenBullets: ai.rewrittenBullets?.length ? ai.rewrittenBullets : orig.bullets,
      };
    });

    const summarySection = sections.find(s => s.type === "summary");
    const expSection = sections.find(s => s.type === "experience");
    const skillsSection = sections.find(s => s.type === "skills");

    const summary = summarySection?.rewrittenContent ?? "";
    const experienceBullets = expSection?.rewrittenBullets ?? [];
    const skills = skillsSection?.rewrittenBullets.length ? skillsSection.rewrittenBullets : analysis.matchedSkills;
    const fullRewrittenText = sections.map(s =>
      s.type === "header" ? s.originalContent : [s.originalTitle, s.rewrittenContent].join("\n")
    ).join("\n\n");

    return { candidateName, layout, sections, summary, experienceBullets, skills, fullRewrittenText };
  } catch {
    return ruleBasedRewrite(resumeText, jobDescription, analysis);
  }
}
