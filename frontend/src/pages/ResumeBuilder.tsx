import { useState, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Plus, X, Check, Sparkles, Loader2 } from "lucide-react";
import { MeridianViewer, MeridianDownloadLink } from "../components/pdf/MeridianPDF";
import type { MeridianData, SkillCategory } from "../components/pdf/MeridianPDF";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExperienceEntry {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  bullets: [string, string, string];
}

interface EducationEntry {
  institution: string;
  degree: string;
  year: string;
}

interface BuilderData {
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  summary: string;
  experience: ExperienceEntry[];
  skillCategories: SkillCategory[];
  education: EducationEntry[];
  certifications: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["Personal Info", "Summary", "Experience", "Skills", "Education & Certs", "Preview & Export"];

const SKILL_CATEGORY_LABELS = [
  "Technical Skills", "Domain Skills", "Tools & Platforms", "Soft Skills",
] as const;

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const defaultEntry = (): ExperienceEntry => ({
  company: "", role: "", startDate: "", endDate: "", bullets: ["", "", ""],
});
const defaultEdu = (): EducationEntry => ({ institution: "", degree: "", year: "" });
const defaultCategories = (): SkillCategory[] =>
  SKILL_CATEGORY_LABELS.map(label => ({ label, skills: [] }));

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white/60 px-4 py-2.5 text-sm outline-none " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 " +
  "dark:bg-slate-800/60 dark:text-white transition";
const labelCls = "block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1";

// ─── AI-assist helpers ────────────────────────────────────────────────────────

async function fetchAiSummary(
  name: string, jobTitle: string,
  experience: ExperienceEntry[], categories: SkillCategory[]
): Promise<string> {
  const skills = categories.flatMap(c => c.skills).slice(0, 8);
  const res = await fetch(`${apiUrl}/api/v2/ai-assist/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, currentRole: jobTitle, experience, skills }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json() as { summary: string };
  return json.summary ?? "";
}

async function fetchAiBullet(bullet: string, role: string, company: string): Promise<string> {
  const res = await fetch(`${apiUrl}/api/v2/ai-assist/bullet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bullet, role, company }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json() as { improved: string };
  return json.improved ?? bullet;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResumeBuilder({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<BuilderData>({
    name: "", jobTitle: "", email: "", phone: "",
    location: "", linkedin: "", website: "",
    summary: "",
    experience: [defaultEntry()],
    skillCategories: defaultCategories(),
    education: [defaultEdu()],
    certifications: [],
  });

  // Per-category skill inputs
  const [catInputs, setCatInputs] = useState<string[]>(["", "", "", ""]);
  const [certInput, setCertInput] = useState("");

  // AI loading states
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [rewritingBullet, setRewritingBullet] = useState<string | null>(null); // "expIdx-bulletIdx"
  const [bulletError, setBulletError] = useState("");

  // ─ State helpers ────────────────────────────────────────────────────────────

  const set = <K extends keyof BuilderData>(key: K, val: BuilderData[K]) =>
    setData(d => ({ ...d, [key]: val }));

  const updateExp = (i: number, field: keyof ExperienceEntry, val: string | [string, string, string]) => {
    const exp = [...data.experience];
    exp[i] = { ...exp[i], [field]: val } as ExperienceEntry;
    set("experience", exp);
  };

  const updateEdu = (i: number, field: keyof EducationEntry, val: string) => {
    const edu = [...data.education];
    edu[i] = { ...edu[i], [field]: val };
    set("education", edu);
  };

  const addSkillToCategory = (catIdx: number) => {
    const val = catInputs[catIdx]?.trim() ?? "";
    if (!val) return;
    const cats = data.skillCategories.map((c, i) =>
      i === catIdx && !c.skills.includes(val) ? { ...c, skills: [...c.skills, val] } : c
    );
    set("skillCategories", cats);
    setCatInputs(prev => prev.map((v, i) => (i === catIdx ? "" : v)));
  };

  const removeSkillFromCategory = (catIdx: number, skill: string) => {
    const cats = data.skillCategories.map((c, i) =>
      i === catIdx ? { ...c, skills: c.skills.filter(s => s !== skill) } : c
    );
    set("skillCategories", cats);
  };

  const addCert = (s: string) => {
    const t = s.trim();
    if (t && !data.certifications.includes(t)) set("certifications", [...data.certifications, t]);
    setCertInput("");
  };

  // ─ AI actions ───────────────────────────────────────────────────────────────

  const handleAiSummary = async () => {
    setSummarizing(true); setSummaryError("");
    try {
      const text = await fetchAiSummary(data.name, data.jobTitle, data.experience, data.skillCategories);
      set("summary", text);
    } catch {
      setSummaryError("AI assist unavailable — please check your connection or API key.");
    } finally { setSummarizing(false); }
  };

  const handleAiBullet = async (expIdx: number, bulletIdx: number) => {
    const key = `${expIdx}-${bulletIdx}`;
    const exp = data.experience[expIdx];
    if (!exp) return;
    const bullet = exp.bullets[bulletIdx];
    if (!bullet?.trim()) { setBulletError("Enter a bullet first."); return; }
    setRewritingBullet(key); setBulletError("");
    try {
      const improved = await fetchAiBullet(bullet, exp.role, exp.company);
      const newBullets = [...exp.bullets] as [string, string, string];
      newBullets[bulletIdx] = improved;
      updateExp(expIdx, "bullets", newBullets);
    } catch {
      setBulletError("AI assist unavailable. Try again or edit manually.");
    } finally { setRewritingBullet(null); }
  };

  // ─ Derived PDF data ──────────────────────────────────────────────────────────

  const meridianData: MeridianData = {
    name: data.name || "Your Name",
    jobTitle: data.jobTitle,
    email: data.email, phone: data.phone,
    location: data.location, linkedin: data.linkedin, website: data.website,
    summary: data.summary,
    experience: data.experience,
    skillCategories: data.skillCategories,
    education: data.education,
    certifications: data.certifications,
  };

  const pdfFilename = `${(data.name || "Resume").replace(/\s+/g, "_")}_ResumeIQ.pdf`;

  // ─ Step panels ──────────────────────────────────────────────────────────────

  const steps = [

    // ── STEP 0: Personal Info ──────────────────────────────────────────────────
    <div key={0} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Full Name</label>
          <input className={inputCls} value={data.name} onChange={e => set("name", e.target.value)} placeholder="Udayakumar Palli" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Job Title / Headline</label>
          <input className={inputCls} value={data.jobTitle} onChange={e => set("jobTitle", e.target.value)} placeholder="SAP Security Consultant  |  21 Years Experience" />
        </div>
        {(["email", "phone", "location", "linkedin", "website"] as const).map(field => (
          <div key={field}>
            <label className={labelCls}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
            <input className={inputCls} value={data[field]} onChange={e => set(field, e.target.value)}
              placeholder={field === "linkedin" ? "linkedin.com/in/you" : field === "website" ? "yoursite.com" : ""} />
          </div>
        ))}
      </div>
    </div>,

    // ── STEP 1: Summary ────────────────────────────────────────────────────────
    <div key={1} className="space-y-4">
      <div>
        <label className={labelCls}>Professional Summary</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={6}
          value={data.summary}
          onChange={e => set("summary", e.target.value)}
          placeholder="Results-driven professional with proven expertise in… 2–3 sentences."
        />
        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
          <span>{data.summary.length} characters</span>
        </div>
      </div>

      {/* AI-assist button */}
      <div className="space-y-2">
        <button
          onClick={handleAiSummary}
          disabled={summarizing}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {summarizing
            ? <><Loader2 size={14} className="animate-spin" /> Writing…</>
            : <><Sparkles size={14} /> ✦ Write with AI</>}
        </button>
        {summaryError && <p className="text-xs text-rose-500">{summaryError}</p>}
        <p className="text-xs text-slate-500">AI will draft a 3-sentence summary based on your name, role, and entered experience.</p>
      </div>
    </div>,

    // ── STEP 2: Experience ─────────────────────────────────────────────────────
    <div key={2} className="space-y-6">
      {bulletError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:border-rose-800">
          {bulletError}
        </div>
      )}
      {data.experience.map((exp, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/40 dark:bg-slate-800/40 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Experience {i + 1}</span>
            {data.experience.length > 1 && (
              <button onClick={() => set("experience", data.experience.filter((_, j) => j !== i))} className="text-rose-500 hover:text-rose-600">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Role Title</label>
              <input className={inputCls} value={exp.role} onChange={e => updateExp(i, "role", e.target.value)} placeholder="SAP Security Consultant" />
            </div>
            <div>
              <label className={labelCls}>Company</label>
              <input className={inputCls} value={exp.company} onChange={e => updateExp(i, "company", e.target.value)} placeholder="Infosys" />
            </div>
            <div>
              <label className={labelCls}>Start Date</label>
              <input className={inputCls} value={exp.startDate} onChange={e => updateExp(i, "startDate", e.target.value)} placeholder="Jan 2018" />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input className={inputCls} value={exp.endDate} onChange={e => updateExp(i, "endDate", e.target.value)} placeholder="Present" />
            </div>
          </div>
          {([0, 1, 2] as const).map(bi => {
            const bulletKey = `${i}-${bi}`;
            const isRewriting = rewritingBullet === bulletKey;
            return (
              <div key={bi}>
                <label className={labelCls}>Bullet {bi + 1}</label>
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    value={exp.bullets[bi]}
                    onChange={e => {
                      const newBullets = [...exp.bullets] as [string, string, string];
                      newBullets[bi] = e.target.value;
                      updateExp(i, "bullets", newBullets);
                    }}
                    placeholder="Implemented SAP GRC Access Control 12.0, reducing risk exposure by…"
                  />
                  <button
                    onClick={() => { void handleAiBullet(i, bi); }}
                    disabled={isRewriting || !exp.bullets[bi]?.trim()}
                    title="✦ Rewrite bullet with AI"
                    className="shrink-0 flex items-center justify-center rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-2.5 text-indigo-600 hover:bg-indigo-500/20 disabled:opacity-40 transition"
                  >
                    {isRewriting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <button
        onClick={() => set("experience", [...data.experience, defaultEntry()])}
        className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold"
      >
        <Plus size={16} /> Add Experience
      </button>
    </div>,

    // ── STEP 3: Skills ─────────────────────────────────────────────────────────
    <div key={3} className="space-y-5">
      <p className="text-xs text-slate-500">Add skills into each category. They'll appear in a grouped grid on your resume.</p>
      {data.skillCategories.map((cat, catIdx) => (
        <div key={catIdx} className="rounded-2xl border border-white/10 bg-white/40 dark:bg-slate-800/40 p-4 space-y-3">
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{cat.label}</p>
          <div className="flex gap-2">
            <input
              className={`${inputCls} flex-1`}
              value={catInputs[catIdx] ?? ""}
              placeholder={catIdx === 0 ? "e.g. SAP GRC, Python, React…" : catIdx === 1 ? "e.g. Risk Management, Compliance…" : catIdx === 2 ? "e.g. Docker, Jira, GitHub…" : "e.g. Leadership, Communication…"}
              onChange={e => setCatInputs(prev => prev.map((v, i) => (i === catIdx ? e.target.value : v)))}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkillToCategory(catIdx); }
              }}
            />
            <button
              onClick={() => addSkillToCategory(catIdx)}
              className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-white text-xs font-semibold hover:bg-indigo-700"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cat.skills.map(skill => (
              <span key={skill} className="flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                {skill}
                <button onClick={() => removeSkillFromCategory(catIdx, skill)} className="hover:text-rose-500 transition"><X size={11} /></button>
              </span>
            ))}
            {cat.skills.length === 0 && <p className="text-xs text-slate-400">No {cat.label.toLowerCase()} added yet</p>}
          </div>
        </div>
      ))}
    </div>,

    // ── STEP 4: Education + Certifications ────────────────────────────────────
    <div key={4} className="space-y-6">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Education</p>
        {data.education.map((edu, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/40 dark:bg-slate-800/40 p-4 mb-3 grid gap-3 sm:grid-cols-3">
            <div><label className={labelCls}>Institution</label><input className={inputCls} value={edu.institution} onChange={e => updateEdu(i, "institution", e.target.value)} /></div>
            <div><label className={labelCls}>Degree / Qualification</label><input className={inputCls} value={edu.degree} onChange={e => updateEdu(i, "degree", e.target.value)} /></div>
            <div><label className={labelCls}>Year</label><input className={inputCls} value={edu.year} onChange={e => updateEdu(i, "year", e.target.value)} placeholder="2020" /></div>
          </div>
        ))}
        <button onClick={() => set("education", [...data.education, defaultEdu()])} className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold">
          <Plus size={16} /> Add Education
        </button>
      </div>
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Certifications</p>
        <div className="flex gap-2">
          <input className={`${inputCls} flex-1`} value={certInput} onChange={e => setCertInput(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); addCert(certInput); } }}
            placeholder="SAP Certified Technology Associate…" />
          <button onClick={() => addCert(certInput)} className="rounded-xl bg-indigo-600 px-4 py-2 text-white text-sm font-semibold hover:bg-indigo-700">Add</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {data.certifications.map(cert => (
            <span key={cert} className="flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400">
              {cert}
              <button onClick={() => set("certifications", data.certifications.filter(c => c !== cert))} className="hover:text-rose-500"><X size={11} /></button>
            </span>
          ))}
        </div>
      </div>
    </div>,

    // ── STEP 5: Preview & Export ───────────────────────────────────────────────
    <div key={5} className="space-y-5">
      <p className="text-xs text-slate-500">Live 2-page A4 preview. Scroll inside the viewer to see page 2.</p>
      <div className="rounded-2xl overflow-hidden border border-slate-300/50 dark:border-white/10 shadow-xl">
        <MeridianViewer data={meridianData} />
      </div>
      <div className="flex justify-center pt-2">
        <MeridianDownloadLink data={meridianData} filename={pdfFilename} />
      </div>
    </div>,
  ];

  // ─ Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-4">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition">
        <ArrowLeft size={16} /> Back to Analyzer
      </button>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
          <span>{STEPS[step]}</span>
          <span>Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
          <motion.div
            className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
        <div className="flex gap-1 mt-3">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`flex-1 py-1 rounded-full text-xs font-semibold transition ${i === step ? "bg-indigo-600 text-white" : i < step ? "bg-indigo-200 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" : "bg-slate-200 text-slate-500 dark:bg-slate-700"}`}>
              {i < step ? <Check size={10} className="mx-auto" /> : i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="rounded-3xl border border-white/10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl p-6 mb-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-5">{STEPS[step]}</h2>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-white/10 px-5 py-3 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <ArrowLeft size={16} /> Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={() => setStep(s => s + 1)} className="ml-auto flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:brightness-110 transition">
            Next <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
