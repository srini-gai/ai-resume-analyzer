export interface AnalysisResult {
  matchScore: number;
  strengthScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  stats: { wordCount: number; actionVerbs: number; measurableResults: number; sectionsFound: number };
}

export interface OptimizedResume {
  candidateName: string;
  summary: string;
  experienceBullets: string[];
  skills: string[];
  fullRewrittenText: string;
}

export interface GapSkillRow {
  skill: string;
  required: boolean;
  present: boolean;
  category: 'matched' | 'missing' | 'bonus' | 'not-required';
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
