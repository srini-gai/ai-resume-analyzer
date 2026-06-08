import type { AnalysisResult } from "./analyzer.js";
import {
  extractSkillsFromJD, semanticMatch, deduplicateSkills,
  detectDomain, DOMAIN_CERTS,
} from "./skill-matcher.js";

export interface GapSkillRow {
  skill: string;
  required: boolean;
  present: boolean;
  category: "matched" | "missing" | "bonus" | "not-required";
}

export interface KeywordRow {
  keyword: string;
  present: boolean;
  count: number;      // occurrences in JD
  resumeCount: number; // occurrences in resume
}

export interface GapAnalysis {
  candidateName: string;
  executiveSummary: string;
  skillsTable: GapSkillRow[];
  keywordDensity: KeywordRow[];
  actionItems: string[];
  recommendedCertifications: string[];
  experienceGaps: string[];
}

const STOP_WORDS = new Set([
  "the","and","or","to","a","an","in","of","for","with","that","this","is","are","was","were",
  "be","been","have","has","had","do","does","did","will","would","could","should","may","might",
  "from","by","at","on","as","if","it","its","we","you","our","your","their","they","them","us",
  "not","but","also","can","all","more","than","about","into","which","when","who","what","how",
  "other","any","each","some","such","both","after","before","between","through","during","using",
]);

function extractCandidateName(resumeText: string): string {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    // Skip lines with contact info (email, phone, URL, long text)
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

function countInText(word: string, text: string): number {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return (text.match(re) ?? []).length;
}

export function buildGapAnalysis(
  resumeText: string,
  jobDescription: string,
  analysis: AnalysisResult
): GapAnalysis {
  const candidateName = extractCandidateName(resumeText);
  const { matchScore, matchedSkills, missingSkills } = analysis;

  // ── Executive summary ────────────────────────────────────────────────────────
  const level = matchScore >= 75 ? "strong" : matchScore >= 50 ? "moderate" : "limited";
  const executiveSummary =
    `${candidateName} demonstrates a ${level} alignment with this role, achieving a match score of ${matchScore}%. ` +
    `The resume clearly evidences ${matchedSkills.length} of the required skills` +
    (matchedSkills.length > 0 ? ` including ${matchedSkills.slice(0, 3).join(", ")}` : "") +
    `. To strengthen competitiveness, address ${missingSkills.length} gap${missingSkills.length !== 1 ? "s" : ""}: ` +
    (missingSkills.length > 0 ? missingSkills.slice(0, 4).join(", ") : "none identified") + ".";

  // ── Skills table (JD-driven, not static list) ────────────────────────────────
  const jdSkills = deduplicateSkills(extractSkillsFromJD(jobDescription));
  const skillsTable: GapSkillRow[] = jdSkills.map(skill => {
    const present = semanticMatch(skill, resumeText);
    const category: GapSkillRow["category"] = present ? "matched" : "missing";
    return { skill, required: true, present, category };
  });

  // Also surface resume skills not in JD as "bonus"
  const bonusSkills = matchedSkills.filter(s => !semanticMatch(s, jobDescription)).slice(0, 5);
  for (const skill of bonusSkills) {
    skillsTable.push({ skill, required: false, present: true, category: "bonus" });
  }

  // ── Keyword density — two-column: JD count vs resume count ──────────────────
  const jdWords = jobDescription.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const wordCount: Record<string, number> = {};
  for (const w of jdWords) wordCount[w] = (wordCount[w] ?? 0) + 1;
  const sortedWords = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 25);
  const keywordDensity: KeywordRow[] = sortedWords.map(([keyword, count]) => ({
    keyword,
    present: countInText(keyword, resumeText) > 0,
    count,
    resumeCount: countInText(keyword, resumeText),
  }));

  // ── Action items — JD-specific, never generic ────────────────────────────────
  const actionItems: string[] = [];

  // Specific missing skills
  for (const skill of missingSkills.slice(0, 3)) {
    actionItems.push(`Add "${skill}" to your Skills section — explicitly required by this JD.`);
  }

  // JD keywords absent from resume
  const absentKeywords = keywordDensity
    .filter(r => !r.present && r.count >= 2)
    .slice(0, 2);
  for (const { keyword } of absentKeywords) {
    actionItems.push(`Incorporate "${keyword}" naturally in your Experience section to align with JD vocabulary.`);
  }

  if (analysis.stats.measurableResults < 3) {
    actionItems.push("Add at least 3 measurable outcomes to demonstrate impact (e.g., team size, project count, compliance rate).");
  }

  if (!resumeText.toLowerCase().includes("summary") && !resumeText.toLowerCase().includes("objective")) {
    actionItems.push("Add a Professional Summary at the top that mirrors the JD's role title and key requirements.");
  } else {
    actionItems.push("Align your Professional Summary opening line with the exact role title in the JD.");
  }

  if (analysis.stats.actionVerbs < 5) {
    actionItems.push("Start each Experience bullet with a strong action verb: Spearheaded, Orchestrated, Delivered, Configured, Implemented.");
  }

  actionItems.push("Ensure ATS-friendly section headings: Summary, Skills, Experience, Education, Certifications.");

  // ── Recommended certifications — domain-aware ────────────────────────────────
  const domain = detectDomain(resumeText, jobDescription);
  const recommendedCertifications = (DOMAIN_CERTS[domain] ?? DOMAIN_CERTS.general).slice(0, 5);

  // ── Experience gaps — always populated, never "No major gaps" unless 95%+ ───
  const experienceGaps: string[] = [];

  if (missingSkills.length > 0) {
    experienceGaps.push(
      `JD requires ${missingSkills.slice(0, 2).join(" and ")} — not clearly evidenced in the resume.`
    );
  }

  if (analysis.stats.measurableResults < 3) {
    experienceGaps.push("JD emphasizes measurable business impact; resume would benefit from quantified outcomes.");
  }

  if (!resumeText.match(/\d{4}/)) {
    experienceGaps.push("JD requires demonstrated years of experience; resume lacks clear date/tenure indicators.");
  }

  experienceGaps.push("JD implies cross-functional collaboration — consider adding team leadership or stakeholder examples.");

  if (matchScore < 95 && experienceGaps.length < 3) {
    experienceGaps.push("Add project scope details to align with the JD's emphasis on scale and complexity.");
  }

  return {
    candidateName,
    executiveSummary,
    skillsTable: skillsTable.slice(0, 30),
    keywordDensity,
    actionItems: actionItems.slice(0, 8),
    recommendedCertifications,
    experienceGaps: experienceGaps.slice(0, 4),
  };
}
