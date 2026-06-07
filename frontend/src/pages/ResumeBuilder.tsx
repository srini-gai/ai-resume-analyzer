import { useState, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Plus, X, Check } from "lucide-react";
import { ResumePDFDownloadLink } from "../components/pdf/ResumePDF";
import type { OptimizedResume } from "../types";

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
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  summary: string;
  experience: ExperienceEntry[];
  skills: string[];
  education: EducationEntry[];
  certifications: string[];
}

const STEPS = ["Personal Info", "Summary", "Experience", "Skills", "Education", "Preview & Export"];

const SUGGESTION_CHIPS = [
  "Results-driven professional with a track record of delivering impactful solutions",
  "Passionate about leveraging technology to solve complex business challenges",
  "Collaborative leader who thrives in fast-paced, cross-functional environments",
];

const defaultEntry = (): ExperienceEntry => ({
  company: "", role: "", startDate: "", endDate: "", bullets: ["", "", ""],
});
const defaultEdu = (): EducationEntry => ({ institution: "", degree: "", year: "" });

const inputCls = "w-full rounded-xl border border-slate-300 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-slate-800/60 dark:text-white transition";
const labelCls = "block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1";

export default function ResumeBuilder({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<BuilderData>({
    name: "", email: "", phone: "", location: "", linkedin: "", website: "",
    summary: "",
    experience: [defaultEntry()],
    skills: [],
    education: [defaultEdu()],
    certifications: [],
  });
  const [skillInput, setSkillInput] = useState("");
  const [certInput, setCertInput] = useState("");

  const set = <K extends keyof BuilderData>(key: K, val: BuilderData[K]) =>
    setData(d => ({ ...d, [key]: val }));

  const addSkill = (s: string) => {
    const trimmed = s.trim();
    if (trimmed && !data.skills.includes(trimmed)) set("skills", [...data.skills, trimmed]);
    setSkillInput("");
  };
  const removeSkill = (s: string) => set("skills", data.skills.filter(x => x !== s));

  const addCert = (s: string) => {
    const trimmed = s.trim();
    if (trimmed && !data.certifications.includes(trimmed)) set("certifications", [...data.certifications, trimmed]);
    setCertInput("");
  };

  const updateExp = (i: number, field: keyof ExperienceEntry, val: string | [string, string, string]) => {
    const exp = [...data.experience];
    exp[i] = { ...exp[i], [field]: val };
    set("experience", exp);
  };

  const updateEdu = (i: number, field: keyof EducationEntry, val: string) => {
    const edu = [...data.education];
    edu[i] = { ...edu[i], [field]: val };
    set("education", edu);
  };

  const experienceBullets = data.experience.flatMap(e => e.bullets).filter(Boolean);
  const previewData: OptimizedResume = {
    candidateName: data.name || "Your Name",
    layout: { type: "single-column", sectionOrder: ["header","summary","experience","skills","education"], headerStyle: "left-aligned" },
    sections: [
      { type: "summary", originalTitle: "PROFESSIONAL SUMMARY", originalContent: data.summary, rewrittenContent: data.summary, bullets: [], rewrittenBullets: [] },
      { type: "experience", originalTitle: "EXPERIENCE", originalContent: experienceBullets.join("\n"), rewrittenContent: experienceBullets.join("\n"), bullets: experienceBullets, rewrittenBullets: experienceBullets },
      { type: "skills", originalTitle: "SKILLS", originalContent: data.skills.join(", "), rewrittenContent: data.skills.join(", "), bullets: data.skills, rewrittenBullets: data.skills },
      { type: "education", originalTitle: "EDUCATION", originalContent: data.education.map(e => `${e.degree} — ${e.institution} (${e.year})`).join("\n"), rewrittenContent: data.education.map(e => `${e.degree} — ${e.institution} (${e.year})`).join("\n"), bullets: [], rewrittenBullets: [] },
    ],
    summary: data.summary || "Your professional summary will appear here.",
    experienceBullets,
    skills: data.skills,
    fullRewrittenText: [data.name, data.summary, ...experienceBullets].join("\n"),
  };

  const steps = [
    // Step 0: Personal Info
    <div key={0} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {(["name", "email", "phone", "location", "linkedin", "website"] as const).map(field => (
          <div key={field}>
            <label className={labelCls}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
            <input className={inputCls} value={data[field] as string} onChange={e => set(field, e.target.value)} placeholder={field === "linkedin" ? "linkedin.com/in/you" : field === "website" ? "yoursite.com" : ""} />
          </div>
        ))}
      </div>
    </div>,

    // Step 1: Summary
    <div key={1} className="space-y-4">
      <div>
        <label className={labelCls}>Professional Summary</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={6}
          value={data.summary}
          onChange={e => set("summary", e.target.value)}
          placeholder="Write 2-3 sentences about your expertise, accomplishments, and career goals..."
        />
        <div className="mt-1 text-right text-xs text-slate-500">{data.summary.length} characters</div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Suggestions (click to append)</p>
        <div className="flex flex-col gap-2">
          {SUGGESTION_CHIPS.map((chip, i) => (
            <button key={i} onClick={() => set("summary", data.summary + (data.summary ? " " : "") + chip)}
              className="text-left rounded-xl border border-indigo-400/30 bg-indigo-500/5 px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400 transition">
              • {chip}
            </button>
          ))}
        </div>
      </div>
    </div>,

    // Step 2: Experience
    <div key={2} className="space-y-6">
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
            <div><label className={labelCls}>Company</label><input className={inputCls} value={exp.company} onChange={e => updateExp(i, "company", e.target.value)} /></div>
            <div><label className={labelCls}>Role</label><input className={inputCls} value={exp.role} onChange={e => updateExp(i, "role", e.target.value)} /></div>
            <div><label className={labelCls}>Start Date</label><input className={inputCls} value={exp.startDate} onChange={e => updateExp(i, "startDate", e.target.value)} placeholder="Jan 2022" /></div>
            <div><label className={labelCls}>End Date</label><input className={inputCls} value={exp.endDate} onChange={e => updateExp(i, "endDate", e.target.value)} placeholder="Present" /></div>
          </div>
          {([0, 1, 2] as const).map(bi => (
            <div key={bi}>
              <label className={labelCls}>Bullet {bi + 1}</label>
              <input className={inputCls} value={exp.bullets[bi]} onChange={e => {
                const newBullets = [...exp.bullets] as [string, string, string];
                newBullets[bi] = e.target.value;
                updateExp(i, "bullets", newBullets);
              }} placeholder="Delivered X, resulting in Y% improvement..." />
            </div>
          ))}
        </div>
      ))}
      <button onClick={() => set("experience", [...data.experience, defaultEntry()])}
        className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold">
        <Plus size={16} /> Add Experience
      </button>
    </div>,

    // Step 3: Skills
    <div key={3} className="space-y-4">
      <div>
        <label className={labelCls}>Add Skills (press Enter or comma to add)</label>
        <input className={inputCls} value={skillInput} onChange={e => setSkillInput(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillInput); }
          }}
          placeholder="e.g. React, TypeScript, Python..." />
      </div>
      <div className="flex flex-wrap gap-2">
        {data.skills.map(skill => (
          <span key={skill} className="flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            {skill}
            <button onClick={() => removeSkill(skill)} className="hover:text-rose-500 transition"><X size={12} /></button>
          </span>
        ))}
        {data.skills.length === 0 && <p className="text-xs text-slate-500">No skills added yet</p>}
      </div>
    </div>,

    // Step 4: Education + Certifications
    <div key={4} className="space-y-6">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Education</p>
        {data.education.map((edu, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/40 dark:bg-slate-800/40 p-4 mb-3 grid gap-3 sm:grid-cols-3">
            <div><label className={labelCls}>Institution</label><input className={inputCls} value={edu.institution} onChange={e => updateEdu(i, "institution", e.target.value)} /></div>
            <div><label className={labelCls}>Degree</label><input className={inputCls} value={edu.degree} onChange={e => updateEdu(i, "degree", e.target.value)} /></div>
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
            placeholder="AWS Solutions Architect..." />
          <button onClick={() => addCert(certInput)} className="rounded-xl bg-indigo-600 px-4 py-2 text-white text-sm font-semibold hover:bg-indigo-700">Add</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {data.certifications.map(cert => (
            <span key={cert} className="flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400">
              {cert}
              <button onClick={() => set("certifications", data.certifications.filter(c => c !== cert))} className="hover:text-rose-500"><X size={12} /></button>
            </span>
          ))}
        </div>
      </div>
    </div>,

    // Step 5: Preview + Export
    <div key={5} className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/60 dark:bg-slate-800/60 p-6 backdrop-blur-xl shadow-xl">
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{data.name || "Your Name"}</h3>
        <p className="text-xs text-slate-500 mb-4">{data.email} {data.phone && `• ${data.phone}`} {data.location && `• ${data.location}`}</p>
        {data.summary && (
          <div className="mb-4">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Summary</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{data.summary}</p>
          </div>
        )}
        {data.experience.some(e => e.company || e.role) && (
          <div className="mb-4">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Experience</p>
            {data.experience.filter(e => e.company || e.role).map((exp, i) => (
              <div key={i} className="mb-3">
                <p className="text-sm font-bold dark:text-white">{exp.role}{exp.company && ` at ${exp.company}`}</p>
                <p className="text-xs text-slate-500">{exp.startDate}{exp.endDate && ` – ${exp.endDate}`}</p>
                {exp.bullets.filter(Boolean).map((b, j) => <p key={j} className="text-sm text-slate-700 dark:text-slate-300">• {b}</p>)}
              </div>
            ))}
          </div>
        )}
        {data.skills.length > 0 && (
          <div>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map(s => <span key={s} className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs text-indigo-600 dark:text-indigo-400">{s}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="text-center">
        <ResumePDFDownloadLink data={previewData} />
      </div>
    </div>,
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-4">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition">
        <ArrowLeft size={16} /> Back to Analyzer
      </button>

      {/* Progress bar */}
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
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
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
