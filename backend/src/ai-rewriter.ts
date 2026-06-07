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

// ─── PDF artifact cleaner ─────────────────────────────────────────────────────
// pdf-parse sometimes mis-decodes special bullet/icon glyphs (▶ ● ✓) as a
// stray uppercase letter (commonly "V", "l", "n") that splits the first word.
// Pattern: "VS upervised" → "Supervised", "VD irected" → "Directed"
//          "VIn creased" → "Increased",  "lD rove" → "Drove"

function fixPdfArtifact(line: string): string {
  // Match: single stray char + capital-start fragment + space + lowercase continuation
  // e.g.  "VS upervised"  →  first="S"   rest="upervised"  →  "Supervised"
  //       "VIn creased"   →  first="In"  rest="creased"    →  "Increased"
  return line.replace(
    /^[A-Za-z]([A-Z][a-z]*)\s+([a-z]\S.*)$/,
    (_match, firstFrag: string, restFrag: string) => firstFrag + restFrag
  ).trim();
}

function cleanResumeText(raw: string): string {
  return raw
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      // Only apply artifact fix to non-heading lines of reasonable length
      if (trimmed.length > 4 && !/^[A-Z\s&/]{3,40}$/.test(trimmed)) {
        return fixPdfArtifact(trimmed);
      }
      return trimmed;
    })
    .join("\n");
}

// ─── Section heading patterns ─────────────────────────────────────────────────

const SECTION_PATTERNS: Array<{ re: RegExp; type: SectionType }> = [
  { re: /^(PROFESSIONAL\s+)?SUMM?ARY$|^PROFILE$|^OBJECTIVE$|^ABOUT\s+ME$/i, type: "summary" },
  { re: /^(PROFESSIONAL|WORK|RELEVANT)?\s*(EXPERIENCE|EMPLOYMENT|HISTORY)$/i, type: "experience" },
  { re: /^(TECHNICAL\s+|CORE\s+)?SKILLS?$|^COMPETENC(Y|IES)$|^EXPERTISE$|^TECHNOLOGIES$/i, type: "skills" },
  { re: /^EDUCATION$|^ACADEMIC\s+BACKGROUND$/i, type: "education" },
  { re: /^CERTIFIC(ATION|ATE)S?$|^LICEN[CS]ES?$|^CREDENTIALS$/i, type: "certifications" },
  { re: /^(KEY\s+|PERSONAL\s+)?PROJECTS?$/i, type: "projects" },
];

function classifyHeading(line: string): SectionType | null {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 50) return null;
  for (const { re, type } of SECTION_PATTERNS) {
    if (re.test(trimmed)) return type;
  }
  // ALL-CAPS short line = likely section heading
  if (/^[A-Z][A-Z\s&/\-]{2,35}$/.test(trimmed) && trimmed.split(/\s+/).length <= 5) {
    return "other";
  }
  return null;
}

// ─── Layout detector ──────────────────────────────────────────────────────────

function detectLayout(resumeText: string): DetectedLayout {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean);

  const hasEmail = /[\w.]+@[\w.]+/.test(lines.slice(0, 5).join(" "));
  const hasPhone = /\+?\d[\d\s\-()]{7,}/.test(lines.slice(0, 5).join(" "));
  const hasPipes = resumeText.includes(" | ") || resumeText.includes(" │ ");
  const shortLineRatio = lines.filter(l => l.length < 35).length / Math.max(lines.length, 1);

  const firstLineWords = (lines[0] ?? "").split(/\s+/).length;
  const isExecutive = (hasEmail || hasPhone) && firstLineWords <= 5;
  const isTwoCol = hasPipes || shortLineRatio > 0.6;

  const type: LayoutType = isExecutive ? "executive" : isTwoCol ? "two-column" : "single-column";

  const sectionOrder: SectionType[] = ["header"];
  for (const line of lines) {
    const t = classifyHeading(line);
    if (t && t !== "header" && !sectionOrder.includes(t)) sectionOrder.push(t);
  }

  return { type, sectionOrder, headerStyle: isExecutive ? "inline-contact" : "left-aligned" };
}

// ─── Section extractor ────────────────────────────────────────────────────────

function extractBulletsFromContent(contentLines: string[]): string[] {
  // Strategy 1: explicit bullet characters
  const explicit = contentLines
    .map(l => l.trim())
    .filter(l => /^[•\-*▪◦➤→]\s/.test(l) || /^\d+\.\s/.test(l))
    .map(l => l.replace(/^[•\-*▪◦➤→]\s*|\d+\.\s*/, "").trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit;

  // Strategy 2: lines that start with a capital letter and are sentence-length
  // (common when pdf-parse strips bullet chars)
  const sentenceLines = contentLines
    .map(l => l.trim())
    .filter(l => l.length > 20 && /^[A-Z]/.test(l) && !classifyHeading(l));
  return sentenceLines;
}

function extractSkillsFromContent(contentLines: string[]): string[] {
  const allText = contentLines.join(" | ");
  // Skills are usually comma-separated, pipe-separated, or newline-separated
  const candidates = allText
    .split(/[,|•\n\/]+/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 40 && !/^\d+$/.test(s));
  return [...new Set(candidates)].filter(Boolean);
}

function extractSections(resumeText: string): ResumeSection[] {
  const cleaned = cleanResumeText(resumeText);
  const lines = cleaned.split("\n");
  const sections: ResumeSection[] = [];

  // Header block: everything before first real section heading
  let firstSectionIdx = lines.findIndex(
    l => classifyHeading(l.trim()) !== null
  );
  if (firstSectionIdx === -1) firstSectionIdx = Math.min(6, lines.length);

  const headerContent = lines.slice(0, firstSectionIdx).join("\n").trim();
  if (headerContent) {
    sections.push({
      type: "header",
      originalTitle: "HEADER",
      originalContent: headerContent,
      rewrittenContent: headerContent,
      bullets: [],
      rewrittenBullets: [],
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
      type: currentType,
      originalTitle: currentTitle,
      originalContent: content,
      rewrittenContent: content,
      bullets,
      rewrittenBullets: [...bullets],
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
};

function strengthenBullet(bullet: string, jdKeywords: string[]): string {
  let text = fixPdfArtifact(bullet.trim()); // clean any remaining artifacts
  // Only replace if the opening verb is genuinely weak
  for (const [weak, strong] of Object.entries(WEAK_VERBS)) {
    const re = new RegExp(`^${weak}\\b`, "i");
    if (re.test(text)) { text = text.replace(re, strong); break; }
  }
  // Add a JD-relevant metric if no number exists
  if (!/\d/.test(text) && text.length > 25 && jdKeywords.length > 0) {
    const kw = jdKeywords[Math.floor(Math.random() * Math.min(jdKeywords.length, 5))] ?? "";
    if (kw) text = `${text}, driving measurable improvement in ${kw}`;
  }
  return text;
}

function rewriteSectionContent(
  section: ResumeSection,
  jobDescription: string,
  analysis: AnalysisResult,
  jdKeywords: string[]
): ResumeSection {
  if (section.type === "header") return section;

  if (section.type === "summary") {
    const topSkills = analysis.matchedSkills.slice(0, 3).join(", ") || "enterprise technology";
    const missing = analysis.missingSkills.slice(0, 2);
    const rewrittenContent =
      `Accomplished professional with deep expertise in ${topSkills}. ` +
      (missing.length ? `Currently expanding capabilities in ${missing.join(" and ")} to drive end-to-end delivery. ` : "") +
      `Track record of ${jdKeywords.slice(0, 3).join(", ")} in high-growth, collaborative environments, consistently exceeding stakeholder expectations.`;
    return { ...section, rewrittenContent, rewrittenBullets: [] };
  }

  if (section.type === "experience" || section.type === "projects") {
    const rewrittenBullets = section.bullets.map(b => strengthenBullet(b, jdKeywords));
    // Weave in missing skills naturally on first 2 bullets
    analysis.missingSkills.slice(0, 2).forEach((skill, i) => {
      if (rewrittenBullets[i] && !rewrittenBullets[i].toLowerCase().includes(skill)) {
        rewrittenBullets[i] = `${rewrittenBullets[i].replace(/\.$/, "")}, utilising ${skill} best practices`;
      }
    });
    const rewrittenContent = rewrittenBullets.map(b => `• ${b}`).join("\n");
    return { ...section, rewrittenContent, rewrittenBullets };
  }

  if (section.type === "skills") {
    const existing = section.bullets.length ? section.bullets : section.originalContent.split(/[,|•\n]+/).map(s => s.trim()).filter(Boolean);
    const merged = [...new Set([...existing, ...analysis.matchedSkills, ...analysis.missingSkills.slice(0, 3)])].filter(Boolean);
    const rewrittenContent = merged.join(" • ");
    return { ...section, rewrittenContent, rewrittenBullets: merged };
  }

  // education, certifications, other — preserve verbatim
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
  const skills = skillsSection?.rewrittenBullets.length ? skillsSection.rewrittenBullets : analysis.matchedSkills;

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
  const rewritable = rawSections.filter(s => s.type !== "header");

  const sectionJson = rewritable.map(s => ({
    type: s.type,
    title: s.originalTitle,
    content: s.originalContent.slice(0, 800),
    bullets: s.bullets.slice(0, 8),
  }));

  const prompt = `You are an elite executive resume writer. Rewrite each resume section below to better match the job description.

STRICT RULES:
1. Preserve EXACT section titles and section order
2. Keep ALL factual details (company names, dates, degrees, metrics) — only improve language
3. Replace weak verbs (was, did, helped, worked, used) with power verbs (Spearheaded, Orchestrated, Delivered, Drove, Engineered, Championed)
4. Naturally incorporate these matched skills: ${analysis.matchedSkills.join(", ")}
5. Weave in these missing skills where truthful: ${analysis.missingSkills.slice(0, 4).join(", ")}
6. For experience bullets: add quantified outcomes (%, $, headcount, time-to-market) where plausible
7. Summary: 3 punchy sentences — strength → differentiation → value proposition
8. Return ONLY valid JSON array — no markdown, no code blocks

Job Description (excerpt):
${jobDescription.slice(0, 1000)}

Sections to rewrite:
${JSON.stringify(sectionJson, null, 2)}

Return a JSON array with exactly ${rewritable.length} objects:
[{ "type": "...", "title": "...", "rewrittenContent": "...", "rewrittenBullets": ["..."] }]
rewrittenBullets = individual bullet strings without bullet char (for experience/skills/projects), else []`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3500,
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
