import type { AnalysisResult } from "./analyzer.js";

export interface GapSkillRow {
  skill: string;
  required: boolean;
  present: boolean;
  category: "matched" | "missing" | "bonus" | "not-required";
}

export interface KeywordRow {
  keyword: string;
  present: boolean;
  count: number;
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

const ALL_SKILLS = [
  "javascript", "typescript", "react", "node.js", "express", "python", "java", "sql",
  "aws", "azure", "docker", "kubernetes", "git", "rest api", "graphql", "mongodb",
  "postgresql", "machine learning", "data analysis", "agile", "leadership", "communication",
  "project management", "figma", "tailwind", "ci/cd",
];

const STOP_WORDS = new Set([
  "the","and","or","to","a","an","in","of","for","with","that","this","is","are","was","were",
  "be","been","have","has","had","do","does","did","will","would","could","should","may","might",
  "from","by","at","on","as","if","it","its","we","you","our","your","their","they","them","us",
  "not","but","also","can","all","more","than","about","into","which","when","who","what","how",
  "other","any","each","some","such","both","after","before","between","through","during","using",
]);

function extractCandidateName(resumeText: string): string {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "Candidate";
  const words = firstLine.split(/\s+/).filter(w => /^[A-Z][a-z]+/.test(w));
  return words.slice(0, 3).join(" ") || firstLine.split(/\s+/).slice(0, 2).join(" ") || "Candidate";
}

function hasTerm(text: string, term: string): boolean {
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "i").test(text);
}

export function buildGapAnalysis(resumeText: string, jobDescription: string, analysis: AnalysisResult): GapAnalysis {
  const candidateName = extractCandidateName(resumeText);

  // Executive summary
  const { matchScore, matchedSkills, missingSkills } = analysis;
  const level = matchScore >= 75 ? "strong" : matchScore >= 50 ? "moderate" : "limited";
  const executiveSummary = `${candidateName} demonstrates a ${level} alignment with this role, achieving a match score of ${matchScore}%. ` +
    `The resume clearly evidences ${matchedSkills.length} of the required skills${matchedSkills.length > 0 ? ` including ${matchedSkills.slice(0, 3).join(", ")}` : ""}. ` +
    `To improve competitiveness, the candidate should address ${missingSkills.length} gap${missingSkills.length !== 1 ? "s" : ""}: ${missingSkills.slice(0, 4).join(", ") || "none identified"}.`;

  // Skills table
  const jdLower = jobDescription.toLowerCase();
  const resumeLower = resumeText.toLowerCase();
  const skillsTable: GapSkillRow[] = ALL_SKILLS.map(skill => {
    const required = hasTerm(jdLower, skill);
    const present = hasTerm(resumeLower, skill);
    let category: GapSkillRow["category"];
    if (required && present) category = "matched";
    else if (required && !present) category = "missing";
    else if (!required && present) category = "bonus";
    else category = "not-required";
    return { skill, required, present, category };
  });

  // Keyword density — top 25 words from JD
  const jdWords = jobDescription.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const wordCount: Record<string, number> = {};
  for (const w of jdWords) wordCount[w] = (wordCount[w] ?? 0) + 1;
  const sortedWords = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 25);
  const keywordDensity: KeywordRow[] = sortedWords.map(([keyword, count]) => ({
    keyword,
    present: hasTerm(resumeLower, keyword),
    count,
  }));

  // Action items
  const actionItems: string[] = [];
  if (missingSkills.length > 0) {
    missingSkills.slice(0, 3).forEach(skill => actionItems.push(`Add ${skill} to your Skills section`));
  }
  actionItems.push("Quantify achievements with numbers (%, $, or scale) in Experience bullets");
  if (!resumeLower.includes("summary") && !resumeLower.includes("objective")) {
    actionItems.push("Add a Professional Summary section at the top of your resume");
  }
  actionItems.push("Use strong action verbs (Built, Led, Delivered, Drove) to start each bullet");
  actionItems.push("Tailor your resume summary to mirror the job title and key requirements");
  actionItems.push("Ensure ATS-friendly headings: Summary, Skills, Experience, Education");
  if (analysis.stats.measurableResults < 3) {
    actionItems.push("Add at least 3 measurable outcomes to demonstrate impact");
  }

  // Certifications
  const allLower = (resumeLower + " " + jdLower);
  const recommendedCertifications: string[] = [];
  if (/aws|cloud/.test(allLower)) recommendedCertifications.push("AWS Solutions Architect Associate");
  if (/python|machine learning|ml/.test(allLower)) recommendedCertifications.push("Google Professional Machine Learning Engineer");
  if (/react|frontend|front-end/.test(allLower)) recommendedCertifications.push("Meta Frontend Developer Certificate");
  if (/docker|kubernetes|k8s/.test(allLower)) recommendedCertifications.push("CKA - Certified Kubernetes Administrator");
  if (/data|analytics|tableau/.test(allLower)) recommendedCertifications.push("Tableau Desktop Specialist");
  if (/project management|scrum|agile/.test(allLower)) recommendedCertifications.push("PMP - Project Management Professional");
  if (recommendedCertifications.length === 0) {
    recommendedCertifications.push("CompTIA IT Fundamentals", "Google Project Management Certificate");
  }

  // Experience gaps
  const experienceGaps: string[] = [];
  if (missingSkills.length > 2) {
    experienceGaps.push(`JD requires proficiency in ${missingSkills.slice(0, 2).join(" and ")}, resume does not clearly demonstrate this`);
  }
  if (!resumeLower.includes("year") && !resumeLower.match(/\d{4}/)) {
    experienceGaps.push("JD requires demonstrated years of experience, resume lacks clear tenure indicators");
  }
  experienceGaps.push("JD emphasizes measurable business impact, resume would benefit from quantified achievements");
  experienceGaps.push("JD implies cross-functional collaboration, consider adding team leadership or stakeholder examples");
  if (experienceGaps.length < 3) {
    experienceGaps.push("Consider adding project scope details to align with JD's emphasis on scale and complexity");
  }

  return {
    candidateName,
    executiveSummary,
    skillsTable,
    keywordDensity,
    actionItems: actionItems.slice(0, 8),
    recommendedCertifications,
    experienceGaps: experienceGaps.slice(0, 4),
  };
}
