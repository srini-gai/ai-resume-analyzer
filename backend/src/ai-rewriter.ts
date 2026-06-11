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
  // Count words — more than 6 = likely a sentence, not a heading
  if (clean.split(/\s+/).length > 6) return null;

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

  // Remove sections with no content — misclassified bullet points
  const nonEmpty = sections.filter(s =>
    s.type === "header" ||
    s.originalContent.trim().length > 0 ||
    s.bullets.length > 0
  );

  // Deduplicate sections — PDF extraction sometimes doubles content
  // Keep first occurrence of each section type
  const seen = new Set<string>();
  const deduped = sections.filter(s => {
    const key = `${s.type}::${s.originalTitle.slice(0, 20)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Final filter: skip empty sections that slipped through
  return deduped.filter(s =>
    s.type === "header" ||
    s.originalContent.trim().length > 0 ||
    s.bullets.length > 0
  );
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

function strengthenBullet(b: string, _jdKeywords: string[]): string {
  let text = fixPdfArtifact(b.trim());
  for (const [weak, strong] of Object.entries(WEAK_VERBS)) {
    if (new RegExp(`^${weak}\\b`, "i").test(text)) {
      text = text.replace(new RegExp(`^${weak}\\b`, "i"), strong);
      break;
    }
  }
  // Do NOT invent metrics or append filler phrases — preserve factual accuracy
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
    // Preserve the original summary — it contains the candidate's own words and is
    // accurate. Only generate from template when the resume had no summary at all.
    // Never insert raw JD word-tokens (they produce nonsense like "Proven track record
    // of description, seeking, security").
    const orig = section.originalContent.trim();
    if (orig) {
      return { ...section, rewrittenContent: orig, rewrittenBullets: [] };
    }
    // No original summary — generate a minimal one using only known matched skills
    const topSkills = analysis.matchedSkills.slice(0, 4).join(", ") || "enterprise technology";
    const rewrittenContent =
      `Results-driven professional with proven expertise in ${topSkills}. ` +
      `Demonstrated track record of delivering high-quality solutions and consistently exceeding stakeholder expectations.`;
    return { ...section, rewrittenContent, rewrittenBullets: [] };
  }

  if (section.type === "experience" || section.type === "projects" || section.type === "other") {
    if (section.bullets.length === 0) {
      // No bullets extracted — preserve original, just clean up wording
      return { ...section, rewrittenContent: section.originalContent };
    }
    const rewrittenBullets = section.bullets.map(b => strengthenBullet(b, jdKeywords));
    const rewrittenContent = rewrittenBullets.map(b => `• ${b}`).join("\n");
    return { ...section, rewrittenContent, rewrittenBullets };
  }

  if (section.type === "skills") {
    const existing = section.bullets.length
      ? section.bullets
      : section.originalContent.split(/[,|•\n;]+/).map(s => s.trim()).filter(Boolean);
    // Only add genuinely matched skills — never inject missing skills into the CV
    const merged = [...new Set([...existing, ...analysis.matchedSkills])].filter(Boolean);
    return { ...section, rewrittenContent: merged.join(" • "), rewrittenBullets: merged };
  }

  // education, certifications — preserve verbatim
  return { ...section, rewrittenContent: section.originalContent };
}

// ─── Candidate name extractor ─────────────────────────────────────────────────

function extractCandidateName(resumeText: string): string {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean);
  // Search first 5 lines for a name-like line (no contact info, short, word-only)
  for (const line of lines.slice(0, 5)) {
    if (/@|http|linkedin|\d{3}[-.]?\d{3}|\d{10}|phone:|email:/.test(line.toLowerCase())) continue;
    if (line.length > 60 || line.length < 2) continue;
    const words = line.split(/\s+/).filter(w => /^[A-Za-z][a-zA-Z'-]{0,}$/.test(w));
    if (words.length >= 1 && words.length <= 4) {
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    }
  }
  const first = lines[0] ?? "Candidate";
  const words = first.split(/\s+/).slice(0, 2);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") || "Candidate";
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

  // ── Phase 3: Executive Resume Mode ──────────────────────────────────────────
  // Detect executive tier and inject domain-specific rewriting intelligence.
  // Executive PMs get impact language transformation.
  // SAP/technical profiles get sub-module and specificity improvements.
  // All profiles get seniority-appropriate verb and structure guidance.

  const isExecutive = analysis.seniorityLevel === "executive" || analysis.seniorityLevel === "senior";
  const domain = analysis.domain ?? "general";

  const executiveGuidance = isExecutive ? `
EXECUTIVE RESUME MODE — ACTIVE:
This is a senior/executive profile. Apply these additional rules:

IMPACT LANGUAGE TRANSFORMATION:
- Convert vague responsibility bullets into outcome statements
  BEFORE: "Led a team of consultants on SAP implementation"
  AFTER: "Spearheaded 12-consultant SAP S/4HANA delivery for 2,400-user organisation, completing 6 weeks ahead of schedule"
- Every Experience bullet must answer: What was the scale? What was the outcome? Who benefited?
- Surface business impact language: cost savings, revenue protected, efficiency gains, risk reduced, compliance achieved
- Replace "responsible for" with ownership verbs: Owned, Drove, Delivered, Architected, Governed

SENIORITY SIGNALS TO STRENGTHEN:
- Budget scale: if mentioned, make it prominent ("£8M programme" not buried mid-sentence)
- Stakeholder scope: "C-suite advisory", "Board reporting", "cross-org alignment" where evidenced
- Team scale: "led 45-person programme team" not "managed team members"
- Transformation language: "end-to-end digital transformation" not "project delivery"

EXECUTIVE SUMMARY REWRITE:
- Open with seniority + domain + years: "Senior Programme Director with 16+ years..."
- Second sentence: biggest career achievement with scale
- Third sentence: what value you bring to THIS specific role
- Never start with "I" or "Experienced professional"` : "";

  const domainGuidance: Record<string, string> = {
    sap: `
SAP DOMAIN RULES:
- Surface sub-module specifics: ARA, ARM, BRM, EAM, MSMP, PFCG, SU24 — name them explicitly
- Replace "SAP experience" with specific versions: "SAP GRC Access Control 12.0", "S/4HANA 2021"
- SoD language: "designed and maintained SoD ruleset across procure-to-pay processes"
- Client context: "for [FTSE 100 client]" or "for [X,000]-user enterprise" adds weight
- Certifications to surface if present: SAP Certified AC, CISA, ISO 27001`,

    pm: `
PROGRAMME MANAGEMENT DOMAIN RULES:
- Lead every bullet with delivery outcome, not activity: "Delivered" not "Responsible for delivering"
- Budget language: always show scale — "£12M" not "large budget", "$40M portfolio" not "multi-million"
- Stakeholder language: name the level — "ExCo", "C-suite", "Board", "Steering Committee"
- Methodology signals: SAFe PI Planning, PRINCE2, MSP — name the methodology with context
- Transformation language: "end-to-end digital transformation", "greenfield platform delivery"
- For consulting roles: surface client industry, team size, delivery timeline`,

    tpm: `
TECHNICAL PROGRAMME MANAGER DOMAIN RULES:
- Lead with technical context then programme outcome: "Architected cross-team dependency framework for 10 Scrum teams..."
- Surface technical decisions made: architecture reviews, build vs buy, vendor selection
- Engineering influence language: "aligned 6 engineering leads", "unblocked 3 parallel workstreams"
- OKR/KPI language: "defined success metrics", "tracked OKRs across 4 product teams"
- MLOps context if present: pipeline delivery, model governance, infrastructure programme
- Balance technical credibility with delivery outcomes in every bullet`,

    "ai-strategy": `
AI STRATEGY DOMAIN RULES:
- Lead with business impact of AI: "Reduced FTE cost by 30% through AI automation of..."
- ROI language: quantify the AI investment and return wherever possible
- Governance language: "responsible AI framework", "bias detection", "model auditability"
- Strategic framing: "enterprise-wide AI adoption", "AI centre of excellence", "build vs buy evaluation"
- Vendor/platform specifics: Claude, GPT-4, Azure OpenAI, AWS Bedrock — name them
- Change management language: "drove adoption across 500-person organisation"`,

    fintech: `
FINTECH DOMAIN RULES:
- Regulatory language: name the regulation and the delivery — "PSD2 compliance programme delivered on time"
- Payment rail specifics: SWIFT, SEPA, Faster Payments, open banking APIs — name them
- Risk language: "reduced operational risk by X%", "zero regulatory findings in audit"
- Commercial language: P&L ownership, revenue impact, cost reduction — show scale
- Platform language: "core banking modernisation", "real-time payment platform"`,

    "eng-mgmt": `
ENGINEERING MANAGEMENT DOMAIN RULES:
- People leadership first: "Scaled engineering team from 8 to 24 across 3 product squads"
- Technical decisions: architecture choices, platform decisions, build vs buy
- Delivery at scale: shipped products with user/revenue metrics
- Culture signals: hiring bar raised, attrition reduced, team health metrics
- Org design: team topology, squad model, platform vs product split`,
  };

  const activeDomainGuidance = domainGuidance[domain] ?? "";

  const prompt = `You are an expert resume editor specialising in senior and executive profiles. Rewrite each section to better align with the job description.

STRICT RULES — FOLLOW EXACTLY:
1. Preserve EXACT section titles and order.
2. Keep ALL facts: names, company names, dates, metrics, technologies. Do NOT alter or invent any.
3. Replace weak verbs with power verbs: Spearheaded, Orchestrated, Delivered, Drove, Governed, Architected, Owned.
4. Where natural and truthful, incorporate these matched skills from the JD: ${analysis.matchedSkills.slice(0, 6).join(", ")}.
5. Do NOT invent metrics, percentages, or outcomes that are not in the original text.
6. Do NOT append filler phrases like "driving measurable improvement" or "achieving significant results".
7. If a bullet has no quantifiable metric in the original, improve the language but do not add invented numbers.
8. Only rewrite language — never add new facts, responsibilities, or tools not present in the original.
9. Return ONLY valid JSON array — no markdown, no code blocks, no explanation.
${executiveGuidance}
${activeDomainGuidance}

Job Description (excerpt):
${jobDescription.slice(0, 800)}

Sections to rewrite:
${JSON.stringify(sectionJson, null, 2)}

Return exactly ${rewritable.length} objects in a JSON array:
[{"type":"...","title":"...","rewrittenContent":"...","rewrittenBullets":["..."]}]
rewrittenBullets = individual bullet strings (no bullet character) for experience/skills/projects/other sections, else []`;

  try {
    // Executive/senior profiles use Sonnet for better impact language quality
    const rewriteModel = isExecutive ? "claude-sonnet-4-5" : "claude-haiku-4-5";
    const message = await client.messages.create({
      model: rewriteModel,
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
      const titleSlice = orig.originalTitle.toLowerCase().slice(0, 10);
      const ai = parsed.find(p => p.type === orig.type && p.title === orig.originalTitle)
        ?? parsed.find(p => p.type === orig.type && titleSlice.length >= 4 &&
          p.title?.toLowerCase().includes(titleSlice))
        ?? parsed.find(p => p.type === orig.type);
      if (!ai) return orig;
      // If Claude returned explicit bullets, use them.
      // If not, return [] so docx-generator falls through to parse rewrittenContent —
      // which IS the AI-rewritten text. Falling back to orig.bullets would silently
      // write original content into the DOCX while the UI shows rewritten prose.
      return {
        ...orig,
        rewrittenContent: ai.rewrittenContent ?? orig.originalContent,
        rewrittenBullets: ai.rewrittenBullets?.length ? ai.rewrittenBullets : [],
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
