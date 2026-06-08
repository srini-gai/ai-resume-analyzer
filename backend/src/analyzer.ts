import { extractSkillsFromJD, semanticMatch, deduplicateSkills } from "./skill-matcher.js";

export interface AnalysisResult {
  matchScore: number;
  strengthScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  stats: { wordCount: number; actionVerbs: number; measurableResults: number; sectionsFound: number };
}

// Static base list — covers domains not easily extracted from short JDs
const BASE_SKILLS = [
  // Web / Software
  "JavaScript", "TypeScript", "React", "Node.js", "Express", "Python", "Java", "SQL",
  "AWS", "Azure", "Docker", "Kubernetes", "Git", "REST API", "GraphQL", "MongoDB",
  "PostgreSQL", "Machine Learning", "Data Analysis", "Agile", "Leadership", "Communication",
  "Project Management", "Figma", "Tailwind", "CI/CD",
  // SAP / GRC domain
  "SAP", "GRC", "SoD", "ARA", "ARM", "BRM", "EAM", "MSMP", "PFCG", "SU24",
  "S/4HANA", "Fiori", "HANA", "ABAP", "Ariba", "Vistex", "SNC",
  "SAP Security", "Access Control", "Role Design", "Authorization",
  // Security / Identity
  "IAM", "SSO", "Identity Management", "SOX", "Compliance", "Audit",
  "Cybersecurity", "Vulnerability Management",
  // Finance
  "Financial Modeling", "Accounting", "Accounts Receivable", "Accounts Payable",
  // PM / Process
  "Scrum", "Kanban", "Jira", "Stakeholder Management",
];

const ACTION_VERBS = [
  "built","created","developed","delivered","led","managed","improved","increased",
  "reduced","optimized","launched","designed","spearheaded","orchestrated","architected",
  "streamlined","automated","implemented","deployed","configured","engineered","drove",
];

const SECTION_KEYWORDS = ["experience","education","skills","summary","projects","certifications"];

export function analyzeResume(resume: string, jobDescription: string): AnalysisResult {
  // Extract skills from JD dynamically (catches domain-specific terms: SAP acronyms, tech stacks, etc.)
  const jdExtracted = extractSkillsFromJD(jobDescription);

  // From static base, include only those present in the JD (semantic match)
  const staticRequested = BASE_SKILLS.filter(s => semanticMatch(s, jobDescription));

  // Combine: JD-extracted first (more specific), then static coverage; deduplicate by synonym group
  const allRequested = deduplicateSkills([...jdExtracted, ...staticRequested])
    .filter(s => s.length > 1);

  // Semantic match against resume
  const matchedSkills = deduplicateSkills(
    allRequested.filter(skill => semanticMatch(skill, resume))
  ).slice(0, 25);

  const missingSkills = deduplicateSkills(
    allRequested.filter(skill => !semanticMatch(skill, resume))
  ).slice(0, 20);

  // Resume stats
  const wordCount = resume.trim().split(/\s+/).filter(Boolean).length;
  const actionVerbs = ACTION_VERBS.filter(v => new RegExp(`\\b${v}\\b`, "i").test(resume)).length;
  const measurableResults = (resume.match(
    /\b\d+(?:\.\d+)?%|\$\s?\d+|\b\d+\+?\s+(?:users|clients|projects|teams|people|customers)\b/gi
  ) ?? []).length;
  const sectionsFound = SECTION_KEYWORDS.filter(s =>
    new RegExp(`\\b${s}\\b`, "i").test(resume)
  ).length;

  // Scoring
  const matchRatio = allRequested.length > 0 ? matchedSkills.length / allRequested.length : 0;
  const skillScore = allRequested.length > 0 ? matchRatio * 75 : 45;
  const qualityScore = Math.min(25, actionVerbs * 2 + measurableResults * 3 + sectionsFound * 2);
  const matchScore = Math.round(Math.min(100, skillScore + qualityScore));
  const strengthScore = Math.round(
    Math.min(100, 25 + sectionsFound * 8 + actionVerbs * 3 + measurableResults * 5 + Math.min(10, wordCount / 60))
  );

  // JD-specific suggestions
  const suggestions: string[] = [];
  if (missingSkills.length > 0) {
    suggestions.push(
      `Add evidence of these JD-required skills where truthful: ${missingSkills.slice(0, 4).join(", ")}.`
    );
  }
  if (measurableResults < 3) {
    suggestions.push("Quantify at least three achievements with percentages, revenue impact, time saved, or scale.");
  }
  if (actionVerbs < 5) {
    suggestions.push("Start more bullets with strong action verbs: Built, Led, Delivered, Spearheaded, Orchestrated.");
  }
  if (sectionsFound < 4) {
    suggestions.push("Add clear ATS-friendly headings: Summary, Skills, Experience, Projects, Education.");
  }
  if (wordCount < 250) {
    suggestions.push("Add specific accomplishments and context — the resume is currently quite brief.");
  }
  if (!suggestions.length) {
    suggestions.push("Strong foundation. Tailor the opening summary and top achievements to this specific role.");
  }

  return {
    matchScore, strengthScore, matchedSkills, missingSkills, suggestions,
    stats: { wordCount, actionVerbs, measurableResults, sectionsFound },
  };
}
