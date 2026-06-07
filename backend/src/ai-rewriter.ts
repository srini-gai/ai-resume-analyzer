import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult } from "./analyzer.js";

// ─── Shared types (must mirror frontend/src/types.ts) ─────────────────────────

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

// ─── Section heading patterns ─────────────────────────────────────────────────

const SECTION_PATTERNS: Array<{ re: RegExp; type: SectionType }> = [
  { re: /^(PROFESSIONAL\s+)?SUMM?ARY|^PROFILE|^OBJECTIVE|^ABOUT\s+ME/i, type: "summary" },
  { re: /^(PROFESSIONAL|WORK|RELEVANT)?\s*(EXPERIENCE|EMPLOYMENT|HISTORY)/i, type: "experience" },
  { re: /^(TECHNICAL\s+)?SKILLS?|^COMPETENC(Y|IES)|^EXPERTISE|^TECHNOLOGIES/i, type: "skills" },
  { re: /^EDUCATION|^ACADEMIC/i, type: "education" },
  { re: /^CERTIFIC(ATION|ATE)S?|^LICEN[CS]ES?|^CREDENTIALS/i, type: "certifications" },
  { re: /^PROJECTS?|^KEY\s+PROJECTS?|^PERSONAL\s+PROJECTS?/i, type: "projects" },
];

function classifyHeading(line: string): SectionType | null {
  const trimmed = line.trim();
  for (const { re, type } of SECTION_PATTERNS) {
    if (re.test(trimmed)) return type;
  }
  // heuristic: ALL-CAPS short line = section heading
  if (/^[A-Z][A-Z\s&/]{2,30}$/.test(trimmed) && trimmed.split(/\s+/).length <= 5) {
    return "other";
  }
  return null;
}

// ─── Layout detector ──────────────────────────────────────────────────────────

function detectLayout(resumeText: string): DetectedLayout {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean);
  const header = lines.slice(0, 6).join(" ");

  // inline-contact: name + email/phone on first 1-2 lines
  const hasInlineContact = /[\w.]+@[\w.]+|(\+?\d[\d\s\-()]{7,})/.test(lines.slice(0, 3).join(" "));

  // two-column heuristic: pipe separators OR many short entries side by side
  const hasPipes = resumeText.includes(" | ") || resumeText.includes(" │ ");
  const shortLineRatio = lines.filter(l => l.length < 30).length / Math.max(lines.length, 1);

  // executive: prominent header with name large + contact inline
  const firstLineWords = (lines[0] ?? "").split(/\s+/).length;
  const isExecutive = hasInlineContact && firstLineWords <= 4 && header.length < 120;

  const isTwoCol = hasPipes || (shortLineRatio > 0.55 && hasInlineContact);

  const type: LayoutType = isExecutive ? "executive" : isTwoCol ? "two-column" : "single-column";
  const headerStyle = isExecutive ? "inline-contact" : "left-aligned";

  // Collect section order by scanning headings
  const sectionOrder: SectionType[] = ["header"];
  for (const line of lines) {
    const t = classifyHeading(line);
    if (t && t !== "header" && !sectionOrder.includes(t)) sectionOrder.push(t);
  }

  return { type, sectionOrder, headerStyle };
}

// ─── Section extractor ────────────────────────────────────────────────────────

function extractSections(resumeText: string): ResumeSection[] {
  const lines = resumeText.split("\n");
  const sections: ResumeSection[] = [];

  // First, identify header (everything before first known section heading)
  let firstSectionIdx = lines.findIndex(l => classifyHeading(l.trim()) !== null && classifyHeading(l.trim()) !== "header");
  if (firstSectionIdx === -1) firstSectionIdx = Math.min(5, lines.length);

  const headerContent = lines.slice(0, firstSectionIdx).join("\n").trim();
  if (headerContent) {
    sections.push({
      type: "header",
      originalTitle: "HEADER",
      originalContent: headerContent,
      rewrittenContent: headerContent, // header (name/contact) is never rewritten
      bullets: [],
      rewrittenBullets: [],
    });
  }

  // Walk remaining lines and split by headings
  let currentType: SectionType = "other";
  let currentTitle = "";
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentTitle && currentLines.length === 0) return;
    const content = currentLines.join("\n").trim();
    const bullets = currentLines
      .map(l => l.trim())
      .filter(l => l.startsWith("•") || l.startsWith("-") || l.startsWith("*") || /^\d+\./.test(l))
      .map(l => l.replace(/^[•\-*]\s*|\d+\.\s*/, "").trim())
      .filter(Boolean);
    sections.push({
      type: currentType,
      originalTitle: currentTitle,
      originalContent: content,
      rewrittenContent: content,       // filled later
      bullets,
      rewrittenBullets: [...bullets],  // filled later
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
  "worked": "Engineered", "assisted": "Supported", "made": "Built",
  "used": "Utilized", "got": "Achieved", "ran": "Operated",
  "handled": "Managed", "wrote": "Authored", "fixed": "Resolved",
  "changed": "Transformed", "created": "Developed",
};

function strengthenBullet(bullet: string, jdKeywords: string[]): string {
  let text = bullet.trim();
  // Replace weak opening verb
  for (const [weak, strong] of Object.entries(WEAK_VERBS)) {
    const re = new RegExp(`^${weak}\\b`, "i");
    if (re.test(text)) { text = text.replace(re, strong); break; }
  }
  // Add quantification hint if none present
  if (!/\d/.test(text) && text.length > 20) {
    const metric = jdKeywords[Math.floor(Math.random() * jdKeywords.length)];
    if (metric) text = `${text}, improving ${metric} outcomes`;
  }
  return text;
}

function rewriteSectionContent(
  section: ResumeSection,
  jobDescription: string,
  analysis: AnalysisResult,
  jdKeywords: string[]
): ResumeSection {
  if (section.type === "header") return section; // never touch contact info

  if (section.type === "summary") {
    const topSkills = analysis.matchedSkills.slice(0, 3).join(", ") || "relevant technologies";
    const missing = analysis.missingSkills.slice(0, 2).join(" and ");
    const rewrittenContent =
      `Results-driven professional with hands-on expertise in ${topSkills}. ` +
      (missing ? `Actively expanding proficiency in ${missing} to deliver full-stack value. ` : "") +
      `Proven ability to ${jdKeywords.slice(0, 3).join(", ")} within fast-paced, collaborative environments.`;
    return { ...section, rewrittenContent, rewrittenBullets: [] };
  }

  if (section.type === "experience" || section.type === "projects") {
    const rewrittenBullets = section.bullets.map(b => strengthenBullet(b, jdKeywords));
    // Inject up to 2 missing skills
    analysis.missingSkills.slice(0, 2).forEach((skill, i) => {
      if (rewrittenBullets[i]) {
        rewrittenBullets[i] = rewrittenBullets[i].replace(/,$/, "") + `, leveraging ${skill}`;
      }
    });
    const rewrittenContent = rewrittenBullets.map(b => `• ${b}`).join("\n");
    return { ...section, rewrittenContent, rewrittenBullets };
  }

  if (section.type === "skills") {
    const jdSkills = analysis.matchedSkills.concat(analysis.missingSkills.slice(0, 3));
    const existing = section.originalContent.split(/[,\n•\-]+/).map(s => s.trim()).filter(Boolean);
    const merged = [...new Set([...existing, ...jdSkills])];
    const rewrittenContent = merged.join(" • ");
    return { ...section, rewrittenContent, rewrittenBullets: merged };
  }

  // education, certifications, other — keep original
  return section;
}

// ─── Extract candidate name ───────────────────────────────────────────────────

function extractCandidateName(resumeText: string): string {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  // Name is usually capitalised words only, no digits/special chars
  const words = first.split(/\s+/).filter(w => /^[A-Z][a-zA-Z'-]{1,}$/.test(w));
  return words.slice(0, 3).join(" ") || first.split(/\s+/).slice(0, 2).join(" ") || "Candidate";
}

// ─── JD keyword extractor ─────────────────────────────────────────────────────

function jdKeywordsFrom(jd: string): string[] {
  const stop = new Set(["the","and","for","with","that","this","have","from","they","will","your",
    "been","more","were","about","their","into","you","are","our","all","has","can","not","but"]);
  return [...new Set(
    jd.toLowerCase().split(/\W+/).filter(w => w.length > 4 && !stop.has(w))
  )].slice(0, 10);
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
  const skills = skillsSection?.rewrittenBullets.length
    ? skillsSection.rewrittenBullets
    : analysis.matchedSkills;

  const fullRewrittenText = sections.map(s =>
    s.type === "header" ? s.originalContent : [s.originalTitle, s.rewrittenContent].join("\n")
  ).join("\n\n");

  return { candidateName, layout, sections, summary, experienceBullets, skills, fullRewrittenText };
}

// ─── AI rewrite (Claude) ──────────────────────────────────────────────────────

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

  // Build section list for prompt (skip header — never rewrite contact info)
  const rewritableSections = rawSections.filter(s => s.type !== "header");
  const sectionJson = rewritableSections.map(s => ({
    type: s.type,
    title: s.originalTitle,
    content: s.originalContent.slice(0, 600),
  }));

  const prompt = `You are an expert resume writer. Rewrite each resume section below to better match the job description.

RULES:
1. Preserve the EXACT section structure and section titles
2. Keep all factual information (company names, dates, degrees) — only rewrite the language
3. Replace weak verbs with strong action verbs (Built, Led, Delivered, Drove, Engineered)
4. Naturally inject these JD-matched skills where truthful: ${analysis.matchedSkills.join(", ")}
5. Add quantified outcomes where plausible (%, $, users, time saved)
6. For skills sections: merge existing skills + these missing skills: ${analysis.missingSkills.slice(0, 4).join(", ")}
7. Return ONLY valid JSON — no markdown, no code fences

Job Description (excerpt):
${jobDescription.slice(0, 800)}

Resume sections to rewrite:
${JSON.stringify(sectionJson, null, 2)}

Return JSON array with the SAME number of objects, each having:
{ "type": "same as input", "title": "same as input", "rewrittenContent": "improved content", "rewrittenBullets": ["bullet 1", "bullet 2"] }

rewrittenBullets should be individual bullet strings (without bullet character) for experience/projects/skills, or empty array for summary/education/header.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0] as { type: string; text?: string } | undefined;
    if (!content || content.type !== "text" || !content.text) throw new Error("No text response");

    const parsed = JSON.parse(content.text) as Array<{
      type: SectionType; title: string; rewrittenContent: string; rewrittenBullets: string[];
    }>;

    // Merge AI rewrites back into the section objects
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
    const skills = skillsSection?.rewrittenBullets.length
      ? skillsSection.rewrittenBullets
      : analysis.matchedSkills;

    const fullRewrittenText = sections.map(s =>
      s.type === "header" ? s.originalContent : [s.originalTitle, s.rewrittenContent].join("\n")
    ).join("\n\n");

    return { candidateName, layout, sections, summary, experienceBullets, skills, fullRewrittenText };

  } catch {
    return ruleBasedRewrite(resumeText, jobDescription, analysis);
  }
}
