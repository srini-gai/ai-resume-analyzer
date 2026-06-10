/**
 * analyzer.ts — Phase 1 + Phase 2: Two-pass Claude-powered resume analysis
 *
 * PASS 1 — Skill Extraction (Claude): extracts structured skill inventory
 * PASS 2 — Domain-Specific Scoring (Claude): scores with per-domain rubrics
 * FALLBACK — regex-based logic if no API key or Claude fails
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_VERBS = [
  "built","created","developed","delivered","led","managed","improved",
  "increased","reduced","optimized","launched","designed","spearheaded",
  "orchestrated","architected","streamlined","automated","implemented",
  "deployed","configured","engineered","drove",
];

const SECTION_KEYWORDS = [
  "experience","education","skills","summary","projects","certifications",
];

// ─── JD preprocessor ─────────────────────────────────────────────────────────

function preprocessJD(jd: string): string {
  const headings = [
    "KEY RESPONSIBILITIES","RESPONSIBILITIES","REQUIREMENTS","QUALIFICATIONS",
    "WHAT YOU WILL DO","WHAT WE NEED","NICE TO HAVE","PREFERRED",
    "ABOUT THE ROLE","THE ROLE","JOB DESCRIPTION","OVERVIEW",
    "WHO YOU ARE","BENEFITS","ABOUT US","WHAT YOU BRING","YOUR PROFILE",
  ];
  return jd
    .split("\n")
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      const upper = line.toUpperCase();
      if (headings.some(h => upper.startsWith(h)) && line.length < 60) return false;
      if (/^\d+\.?$/.test(line)) return false;
      return true;
    })
    .join("\n");
}

// ─── Pass 1: Skill extraction ─────────────────────────────────────────────────

async function extractSkillInventory(
  text: string,
  role: "resume" | "jd",
  client: Anthropic
): Promise<SkillInventory> {
  const roleLabel = role === "resume" ? "resume" : "job description";

  const systemPrompt = `You are an expert technical recruiter with deep knowledge across SAP/ERP, Programme Management, Cloud, Data Engineering, BFSI, and Cybersecurity.
Extract a precise structured skill inventory from the text provided.
Return ONLY valid JSON — no markdown, no explanation, no code blocks.`;

  const userPrompt = `Extract a complete skill inventory from this ${roleLabel}.

RULES:
0. IGNORE section headings and structural phrases. Examples to IGNORE:
   - "Key Responsibilities", "Requirements", "Act as the..."
   - Sentences starting with action verbs like "Lead", "Conduct", "Drive" — extract only the skill embedded within them
   - Degree requirements: "Bachelor's in Computer Science" -> extract "Computer Science" only
   - Experience requirements: "10+ years as Security Consultant" -> NOT a skill
1. "explicit" = skills/tools/technologies directly named (e.g. "SAP GRC", "Python", "Ariba Network")
2. "implied" = skills strongly evidenced by context but not stated as a keyword
   Example: "Led S/4HANA cutover for 2,400 users" -> implies: S/4HANA migration, change management, cutover planning
   Example: "Managed £8M programme budget" -> implies: financial governance, budget management, executive reporting
3. Normalise synonyms to canonical form:
   - "Programme Manager" / "Program Manager" -> "Programme Management"
   - "SAP GRC Access Control" / "GRC" / "Access Control 12.0" -> "SAP GRC"
   - "SoD" / "Segregation of Duties" -> "SoD Analysis"
4. Domain: choose ONE based on the candidate's JOB FUNCTION, not their client's industry:
   sap | pm | tpm | cloud | data | devops | security | fintech | ai-strategy | eng-mgmt | finance | healthcare | general
   CRITICAL RULES for domain detection:
   - A Programme Director who worked AT banks = "pm" (their function), NOT "finance" (client industry)
   - A TPM working ON cloud infrastructure = "tpm", NOT "cloud"
   - A Data Engineer working FOR a fintech = "data", NOT "fintech"
   - "finance" = only if the candidate IS a financial analyst, trader, CFO, or finance professional themselves
   - "fintech" = product/strategy/delivery leader at a fintech company (their role is business/product, not engineering)
   - "tpm" = Technical Programme/Project/Product Manager with engineering background managing cross-functional technical programmes
   - "ai-strategy" = AI transformation leader, Chief AI Officer, Head of AI, enterprise AI programme lead
   - "eng-mgmt" = Engineering Manager, Director of Engineering, VP Engineering managing engineering teams
5. Seniority:
   - executive: Director, VP, Programme Director, Head of, C-level, large budget ownership
   - senior: Lead, Senior, Principal, 8+ years, team of 5+, architecture ownership
   - mid: 3-7 years, delivery ownership, some team lead
   - junior: 0-2 years, contributor, associate
6. achievements = measurable outcomes only (must have number, %, currency, or concrete scale)

Return ONLY this JSON:
{
  "explicit": ["skill1", "skill2"],
  "implied": ["skill1", "skill2"],
  "domain": "sap",
  "seniorityLevel": "senior",
  "seniorityEvidence": ["evidence1", "evidence2"],
  "achievements": ["achievement1", "achievement2"]
}

Text:
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

// ─── Phase 2: Domain-specific scoring rubrics ─────────────────────────────────

function getDomainRubric(domain: string, seniorityLevel: string): string {
  const isExecutive = seniorityLevel === "executive" || seniorityLevel === "senior";

  const rubrics: Record<string, string> = {
    sap: `DOMAIN: SAP / ERP
SCORING RULES:
1. Sub-module coverage is CRITICAL — score each separately:
   - ARA (Access Risk Analysis): 15pts if hands-on evidence present
   - ARM (Access Request Management): 15pts if present
   - BRM (Business Role Management): 10pts if present
   - EAM (Emergency Access Management): 10pts if present
   - Generic "SAP GRC" without sub-module detail = 5pts only
2. SAP Ariba roles: Ariba modules (Sourcing, Buying, SLP, Network) are entirely separate from SAP GRC. Cross-credit = 0.
3. SoD ruleset design and remediation with specifics = 10pts
4. Integration security (S/4HANA to Ariba CIG, API-based) = 10pts if evidenced
5. Deduct 10pts if candidate claims SAP experience but no version or module specifics
6. Certifications: SAP Certified AC 12.0, CISA, ISO 27001 = 5pts bonus each (max 10)
STRENGTH SCORING:
- 85+: Deep sub-module coverage, version-specific experience, named clients, project scale
- 70-84: Good module breadth, some specifics, clear progression
- Below 70: Generic SAP claims, no sub-module depth`,

    pm: isExecutive
      ? `DOMAIN: Programme / Project Management — EXECUTIVE TIER
SCORING RULES:
1. Business impact language is the PRIMARY signal. Score on:
   - Budget scale: £/$1M+ programmes = strong signal (10pts)
   - Stakeholder scope: 10+ stakeholders or cross-org programmes (10pts)
   - Delivery outcomes: on-time delivery, cost savings, improvement % (15pts)
   - Transformation programmes: digital, cloud, ERP, platform migrations (10pts)
2. Methodology depth: SAFe, PI Planning, PRINCE2, MSP = 5pts each (max 15)
3. Client-facing consulting: named clients, proposals, SOW ownership = 10pts
4. Domain knowledge matching JD industry (BFSI, Payments, SAP) = 5pts
5. DO NOT score on keyword density. A PM who "led £12M BFSI transformation" outscores one who lists "Agile, Scrum, Kanban, Jira" without delivery evidence.
6. Penalise -10pts if no quantified outcomes present at all
STRENGTH SCORING:
- 85+: Quantified outcomes, executive stakeholder evidence, named clients and programmes
- 70-84: Good delivery evidence, some metrics, clear ownership language
- Below 70: Generic PM language, limited metrics, unclear delivery scope`
      : `DOMAIN: Programme / Project Management
SCORING RULES:
1. Methodology evidence: Agile, Scrum, SAFe, PRINCE2 with project context (15pts)
2. Delivery ownership: end-to-end delivery, not just contribution (15pts)
3. Stakeholder management: named stakeholders, steering committees (10pts)
4. Risk and issue management with specifics (10pts)
5. Tools: Jira, Confluence, MS Project, ADO with hands-on use (5pts each, max 10)
STRENGTH SCORING:
- 85+: Quantified delivery outcomes, clear ownership, methodology depth
- 70-84: Good evidence, some metrics, reasonable structure
- Below 70: Generic language, no metrics, unclear scope`,

    cloud: `DOMAIN: Cloud / DevOps / Infrastructure
SCORING RULES:
1. Service-level specificity — score by tier:
   - Named services (Lambda, EKS, CloudFront, Pub/Sub) = full credit
   - Platform level (AWS, Azure, GCP) without named services = 40% credit
   - Generic "cloud experience" = 10% credit only
2. Architecture ownership: designed vs implemented vs used = full / half / quarter credit
3. IaC tools (Terraform, Pulumi, CDK, Ansible) with scale evidence = 10pts
4. Observability (Datadog, Prometheus, Grafana, CloudWatch) = 8pts
5. Cloud security (IAM, VPC design, WAF, KMS) = 10pts for security roles
6. Production scale: requests/day, SLA %, team size = strong signal
7. Certifications: AWS SA Pro, CKA, GCP Pro = 10pts each (max 20)
STRENGTH SCORING:
- 85+: Named services, architecture ownership, production scale, IaC, observability
- 70-84: Good service breadth, some ownership, production context
- Below 70: Platform-level claims only, no service depth`,

    data: `DOMAIN: Data Engineering / Analytics / ML
SCORING RULES:
1. Production deployment evidence is CRITICAL — "built a model" does not equal "deployed to production"
2. Pipeline ownership: ingestion, transformation, serving, monitoring = 10pts per stage owned
3. Scale evidence: data volume (TB/PB), latency (ms), throughput (events/sec) = strong signal
4. Tool depth:
   - Core (Spark, Airflow, dbt, Kafka, Flink) = 10pts each with project context
   - Warehouse (Snowflake, BigQuery, Redshift, Databricks) = 8pts each
   - Orchestration and monitoring (Prefect, Dagster, Great Expectations) = 6pts each
5. ML roles: distinguish model building from MLOps — deployment, monitoring, retraining pipelines
6. Certifications: Databricks, GCP DE, AWS DE, dbt = 5pts each
STRENGTH SCORING:
- 85+: Production pipelines, scale metrics, full stack ownership, named toolchain
- 70-84: Good tool breadth, some production context, pipeline ownership
- Below 70: Notebook or academic work, limited production evidence`,

    security: `DOMAIN: Cybersecurity / IAM / GRC
SCORING RULES:
1. Specialisation match: IAM, AppSec, SOC, and GRC are distinct — cross-domain = partial credit only
2. Framework coverage: NIST, ISO 27001, SOC2, CIS Controls = 8pts each if implemented (not just aware)
3. Tool specificity: Splunk, CrowdStrike, Qualys, BeyondTrust, SailPoint, Okta = 10pts each
4. Incident response: hands-on IR (not just planning) = 12pts
5. Certifications are heavily weighted:
   - CISSP, CISM = 15pts each
   - CEH, OSCP, GCIH = 10pts each
   - CompTIA Security+, CySA+ = 5pts each
6. Cloud security (AWS Security, Azure Defender, GCP SCC) = 10pts if role-relevant
STRENGTH SCORING:
- 85+: Active certifications, tool depth, named incidents and programmes, compliance delivery
- 70-84: Good framework knowledge, some tool hands-on, clear specialisation
- Below 70: Generic security awareness, no tool depth, no cert specifics`,

    general: `DOMAIN: General / Cross-functional
SCORING RULES:
1. Skill coverage: match explicit JD requirements first, then implied (60% / 40% weight)
2. Experience level matching JD seniority = 15pts
3. Domain relevance: candidate industry matching JD industry = 10pts
4. Quantified achievements: 3 or more = 15pts, 1-2 = 8pts, none = 0pts
5. Progression evidence: promotions, scope growth, increasing responsibility = 10pts
STRENGTH SCORING:
- 85+: Strong action language, 3+ quantified outcomes, clear progression, tailored summary
- 70-84: Good language, 1-2 metrics, reasonable structure
- Below 70: Generic language, no metrics, unclear progression`,

    tpm: `DOMAIN: Technical Programme / Project / Product Management
SCORING RULES:
1. Technical depth is MANDATORY — this is not a pure PM role:
   - Can candidate read/review engineering designs, architecture docs, and system specs? = 15pts
   - Evidence of hands-on technical background (engineering, data, cloud, ML) = 10pts
   - No technical background = cap match score at 60% regardless of PM skills
2. Cross-functional delivery at scale:
   - Drove alignment across 3+ engineering teams or orgs = 12pts
   - Managed dependencies between teams without direct authority = 10pts
   - OKR/KPI definition and tracking with evidence = 8pts
3. For AI/MLOps TPM roles specifically:
   - MLOps pipeline delivery (training, inference, monitoring) = 15pts
   - ML infrastructure programme management = 12pts
   - AI governance, responsible AI, policy-driven automation = 10pts
   - Cloud reliability/SRE programme context = 8pts
4. Stakeholder influence without authority: evidence of influencing engineers and engineering leads = 10pts
5. Tools: ADO, Jira, Confluence, OKR frameworks, RAID logs with hands-on use = 5pts (max 10)
6. Certifications: PMP, SAFe, AWS/Azure with technical context = 5pts each (max 10)
STRENGTH SCORING:
- 85+: Technical background + PM delivery + quantified programme outcomes + cross-org influence evidence
- 70-84: Good technical awareness, solid delivery record, some cross-team scope
- 55-69: PM skills without technical depth, or technical skills without programme delivery ownership
- Below 55: Pure PM with no technical signals, or pure IC engineer with no delivery leadership`,

    fintech: `DOMAIN: Fintech / Financial Services — Director / Head / Senior Manager
SCORING RULES:
1. Regulatory and compliance awareness is a DIFFERENTIATOR:
   - Named regulations with implementation experience: FCA, PSD2, PCI-DSS, Basel III, GDPR, AML = 10pts each (max 20)
   - Audit and assurance delivery (internal, external, regulator-facing) = 10pts
   - Risk frameworks (operational, credit, market) = 8pts
2. Product and commercial ownership:
   - P&L ownership with scale (£/$Xm revenue, cost base) = 15pts
   - Product delivery end-to-end (ideation to live) = 12pts
   - Commercial partnerships, vendor negotiation, contract ownership = 8pts
3. Payment domain specifics (for payment roles):
   - Named rails: SWIFT, SEPA, Faster Payments, CHAPS, UPI, VISA/MC schemes = 10pts each relevant
   - Core banking or payment platform modernisation = 12pts
   - Open banking / API-first architecture = 8pts
4. Transformation delivery at fintech scale:
   - Digital transformation with user/revenue impact = 12pts
   - Regulatory programme delivery on deadline = 10pts
   - Platform migration or core system replacement = 10pts
5. Seniority signals for fintech: ExCo or Board reporting, P&L ownership, team of 10+, budget ownership = 10pts
STRENGTH SCORING:
- 85+: Named regulations, P&L ownership, payment domain depth, transformation outcomes, ExCo exposure
- 70-84: Good regulatory awareness, product ownership, some commercial evidence
- 55-69: Financial services experience but limited regulatory or product depth
- Below 55: Generic management without fintech domain signals`,

    "ai-strategy": `DOMAIN: AI Strategy / AI Transformation Leader
SCORING RULES:
1. Strategic framing is PRIMARY — this is not a hands-on ML engineering role:
   - Build vs buy decisions with business rationale = 12pts
   - AI vendor selection and evaluation (OpenAI, Anthropic, AWS Bedrock, Azure AI) = 10pts
   - ROI framing: cost savings, productivity gains, revenue impact from AI = 15pts
   - Board or C-suite AI strategy communication = 10pts
2. Transformation delivery:
   - Enterprise-wide AI adoption programme (not just a pilot) = 15pts
   - Change management for AI tools across a workforce = 10pts
   - AI governance framework design (responsible AI, ethics, bias, auditability) = 10pts
3. Technical credibility (required but not the primary score driver):
   - Understands LLMs, RAG, fine-tuning, agents conceptually = 8pts
   - Has shipped at least one AI/ML product to production = 10pts
   - Can translate between business and engineering teams = 8pts
4. Domain-specific AI delivery (scores higher if matches JD):
   - BFSI AI (fraud, credit risk, AML automation) = 10pts for BFSI roles
   - Customer experience AI (chatbots, personalisation, CX automation) = 8pts
   - Operational AI (process automation, predictive maintenance, quality) = 8pts
5. Penalise if: only hands-on ML/data science without leadership evidence (-10pts)
   or only strategy without any AI delivery evidence (-10pts)
STRENGTH SCORING:
- 85+: Enterprise AI programme delivered, ROI quantified, C-suite exposure, governance framework, technical credibility
- 70-84: Good AI strategy evidence, some delivery, business impact framing
- 55-69: AI awareness without delivery, or delivery without strategic framing
- Below 55: Generic digital transformation without AI specifics`,

    "eng-mgmt": `DOMAIN: Engineering Management — Manager / Senior Manager / Director of Engineering
SCORING RULES:
1. People leadership is PRIMARY — this is not an IC (individual contributor) role:
   - Team size managed directly: 5-10 = 8pts, 10-20 = 12pts, 20+ = 15pts
   - Hiring and org building: grew team from X to Y = 10pts
   - Performance management, career development, attrition evidence = 8pts
   - Created a high-performing team culture with measurable evidence = 8pts
2. Technical credibility (mandatory floor — cap at 55% without it):
   - Strong prior IC engineering background (software, data, infrastructure) = 10pts
   - Can conduct technical design reviews and make architecture calls = 10pts
   - Drives technical strategy and roadmap (not just delivery of tickets) = 12pts
3. Delivery leadership:
   - Shipped products or platforms at scale with named outcomes = 12pts
   - Cross-team programme delivery with dependencies managed = 10pts
   - Incident management, reliability ownership, SLA accountability = 8pts
4. Strategic signals for Director-level roles:
   - Engineering org design (team topology, platform vs product split) = 10pts
   - Budget ownership and headcount planning = 8pts
   - Executive stakeholder management and board-level reporting = 8pts
5. Tools and process: SDLC ownership, ADO/Jira at org level, engineering KPIs = 5pts each (max 10)
STRENGTH SCORING:
- 85+: Large team led, technical depth, shipped products, org design evidence, executive exposure
- 70-84: Good team leadership, solid technical background, delivery evidence
- 55-69: Technical depth without leadership breadth, or leadership without technical credibility
- Below 55: IC background only, no people management signals`,
  };

  return (rubrics[domain] ?? rubrics["general"]) as string;
}

// ─── Pass 2: Domain-aware scoring ────────────────────────────────────────────

async function scoreCandidateFit(
  resumeInventory: SkillInventory,
  jdInventory: SkillInventory,
  resumeText: string,
  client: Anthropic
): Promise<ScoringResult> {
  const scoringDomain = jdInventory.domain !== "general"
    ? jdInventory.domain
    : resumeInventory.domain;
  const domainRubric = getDomainRubric(scoringDomain, resumeInventory.seniorityLevel);

  const systemPrompt = `You are a senior technical recruiter and domain expert. Score resume-to-job-description fit using the domain rubric below.

${domainRubric}

UNIVERSAL CALIBRATION (apply after domain scoring):
- 85-100: Near-perfect fit. Strong evidence across almost all requirements.
- 70-84: Good fit. Meets most requirements, minor gaps, strong candidacy.
- 55-69: Moderate fit. Core requirements met but meaningful gaps exist.
- 40-54: Partial fit. Some alignment but significant gaps.
- Below 40: Weak fit. Fundamental mismatch.

STRENGTH SCORE = resume quality independent of JD:
- 85+: Executive-level writing, quantified outcomes, clear progression, specific client/programme context
- 70-84: Good writing, some metrics, action verbs, well structured
- 55-69: Average, some action verbs, limited metrics
- Below 55: Weak language, passive voice, no metrics

Return ONLY valid JSON.`;

  const userPrompt = `Score this candidate using the domain rubric provided.

ROLE REQUIREMENTS:
- Domain: ${jdInventory.domain}
- Seniority expected: ${jdInventory.seniorityLevel}
- Required skills (explicit): ${jdInventory.explicit.slice(0, 20).join(", ")}
- Required skills (implied): ${jdInventory.implied.slice(0, 10).join(", ")}

CANDIDATE PROFILE:
- Domain: ${resumeInventory.domain}
- Seniority: ${resumeInventory.seniorityLevel}
- Seniority evidence: ${resumeInventory.seniorityEvidence.slice(0, 4).join("; ")}
- Skills (explicit): ${resumeInventory.explicit.slice(0, 25).join(", ")}
- Skills (implied): ${resumeInventory.implied.slice(0, 15).join(", ")}
- Quantified achievements: ${resumeInventory.achievements.slice(0, 6).join("; ")}

Resume opening (quality signal):
${resumeText.slice(0, 600)}

Return this exact JSON:
{
  "matchScore": 72,
  "strengthScore": 78,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "suggestions": [
    "Specific suggestion referencing actual gap in THIS resume vs THIS JD",
    "Specific suggestion 2",
    "Specific suggestion 3"
  ],
  "scoringRationale": "2-3 sentences explaining match score using domain-specific reasoning"
}

SUGGESTION RULES:
- 3 to 5 suggestions, each referencing a specific skill or section from this actual resume
- For executive/senior: frame as impact language improvements, not keyword additions
- For technical roles: name the exact missing tool and why it matters for this role
- Never write generic advice like "add action verbs" or "quantify your achievements"`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1800,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = (message.content[0] as { type: string; text?: string })?.text ?? "{}";
  const clean = raw.replace(/```(?:json)?/gi, "").trim();
  return JSON.parse(clean) as ScoringResult;
}

// ─── Resume stats ─────────────────────────────────────────────────────────────

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

// ─── Fallback: regex-based analysis ──────────────────────────────────────────

const BASE_SKILLS = [
  "JavaScript","TypeScript","React","Node.js","Python","Java","SQL",
  "AWS","Azure","Docker","Kubernetes","Git","REST API","MongoDB",
  "PostgreSQL","Machine Learning","Agile","Leadership","Project Management",
  "SAP","GRC","SoD","ARA","ARM","BRM","EAM","MSMP","PFCG","SU24",
  "S/4HANA","Fiori","HANA","ABAP","Ariba","SAP Security",
  "IAM","SSO","SOX","Cybersecurity",
  "Scrum","Kanban","Jira","Stakeholder Management","Programme Management",
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
  const qualityScore = Math.min(25,
    stats.actionVerbs * 2 + stats.measurableResults * 3 + stats.sectionsFound * 2
  );
  const matchScore = Math.round(Math.min(100, skillScore + qualityScore));
  const strengthScore = Math.round(Math.min(100,
    25 + stats.sectionsFound * 8 + stats.actionVerbs * 3 +
    stats.measurableResults * 5 + Math.min(10, stats.wordCount / 60)
  ));

  const suggestions: string[] = [];
  if (missingSkills.length > 0) {
    suggestions.push(`Add evidence of these required skills where truthful: ${missingSkills.slice(0, 4).join(", ")}.`);
  }
  if (stats.measurableResults < 3) {
    suggestions.push("Quantify at least three achievements with percentages, revenue impact, or scale.");
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
    console.warn("[analyzer] No ANTHROPIC_API_KEY — using fallback");
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

    console.log("[analyzer] Pass 2: domain-specific scoring...");
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
    console.error("[analyzer] Claude passes failed, falling back:", err);
    return fallbackAnalyze(resume, jobDescription);
  }
}

// ─── Sync fallback export (v1 endpoint and PDF download) ─────────────────────
export function analyzeResumeSync(resume: string, jobDescription: string): AnalysisResult {
  return fallbackAnalyze(resume, jobDescription);
}
