/**
 * analyzer.ts — Phase 1: Two-pass Claude-powered resume analysis
 *
 * PASS 1 — Skill Extraction (Claude)
 *   Extracts a structured skill inventory from the resume and JD separately.
 *   Claude understands context, synonyms, and implicit skills — e.g. it knows
 *   "led the S/4HANA cutover" implies HANA migration experience even without the
 *   exact keyword. It also identifies seniority signals and domain.
 *
 * PASS 2 — Intelligent Scoring (Claude)
 *   Receives the structured inventories and produces calibrated scores.
 *   Scoring is domain-aware: PM/Director resumes are scored on business impact,
 *   not keyword density. SAP resumes check GRC sub-module coverage, not generic
 *   "project management" keywords.
 *
 * FALLBACK — if ANTHROPIC_API_KEY is absent or either pass fails, the original
 *   regex-based logic runs so the app never breaks.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  extractSkillsFromJD,
  semanticMatch,
  deduplicateSkills,
} from "./skill-matcher.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  matchScore: number;
  strengthScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  stats: {
    wordCount: number;
    actionVerbs: number;
    measurableResults: number;
    sectionsFound: number;
  };
  // Phase 1 additions
  domain?: string;
  seniorityLevel?: "junior" | "mid" | "senior" | "executive";
  scoringRationale?: string;
}

export interface SkillInventory {
  explicit: string[];
  implied: string[];
  domain: string;
  seniorityLevel: "junior" | "mid" | "senior" | "executive";
  seniorityEvidence: string[];
  achievements: string[];
}

export interface ScoringResult {
  matchScore: number;
  strengthScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  scoringRationale: string;
}

// ─── Constants for fallback ───────────────────────────────────────────────────

const ACTION_VERBS = [
  "built", "created", "developed", "delivered", "led", "managed", "improved",
  "increased", "reduced", "optimized", "launched", "designed", "spearheaded",
  "orchestrated", "architected", "streamlined", "automated", "implemented",
  "deployed", "configured", "engineered", "drove",
];

const SECTION_KEYWORDS = [
  "experience", "education", "skills", "summary", "projects", "certifications",
];


// ─── JD preprocessor — strips structural noise before Claude sees it ──────────
// Removes section headings ("Key Responsibilities", "Requirements"), bullet
// numbering, and other non-skill text so Claude doesn't parse them as skills.
function preprocessJD(jd: string): string {
  return jd
    .split("\n")
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      const upper = line.toUpperCase();
      // Drop pure section headings (short lines, no sentence structure)
      const headings = [
        "KEY RESPONSIBILITIES", "RESPONSIBILITIES", "REQUIREMENTS",
        "QUALIFICATIONS", "WHAT YOU WILL DO", "WHAT WE NEED",
        "NICE TO HAVE", "PREFERRED", "ABOUT THE ROLE", "THE ROLE",
        "JOB DESCRIPTION", "OVERVIEW", "WHO YOU ARE", "BENEFITS",
        "ABOUT US", "WHAT YOU BRING", "YOUR PROFILE",
      ];
      if (headings.some(h => upper.startsWith(h)) && line.length < 60) return false;
      // Drop lines that are just a number or bullet marker
      if (/^[\d]+\.?$/.test(line)) return false;
      return true;
    })
    .join("\n");
}

// ─── Pass 1: Extract structured skill inventory via Claude ────────────────────

async function extractSkillInventory(
  text: string,
  role: "resume" | "jd",
  client: Anthropic
): Promise<SkillInventory> {
  const roleLabel = role === "resume" ? "resume" : "job description";

  const systemPrompt = `You are an expert technical recruiter and resume analyst with deep knowledge across:
- SAP/ERP ecosystems (GRC, S/4HANA, Fiori, ABAP, Security, ARA, ARM, BRM, EAM, MSMP)
- Programme/Project Management (PMP, SAFe, PRINCE2, delivery management, PMO)
- Cloud platforms (AWS, Azure, GCP) and DevOps
- Data Engineering, ML/AI
- BFSI, Payments, Insurance domain knowledge
- Cybersecurity and IAM

Your job is to extract a precise, structured skill inventory from the text provided.
Return ONLY valid JSON — no markdown, no explanation, no code blocks.`;

  const userPrompt = `Extract a complete skill inventory from this ${roleLabel}.

RULES:
0. IGNORE section headings, structural phrases, and meta-text. Examples of what to IGNORE:
   - "Key Responsibilities", "Requirements", "Qualifications", "Act as the..."
   - Sentences starting with verbs like "Lead", "Conduct", "Drive", "Manage" — these are
     responsibilities, not skills. Extract only the skill/technology embedded within them.
   - Degree requirements like "Bachelor's degree in Computer Science" → extract "Computer Science" only
   - Experience requirements like "10+ years of experience as a Security Consultant" → NOT a skill
1. "explicit" = skills, tools, technologies, frameworks directly named (e.g. "SAP GRC", "Python", "Ariba Network")
2. "implied" = skills strongly evidenced by context but not stated as a skill keyword
   Example: "Led S/4HANA cutover for 2,400 users" → implies: S/4HANA migration, change management, cutover planning
   Example: "Managed £8M programme budget" → implies: financial governance, budget management, executive reporting
3. Normalise synonyms to their canonical form:
   - "Programme Manager" and "Program Manager" → "Programme Management"
   - "SAP GRC Access Control" / "GRC" / "Access Control 12.0" → "SAP GRC"
   - "SoD" / "Segregation of Duties" → "SoD Analysis"
4. For domain detection, choose the SINGLE best fit:
   sap | pm | cloud | data | devops | security | finance | healthcare | general
5. For seniority, look for:
   - executive: Director, VP, Programme Director, Head of, C-level, P&L ownership, large budget
   - senior: Lead, Senior, Principal, 8+ years, team of 5+, architecture ownership
   - mid: 3-7 years, delivery ownership, some team lead
   - junior: 0-2 years, contributor, associate
6. achievements = measurable outcomes only (must have a number, %, currency amount, or concrete scale)

Return this exact JSON structure:
{
  "explicit": ["skill1", "skill2"],
  "implied": ["skill1", "skill2"],
  "domain": "sap",
  "seniorityLevel": "senior",
  "seniorityEvidence": ["evidence1", "evidence2"],
  "achievements": ["achievement1", "achievement2"]
}

Text to analyse:
---
${text.slice(0, 3000)}
---`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = (message.content[0] as { type: string; text?: string })?.text ?? "{}";
  const clean = raw.replace(/```(?:json)?/gi, "").trim();
  return JSON.parse(clean) as SkillInventory;
}

// ─── Pass 2: Domain-aware scoring via Claude ──────────────────────────────────

async function scoreCandidateFit(
  resumeInventory: SkillInventory,
  jdInventory: SkillInventory,
  resumeText: string,
  client: Anthropic
): Promise<ScoringResult> {
  const systemPrompt = `You are a senior technical recruiter. You score resume-to-job-description fit.

SCORING PHILOSOPHY — different domains need different scoring logic:
- SAP/GRC: Weight sub-module coverage heavily (ARA, ARM, BRM, EAM each count separately). Generic "SAP experience" without sub-module detail = partial credit only.
- Programme/Project Management (executive): Score on business impact language, stakeholder scope, budget scale, and delivery outcomes — NOT keyword density.
- Cloud/DevOps: Score on service-level specificity (e.g. Lambda vs "AWS" vs "cloud") and architecture ownership.
- Data/ML: Score on toolchain depth and production deployment experience, not just familiarity.
- General: Balanced keyword + quality scoring.

CALIBRATION GUIDE (be accurate, not generous):
- 85-100: Near-perfect fit. Candidate clearly meets almost all requirements with strong evidence.
- 70-84: Good fit. Meets most requirements, minor gaps, strong candidacy.
- 55-69: Moderate fit. Meets core requirements but meaningful gaps exist.
- 40-54: Partial fit. Some alignment but significant gaps.
- Below 40: Weak fit. Fundamental mismatch between profile and role.

strengthScore = quality of the resume itself, independent of the JD:
- 85+: Executive-level writing, strong impact language, quantified achievements, clear progression
- 70-84: Good writing, some metrics, action verbs, well structured
- 55-69: Average, some action verbs, limited metrics
- Below 55: Weak language, no metrics, passive writing

Return ONLY valid JSON, no explanation outside the JSON.`;

  const userPrompt = `Score this candidate's fit for the role.

JD Skill Requirements:
- Domain: ${jdInventory.domain}
- Required skills (explicit): ${jdInventory.explicit.slice(0, 20).join(", ")}
- Required skills (implied): ${jdInventory.implied.slice(0, 10).join(", ")}
- Seniority expected: ${jdInventory.seniorityLevel}

Candidate Profile:
- Domain: ${resumeInventory.domain}
- Skills (explicit): ${resumeInventory.explicit.slice(0, 25).join(", ")}
- Skills (implied): ${resumeInventory.implied.slice(0, 15).join(", ")}
- Seniority level: ${resumeInventory.seniorityLevel}
- Seniority evidence: ${resumeInventory.seniorityEvidence.slice(0, 3).join("; ")}
- Key achievements: ${resumeInventory.achievements.slice(0, 5).join("; ")}

Resume quality signals (from text):
${resumeText.slice(0, 500)}

Return this exact JSON:
{
  "matchScore": 72,
  "strengthScore": 78,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "suggestions": [
    "Specific, actionable suggestion 1",
    "Specific, actionable suggestion 2",
    "Specific, actionable suggestion 3"
  ],
  "scoringRationale": "One paragraph explaining the score reasoning, domain-specific"
}

Rules for suggestions:
- Maximum 5 suggestions, each must be specific to THIS JD and resume — never generic
- Reference actual missing skills or specific gaps found in this analysis
- For executive resumes: focus on impact language and business outcome framing
- For technical resumes: focus on specific missing tools/technologies
- Never say "add action verbs" or "quantify achievements" generically — name the specific bullets to improve`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = (message.content[0] as { type: string; text?: string })?.text ?? "{}";
  const clean = raw.replace(/```(?:json)?/gi, "").trim();
  return JSON.parse(clean) as ScoringResult;
}

// ─── Resume stats (calculated locally, used in UI) ────────────────────────────

function computeStats(resume: string) {
  const wordCount = resume.trim().split(/\s+/).filter(Boolean).length;
  const actionVerbs = ACTION_VERBS.filter(v =>
    new RegExp(`\\b${v}\\b`, "i").test(resume)
  ).length;
  const measurableResults = (resume.match(
    /\b\d+(?:\.\d+)?%|\$\s?\d+|£\s?\d+|\b\d+\+?\s+(?:users|clients|projects|teams|people|customers|countries|sites|systems|applications)\b/gi
  ) ?? []).length;
  const sectionsFound = SECTION_KEYWORDS.filter(s =>
    new RegExp(`\\b${s}\\b`, "i").test(resume)
  ).length;
  return { wordCount, actionVerbs, measurableResults, sectionsFound };
}

// ─── Fallback: original regex-based analysis (no API key or on error) ─────────

const BASE_SKILLS = [
  "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "SQL",
  "AWS", "Azure", "Docker", "Kubernetes", "Git", "REST API", "MongoDB",
  "PostgreSQL", "Machine Learning", "Agile", "Leadership", "Project Management",
  "SAP", "GRC", "SoD", "ARA", "ARM", "BRM", "EAM", "MSMP", "PFCG", "SU24",
  "S/4HANA", "Fiori", "HANA", "ABAP", "Ariba", "SAP Security",
  "IAM", "SSO", "SOX", "Cybersecurity",
  "Scrum", "Kanban", "Jira", "Stakeholder Management", "Programme Management",
];

function fallbackAnalyze(resume: string, jobDescription: string): AnalysisResult {
  const jdExtracted = extractSkillsFromJD(jobDescription);
  const staticRequested = BASE_SKILLS.filter(s => semanticMatch(s, jobDescription));
  const allRequested = deduplicateSkills([...jdExtracted, ...staticRequested])
    .filter(s => s.length > 1);

  const matchedSkills = deduplicateSkills(
    allRequested.filter(skill => semanticMatch(skill, resume))
  ).slice(0, 25);

  const missingSkills = deduplicateSkills(
    allRequested.filter(skill => !semanticMatch(skill, resume))
  ).slice(0, 20);

  const stats = computeStats(resume);
  const matchRatio = allRequested.length > 0 ? matchedSkills.length / allRequested.length : 0;
  const skillScore = allRequested.length > 0 ? matchRatio * 75 : 45;
  const qualityScore = Math.min(
    25,
    stats.actionVerbs * 2 + stats.measurableResults * 3 + stats.sectionsFound * 2
  );
  const matchScore = Math.round(Math.min(100, skillScore + qualityScore));
  const strengthScore = Math.round(
    Math.min(100, 25 + stats.sectionsFound * 8 + stats.actionVerbs * 3 +
      stats.measurableResults * 5 + Math.min(10, stats.wordCount / 60))
  );

  const suggestions: string[] = [];
  if (missingSkills.length > 0) {
    suggestions.push(`Add evidence of these JD-required skills where truthful: ${missingSkills.slice(0, 4).join(", ")}.`);
  }
  if (stats.measurableResults < 3) {
    suggestions.push("Quantify at least three achievements with percentages, revenue impact, or scale.");
  }
  if (stats.actionVerbs < 5) {
    suggestions.push("Start more bullets with strong action verbs: Delivered, Spearheaded, Orchestrated, Configured.");
  }
  if (!suggestions.length) {
    suggestions.push("Strong foundation. Tailor the opening summary to this specific role.");
  }

  return { matchScore, strengthScore, matchedSkills, missingSkills, suggestions, stats };
}

// ─── Main export: async two-pass analyzeResume ────────────────────────────────

export async function analyzeResume(
  resume: string,
  jobDescription: string
): Promise<AnalysisResult> {
  const stats = computeStats(resume);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[analyzer] No ANTHROPIC_API_KEY — using fallback regex analysis");
    return fallbackAnalyze(resume, jobDescription);
  }

  const client = new Anthropic();

  try {
    console.log("[analyzer] Pass 1: extracting skill inventories...");
    const cleanedJD = preprocessJD(jobDescription);
    const [resumeInventory, jdInventory] = await Promise.all([
      extractSkillInventory(resume, "resume", client),
      extractSkillInventory(cleanedJD, "jd", client),
    ]);
    console.log(`[analyzer] Resume: domain=${resumeInventory.domain}, seniority=${resumeInventory.seniorityLevel}`);
    console.log(`[analyzer] JD: domain=${jdInventory.domain}`);

    console.log("[analyzer] Pass 2: domain-aware scoring...");
    const scoring = await scoreCandidateFit(resumeInventory, jdInventory, resume, client);
    console.log(`[analyzer] Scores — match=${scoring.matchScore}, strength=${scoring.strengthScore}`);

    return {
      matchScore: Math.min(100, Math.max(0, Math.round(scoring.matchScore))),
      strengthScore: Math.min(100, Math.max(0, Math.round(scoring.strengthScore))),
      matchedSkills: (scoring.matchedSkills ?? []).slice(0, 25),
      missingSkills: (scoring.missingSkills ?? []).slice(0, 20),
      suggestions: (scoring.suggestions ?? []).slice(0, 5),
      stats,
      domain: resumeInventory.domain,
      seniorityLevel: resumeInventory.seniorityLevel,
      scoringRationale: scoring.scoringRationale,
    };
  } catch (err) {
    console.error("[analyzer] Claude passes failed, falling back to regex:", err);
    return fallbackAnalyze(resume, jobDescription);
  }
}

// ─── Sync fallback export (used by v1 /api/analyze endpoint and tests) ────────
export function analyzeResumeSync(resume: string, jobDescription: string): AnalysisResult {
  return fallbackAnalyze(resume, jobDescription);
}
