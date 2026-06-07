import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult } from "./analyzer.js";

export interface OptimizedResume {
  candidateName: string;
  summary: string;
  experienceBullets: string[];
  skills: string[];
  fullRewrittenText: string;
}

const weakVerbMap: Record<string, string> = {
  "did": "Delivered",
  "was": "Led",
  "helped": "Supported and drove",
  "worked": "Engineered",
  "assisted": "Spearheaded",
  "supported": "Optimized",
};

function extractCandidateName(resumeText: string): string {
  const lines = resumeText.split("\n").map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] ?? "Candidate";
  const words = firstLine.split(/\s+/).filter(w => /^[A-Z][a-z]+/.test(w));
  return words.slice(0, 3).join(" ") || firstLine.split(/\s+/).slice(0, 2).join(" ") || "Candidate";
}

function ruleBasedRewrite(resumeText: string, jobDescription: string, analysis: AnalysisResult): OptimizedResume {
  const candidateName = extractCandidateName(resumeText);

  // Extract domain keywords from JD
  const jdWords = jobDescription.toLowerCase().split(/\W+/).filter(w => w.length > 4);
  const stopWords = new Set(["the","and","for","with","that","this","have","from","they","will","your","been","more","were","about","their","into"]);
  const domainWords = [...new Set(jdWords.filter(w => !stopWords.has(w)))].slice(0, 5);

  const topSkills = analysis.matchedSkills.slice(0, 3);
  const summary = `Results-driven professional with expertise in ${topSkills.join(", ") || "software development"}. Proven track record in ${domainWords.slice(0,3).join(", ")}. Seeking to leverage ${topSkills.slice(0,2).join(" and ") || "technical skills"} to deliver measurable impact.`;

  // Rewrite experience bullets
  const lines = resumeText.split("\n");
  const bulletLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.startsWith("•") || trimmed.startsWith("-") || /^[A-Z][a-z]+ed\s/.test(trimmed);
  });

  const experienceBullets: string[] = bulletLines.slice(0, 8).map(line => {
    let text = line.trim().replace(/^[•\-]\s*/, "");
    for (const [weak, strong] of Object.entries(weakVerbMap)) {
      const re = new RegExp(`^${weak}\\b`, "i");
      if (re.test(text)) {
        text = text.replace(re, strong);
        break;
      }
    }
    return text;
  });

  // Inject missing skills naturally
  const missing = analysis.missingSkills.slice(0, 3);
  missing.forEach((skill, i) => {
    if (experienceBullets[i]) {
      experienceBullets[i] = `${experienceBullets[i]}, leveraging ${skill}`;
    } else {
      experienceBullets.push(`Built solutions utilizing ${skill} to address business requirements`);
    }
  });

  if (experienceBullets.length === 0) {
    experienceBullets.push("Delivered high-quality software solutions meeting business requirements");
    experienceBullets.push("Collaborated with cross-functional teams to drive project success");
    experienceBullets.push("Optimized system performance and implemented best practices");
  }

  // Skills: union of matched + top from JD
  const jdSkillWords = jobDescription.toLowerCase().match(/\b(javascript|typescript|react|node|python|java|sql|aws|docker|kubernetes|git|graphql|mongodb|postgresql|agile|figma|tailwind)\b/g) ?? [];
  const skills = [...new Set([...analysis.matchedSkills, ...jdSkillWords])];

  const fullRewrittenText = [
    candidateName,
    "",
    "PROFESSIONAL SUMMARY",
    summary,
    "",
    "EXPERIENCE",
    ...experienceBullets.map(b => `• ${b}`),
    "",
    "SKILLS",
    skills.join(", "),
  ].join("\n");

  return { candidateName, summary, experienceBullets, skills, fullRewrittenText };
}

export async function rewriteResume(resumeText: string, jobDescription: string, analysis: AnalysisResult): Promise<OptimizedResume> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return ruleBasedRewrite(resumeText, jobDescription, analysis);
  }

  const client = new Anthropic();
  const prompt = `You are an expert resume writer. Given a resume, job description, and analysis results, rewrite the resume to better match the job.

Resume:
${resumeText.slice(0, 3000)}

Job Description:
${jobDescription.slice(0, 1500)}

Analysis:
- Match Score: ${analysis.matchScore}
- Matched Skills: ${analysis.matchedSkills.join(", ")}
- Missing Skills: ${analysis.missingSkills.join(", ")}

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "candidateName": "First Last",
  "summary": "2-3 sentence professional summary tailored to this role",
  "experienceBullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "skills": ["skill1", "skill2", "skill3"],
  "fullRewrittenText": "Complete rewritten resume as plain text"
}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0] as { type: string; text?: string } | undefined;
    if (!content || content.type !== "text" || !content.text) throw new Error("Unexpected response type");
    const parsed = JSON.parse(content.text) as OptimizedResume;
    return parsed;
  } catch {
    return ruleBasedRewrite(resumeText, jobDescription, analysis);
  }
}
