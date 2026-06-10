import type { AnalysisResult } from "./analyzer.js";
import { DOMAIN_CERTS } from "./skill-matcher.js";

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
  // Skills table: use Claude Pass 2 matched/missing lists directly.
  // Re-running regex extraction here produces false positives (e.g. "IT Security"
  // flagged as missing for a 21-year SAP Security consultant). Trust Claude output.
  const skillsTable: GapSkillRow[] = [
    ...matchedSkills.map(skill => ({
      skill,
      required: true,
      present: true,
      category: "matched" as GapSkillRow["category"],
    })),
    ...missingSkills.map(skill => ({
      skill,
      required: true,
      present: false,
      category: "missing" as GapSkillRow["category"],
    })),
  ];

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

  // Specific missing skills — advice is seniority-aware
  const isExecutive = analysis.seniorityLevel === "executive" || analysis.seniorityLevel === "senior";
  for (const skill of missingSkills.slice(0, 3)) {
    if (isExecutive) {
      actionItems.push(`Surface evidence of "${skill}" in your Experience section — reference a specific project, client, or delivery where this was applied.`);
    } else {
      actionItems.push(`Add "${skill}" to your Skills section — explicitly required by this JD.`);
    }
  }

  // JD keywords absent from resume — filter out generic/weak words
  const WEAK_KEYWORDS = new Set([
    "every","work","team","where","create","across","driving","including",
    "role","their","that","with","this","from","have","will","your","they",
    "also","more","some","been","what","when","into","such","each","than",
    "then","these","those","both","well","much","many","need","make","take",
    "come","like","just","know","time","year","good","look","want","give",
    "use","see","him","two","how","its","our","out","who","get","can","her",
    "all","new","one","way","may","now","day","did","not","but","the","and",
    "for","are","was","his","has","had","able","best","help","high","must",
    "within","while","other","about","after","would","could","should","being",
  ]);
  const absentKeywords = keywordDensity
    .filter(r => !r.present && r.count >= 2 && !WEAK_KEYWORDS.has(r.keyword) && r.keyword.length > 4)
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



  // Only add heading tip if sections are genuinely missing (not just a formatting issue)
  if (analysis.stats.sectionsFound < 3) {
    actionItems.push("Add clear ATS-friendly section headings: Summary, Skills, Experience, Education, Certifications.");
  }

  // ── Recommended certifications — domain-aware ────────────────────────────────
  // Use Claude-detected domain from Phase 1 if available, else regex fallback
  // Use Claude Pass 1 domain directly — never re-run regex detectDomain
  // which misfires on BFSI client history (returns "finance" for a TPM/PM)
  const claudeDomain = analysis.domain as keyof typeof DOMAIN_CERTS | undefined;
  const certDomain = (claudeDomain && DOMAIN_CERTS[claudeDomain]) ? claudeDomain : "general";
  const recommendedCertifications = DOMAIN_CERTS[certDomain].slice(0, 5);

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
