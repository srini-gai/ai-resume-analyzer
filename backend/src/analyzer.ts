export interface AnalysisResult {
  matchScore: number;
  strengthScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  stats: { wordCount: number; actionVerbs: number; measurableResults: number; sectionsFound: number };
}

const skills = [
  "javascript", "typescript", "react", "node.js", "express", "python", "java", "sql",
  "aws", "azure", "docker", "kubernetes", "git", "rest api", "graphql", "mongodb",
  "postgresql", "machine learning", "data analysis", "agile", "leadership", "communication",
  "project management", "figma", "tailwind", "ci/cd"
];
const verbs = ["built", "created", "developed", "delivered", "led", "managed", "improved", "increased", "reduced", "optimized", "launched", "designed"];
const sections = ["experience", "education", "skills", "summary", "projects"];

const hasTerm = (text: string, term: string) =>
  new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "i").test(text);

export function analyzeResume(resume: string, jobDescription: string): AnalysisResult {
  const resumeLower = resume.toLowerCase();
  const jobLower = jobDescription.toLowerCase();
  const requested = skills.filter((skill) => hasTerm(jobLower, skill));
  const matchedSkills = requested.filter((skill) => hasTerm(resumeLower, skill));
  const missingSkills = requested.filter((skill) => !hasTerm(resumeLower, skill));
  const wordCount = resume.trim().split(/\s+/).filter(Boolean).length;
  const actionVerbs = verbs.filter((verb) => hasTerm(resumeLower, verb)).length;
  const measurableResults = (resume.match(/\b\d+(?:\.\d+)?%|\$\s?\d+|\b\d+\+?\s+(?:users|clients|projects|teams|people|customers)\b/gi) ?? []).length;
  const sectionsFound = sections.filter((section) => hasTerm(resumeLower, section)).length;
  const skillScore = requested.length ? (matchedSkills.length / requested.length) * 75 : 45;
  const qualityScore = Math.min(25, actionVerbs * 2 + measurableResults * 3 + sectionsFound * 2);
  const matchScore = Math.round(Math.min(100, skillScore + qualityScore));
  const strengthScore = Math.round(Math.min(100, 25 + sectionsFound * 8 + actionVerbs * 3 + measurableResults * 5 + Math.min(10, wordCount / 60)));

  const suggestions: string[] = [];
  if (missingSkills.length) suggestions.push(`Add evidence of relevant skills where truthful: ${missingSkills.slice(0, 5).join(", ")}.`);
  if (measurableResults < 3) suggestions.push("Quantify at least three achievements with percentages, revenue, time saved, or scale.");
  if (actionVerbs < 5) suggestions.push("Start more experience bullets with strong action verbs such as Built, Led, Improved, or Delivered.");
  if (sectionsFound < 4) suggestions.push("Use clear ATS-friendly headings: Summary, Skills, Experience, Projects, and Education.");
  if (wordCount < 250) suggestions.push("Add specific accomplishments and context; the resume is currently quite brief.");
  if (wordCount > 900) suggestions.push("Trim older or less relevant details to keep the resume focused.");
  if (!suggestions.length) suggestions.push("Strong foundation. Tailor the opening summary and top achievements to this specific role.");

  return { matchScore, strengthScore, matchedSkills, missingSkills, suggestions, stats: { wordCount, actionVerbs, measurableResults, sectionsFound } };
}
