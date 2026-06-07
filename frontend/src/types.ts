export interface AnalysisResult {
  matchScore: number;
  strengthScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  stats: { wordCount: number; actionVerbs: number; measurableResults: number; sectionsFound: number };
}

// ─── Resume structure types ───────────────────────────────────────────────────

export type LayoutType = "single-column" | "two-column" | "executive";
export type SectionType =
  | "header"
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "certifications"
  | "projects"
  | "other";

export interface ResumeSection {
  type: SectionType;
  originalTitle: string;       // exact heading text from the resume
  originalContent: string;     // raw original content block
  rewrittenContent: string;    // optimised content (same structure, better words)
  bullets: string[];           // individual bullet items (empty if not a bullet section)
  rewrittenBullets: string[];  // rewritten bullet items
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
  // Flat fields kept for backward compat
  summary: string;
  experienceBullets: string[];
  skills: string[];
  fullRewrittenText: string;
}

// ─── Gap analysis types ───────────────────────────────────────────────────────

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

export interface V2AnalysisResult extends AnalysisResult {
  optimizedResume: OptimizedResume;
  gapAnalysis: GapAnalysis;
}
