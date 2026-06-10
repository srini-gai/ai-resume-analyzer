// ─── Shared skill normalization, synonym matching, JD extraction ─────────────

export function normalizeSkill(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 \/\.#\+]/g, " ").replace(/\s+/g, " ").trim();
}

// Each inner array is a synonym group — any member matches any other.
const SYNONYM_GROUPS: string[][] = [
  // SAP Security & GRC
  ["sap grc", "sap governance risk compliance", "governance risk compliance", "grc"],
  ["sod", "segregation of duties", "separation of duties"],
  ["ara", "access risk analysis"],
  ["arm", "access request management"],
  ["brm", "business role management", "business roles"],
  ["eam", "emergency access management", "firefighter access", "superuser access"],
  ["msmp", "multi stage multi path", "workflow routing", "multi-stage multi-path"],
  ["pfcg", "profile generator", "sap role management"],
  ["su24", "authorization check maintenance"],
  ["sap security", "sap authorization", "authorization management"],
  ["s4 hana", "s/4hana", "s4hana", "sap s4 hana", "sap s/4hana"],
  ["fiori", "sap fiori", "fiori launchpad"],
  ["sap access control", "grc access control", "access control 12.0"],
  ["ariba", "sap ariba", "ariba procurement"],
  ["bi security", "sap bw", "bw security", "business objects security", "bo security"],
  ["hana db", "sap hana database", "hana security"],
  ["vistex", "sap vistex"],
  ["snc", "secure network communication"],
  ["abap", "sap abap"],
  ["sap ecc", "ecc 6.0", "sap r/3"],
  // Cloud
  ["aws", "amazon web services"],
  ["azure", "microsoft azure", "azure cloud"],
  ["gcp", "google cloud platform", "google cloud"],
  // Frontend
  ["react", "reactjs", "react.js"],
  ["vue", "vuejs", "vue.js"],
  ["angular", "angularjs"],
  ["node.js", "nodejs", "node js"],
  // Backend / data
  ["rest api", "restful api", "rest service", "web services"],
  ["graphql", "graph ql"],
  ["postgresql", "postgres"],
  ["mongodb", "mongo db"],
  ["sql", "t-sql", "pl-sql", "plsql", "oracle sql"],
  // DevOps
  ["ci/cd", "continuous integration", "continuous deployment", "continuous delivery"],
  ["kubernetes", "k8s", "container orchestration"],
  ["docker", "containerization"],
  // PM / Process
  ["agile", "scrum", "kanban", "agile methodology"],
  ["project management", "pmo", "program management", "delivery management"],
  // Security (general)
  ["iam", "identity access management", "identity and access management", "idm", "identity management"],
  ["sso", "single sign on", "single sign-on", "saml"],
  ["sox", "sarbanes oxley", "sox compliance", "sarbanes-oxley"],
  // ML / AI
  ["machine learning", "ml", "deep learning"],
  ["artificial intelligence", "ai", "generative ai"],
  // Finance
  ["accounts receivable", "receivables"],
  ["accounts payable", "payables"],
  ["financial modeling", "financial models", "financial analysis"],
];

// Fast lookup: normalized term → group index
const termToGroupIdx = new Map<string, number>();
for (let i = 0; i < SYNONYM_GROUPS.length; i++) {
  for (const term of SYNONYM_GROUPS[i] ?? []) {
    termToGroupIdx.set(normalizeSkill(term), i);
  }
}

// ─── Semantic match ───────────────────────────────────────────────────────────

export function semanticMatch(term: string, targetText: string): boolean {
  const termNorm = normalizeSkill(term);
  const targetNorm = normalizeSkill(targetText);
  if (termNorm.length < 2) return false;

  if (targetNorm.includes(termNorm)) return true;

  const groupIdx = termToGroupIdx.get(termNorm);
  if (groupIdx !== undefined) {
    return (SYNONYM_GROUPS[groupIdx] ?? []).some(syn => targetNorm.includes(normalizeSkill(syn)));
  }
  return false;
}

// ─── Deduplication by synonym group ──────────────────────────────────────────

export function deduplicateSkills(skills: string[]): string[] {
  const seenGroups = new Set<number>();
  const seenNorm = new Set<string>();
  const result: string[] = [];
  for (const skill of skills) {
    const norm = normalizeSkill(skill);
    if (seenNorm.has(norm)) continue;
    const groupIdx = termToGroupIdx.get(norm);
    if (groupIdx !== undefined && seenGroups.has(groupIdx)) continue;
    seenNorm.add(norm);
    if (groupIdx !== undefined) seenGroups.add(groupIdx);
    result.push(skill);
  }
  return result;
}

// ─── JD skill extraction ──────────────────────────────────────────────────────

const ACRONYM_NOISE = new Set([
  "AND","OR","TO","AN","IN","OF","FOR","THE","ARE","WAS","HAS","NOT","CAN","GET",
  "SET","PUT","USE","NEW","OLD","TOP","KEY","END","NOW","ANY","ALL","ONE","TWO",
  "MAY","LET","BEEN","DONE","MADE","SAID","SEEN","WILL","MUST","HAVE","GOOD",
  "WORK","TEAM","ROLE","YEAR","WITH","FROM","THAT","THIS","SUCH","LIKE","BOTH",
  "WHEN","THEN","THAN","MORE","LESS","MOST","SOME","EACH","ALSO","INTO","UPON",
  "PLUS","HIGH","LEAD","NEXT","OPEN","PART","REAL","SELF","SENT","SURE","TAKE",
]);

const WORD_NOISE = new Set([
  "about","after","also","always","been","being","between","both","came","come",
  "could","does","done","each","else","even","ever","every","from","give","given",
  "have","here","high","into","just","keep","know","large","last","less","like",
  "look","made","make","many","mean","more","most","much","must","need","never",
  "next","note","often","only","open","over","part","past","real","same","self",
  "sent","shall","should","since","some","soon","such","sure","take","than","that",
  "their","them","then","there","they","this","those","through","time","under",
  "until","upon","used","using","very","want","well","were","what","when","where",
  "which","while","will","with","within","without","work","would","year","your",
  "team","good","able","strong","skill","skills","required","years","experience",
  "knowledge","understanding","ability","excellent","proficiency","familiarity",
  "exposure","background","proven","solid","hands","working","plus","bonus",
  "preferred","degree","bachelor","master","field","must","have","should","will",
  "including","following","responsible","position","candidate","requirements",
  "responsibilities","minimum","equivalent","related","relevant","applicable",
  "consultant","analyst","manager","developer","engineer","administrator",
  "specialist","coordinator","director","lead","senior","junior","associate",
  "principal","architect","professional","expert","practitioner","role","level",
]);

export function extractSkillsFromJD(jdText: string): string[] {
  const found: string[] = [];

  // 1. ALL-CAPS and alphanumeric codes: GRC, ARA, ARM, SU24, PFCG
  for (const m of jdText.matchAll(/\b([A-Z][A-Z0-9]{1,7})\b/g)) {
    const tok = m[1] ?? "";
    if (tok && !ACRONYM_NOISE.has(tok) && !/^\d+$/.test(tok)) {
      found.push(tok);
    }
  }

  // 2. Mixed-case technical terms (capital start, mixed case, ≥ 2 uppercase): SoD, DevOps
  for (const m of jdText.matchAll(/\b([A-Z][a-z]{1,4}[A-Z][a-zA-Z]{0,6})\b/g)) {
    const tok = m[1] ?? "";
    if (tok && !WORD_NOISE.has(tok.toLowerCase())) found.push(tok);
  }

  // 3. Multi-word capitalized phrases: "SAP GRC", "Access Control", "S/4HANA Security"
  for (const m of jdText.matchAll(/\b([A-Z][a-zA-Z0-9\/]*(?:\s+[A-Z0-9][a-zA-Z0-9\/]*){1,2})\b/g)) {
    const tok = m[1] ?? "";
    if (!tok) continue;
    const phrase = tok.trim();
    const words = phrase.toLowerCase().split(/\s+/);
    if (words.length <= 3 && !words.every(w => WORD_NOISE.has(w))) {
      found.push(phrase);
    }
  }

  // 4. Known technical terms (single capitalized words in synonym dict)
  for (const m of jdText.matchAll(/\b([A-Z][a-z]{2,12})\b/g)) {
    const tok = m[1] ?? "";
    if (!tok) continue;
    const norm = normalizeSkill(tok);
    if (!WORD_NOISE.has(norm) && termToGroupIdx.has(norm)) {
      found.push(tok);
    }
  }

  // Sort longer phrases first (more specific = preferred in dedup), then deduplicate
  found.sort((a, b) => b.length - a.length);
  return deduplicateSkills(found).filter(s => s.length > 1 && s.length < 60);
}

// ─── Domain detection ─────────────────────────────────────────────────────────

export type Domain =
  | "sap" | "finance" | "cloud" | "ml-data" | "frontend"
  | "backend" | "devops" | "pm" | "security" | "healthcare" | "general";

export function detectDomain(resumeText: string, jdText: string): Domain {
  const combined = (resumeText + " " + jdText).toLowerCase();

  const signals: [Domain, RegExp][] = [
    ["sap",      /\b(sap|grc|hana|fiori|ariba|abap|pfcg|eam|arm|brm|msmp|vistex|s4hana|s\/4hana)\b/g],
    ["finance",  /\b(cpa|cfa|frm|ifrs|gaap|treasury|equity portfolio|accounts receivable|accounts payable|financial modeling|financial analyst|investment banking|asset management)\b/g],
    ["cloud",    /\b(aws|azure|gcp|lambda|terraform|serverless|cloud infrastructure)\b/g],
    ["ml-data",  /\b(machine learning|deep learning|neural|tensorflow|pytorch|scikit|nlp|data science|analytics|tableau|spark|hadoop)\b/g],
    ["frontend", /\b(react|angular|vue|frontend|front-end|html|css|tailwind|nextjs|ux design|figma)\b/g],
    ["backend",  /\b(node|express|django|spring boot|microservices|postgresql|mongodb|redis|graphql)\b/g],
    ["devops",   /\b(devops|ci\/cd|jenkins|ansible|kubernetes|docker|monitoring|observability)\b/g],
    ["pm",       /\b(program manager|programme manager|programme director|pmo|stakeholder management|roadmap|sprint planning|scrum master|jira|safe agile|delivery manager|delivery lead|pi planning|agile transformation|it programme|it program|lead consultant|project director|portfolio manager|change manager)\b/g],
    ["security", /\b(cybersecurity|penetration testing|vulnerability|siem|cissp|cism|cisa|soc analyst|threat modeling)\b/g],
    ["healthcare",/\b(healthcare|hipaa|clinical|ehr|hospital|pharma|biotech|fda|patient data)\b/g],
  ];

  let topDomain: Domain = "general";
  let topScore = 0;
  for (const [domain, re] of signals) {
    const count = (combined.match(re) ?? []).length;
    if (count > topScore) { topScore = count; topDomain = domain; }
  }
  return topDomain;
}

// ─── Domain → certification recommendations ───────────────────────────────────

export const DOMAIN_CERTS: Record<Domain, string[]> = {
  sap: [
    "SAP Certified Technology Associate – SAP Authorization and Auditing for SAP HANA",
    "SAP Certified Application Associate – SAP Access Control 12.0",
    "SAP Certified Technology Associate – SAP S/4HANA System Administration",
    "ISACA CISA – Certified Information Systems Auditor",
    "ISO 27001 Lead Implementer",
  ],
  finance: [
    "CFA – Chartered Financial Analyst",
    "CPA – Certified Public Accountant",
    "FRM – Financial Risk Manager",
    "CAIA – Chartered Alternative Investment Analyst",
    "CFP – Certified Financial Planner",
  ],
  cloud: [
    "AWS Solutions Architect – Associate",
    "AWS Solutions Architect – Professional",
    "Google Cloud Professional Cloud Architect",
    "Microsoft Azure Solutions Architect (AZ-305)",
    "HashiCorp Certified: Terraform Associate",
  ],
  "ml-data": [
    "Google Professional Machine Learning Engineer",
    "AWS Certified Machine Learning – Specialty",
    "TensorFlow Developer Certificate",
    "Databricks Certified Associate Developer for Apache Spark",
    "Tableau Desktop Specialist",
  ],
  frontend: [
    "Meta Frontend Developer Professional Certificate",
    "Google UX Design Certificate",
    "AWS Certified Developer – Associate",
    "Scrum Master Certification (PSM I)",
  ],
  backend: [
    "AWS Certified Developer – Associate",
    "Oracle Certified Professional Java SE",
    "MongoDB Certified Developer Associate",
    "Certified Kubernetes Application Developer (CKAD)",
  ],
  devops: [
    "CKA – Certified Kubernetes Administrator",
    "AWS DevOps Engineer – Professional",
    "HashiCorp Certified: Terraform Associate",
    "Google Professional DevOps Engineer",
    "GitHub Actions Certification",
  ],
  pm: [
    "PMP – Project Management Professional",
    "PMI-ACP – Agile Certified Practitioner",
    "CSM – Certified Scrum Master",
    "PRINCE2 Practitioner",
    "SAFe Agilist (SA) Certification",
  ],
  security: [
    "CISSP – Certified Information Systems Security Professional",
    "CEH – Certified Ethical Hacker",
    "CISM – Certified Information Security Manager",
    "CompTIA Security+",
    "ISACA CISA – Certified Information Systems Auditor",
  ],
  healthcare: [
    "CPHIMS – Certified Professional in Health Informatics and Information Management",
    "HL7 FHIR Certification",
    "RHIA – Registered Health Information Administrator",
    "HIMSS Certified Associate in Healthcare Information and Management Systems",
  ],
  general: [
    "CompTIA IT Fundamentals (ITF+)",
    "Google Project Management Certificate",
    "LinkedIn Learning Path: Technology Fundamentals",
  ],
};
