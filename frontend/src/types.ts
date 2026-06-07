export interface AnalysisResult {
  matchScore: number;
  strengthScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  stats: { wordCount: number; actionVerbs: number; measurableResults: number; sectionsFound: number };
}
