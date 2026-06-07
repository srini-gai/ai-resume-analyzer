import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileSearch, LoaderCircle, ShieldCheck, Sparkles, UploadCloud, X } from "lucide-react";
import { GlassCard } from "./components/GlassCard";
import { Results } from "./components/Results";
import { ThemeToggle } from "./components/ThemeToggle";
import type { AnalysisResult } from "./types";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function App() {
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const selectFile = (candidate?: File) => {
    setError("");
    if (!candidate) return;
    if (candidate.type !== "application/pdf") return setError("Please upload a PDF resume.");
    if (candidate.size > 5 * 1024 * 1024) return setError("PDF must be smaller than 5MB.");
    setFile(candidate);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setResult(null);
    if (!file) return setError("Choose your resume PDF first.");
    if (jobDescription.trim().length < 40) return setError("Add a job description of at least 40 characters.");
    setLoading(true);
    try {
      const body = new FormData(); body.append("resume", file); body.append("jobDescription", jobDescription);
      const response = await fetch(`${apiUrl}/api/analyze`, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Analysis failed.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect to the analyzer API."); }
    finally { setLoading(false); }
  };
  return (
    <main className="min-h-screen overflow-hidden bg-slate-100 text-slate-950 transition-colors dark:bg-[#070b18] dark:text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(99,102,241,.18),transparent_35%),radial-gradient(circle_at_80%_25%,rgba(14,165,233,.12),transparent_30%)]" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6"><div className="flex items-center gap-2 font-bold"><span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white"><FileSearch size={20} /></span>ResumeIQ</div><ThemeToggle dark={dark} toggle={() => setDark(!dark)} /></header>
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-12 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-indigo-500"><Sparkles size={14} /> Smart career intelligence</div>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Turn your resume into a <span className="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent">stronger match.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-slate-600 dark:text-slate-400">Upload your resume and target job description for instant skill-gap analysis, ATS recommendations, and a clear match score.</p>
        </motion.div>
        <div className={`grid gap-7 ${result ? "lg:grid-cols-[.8fr_1.2fr]" : "mx-auto max-w-3xl"}`}>
          <GlassCard className="h-fit shadow-glow">
            <form onSubmit={submit} className="space-y-5">
              <div><label className="mb-2 block text-sm font-semibold">Resume PDF</label><label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }} className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-indigo-400/50 bg-indigo-500/5 p-7 text-center transition hover:bg-indigo-500/10"><UploadCloud className="mb-3 text-indigo-500" /><span className="font-semibold">{file ? file.name : "Drop your resume here"}</span><span className="mt-1 text-xs text-slate-500">PDF only, up to 5MB</span><input className="hidden" type="file" accept=".pdf,application/pdf" onChange={e => selectFile(e.target.files?.[0])} /></label></div>
              {file && <button type="button" onClick={() => setFile(null)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-500"><X size={13} /> Remove file</button>}
              <div><label htmlFor="job" className="mb-2 block text-sm font-semibold">Target job description</label><textarea id="job" value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={8} placeholder="Paste the role responsibilities, requirements, and preferred skills..." className="w-full resize-none rounded-2xl border border-slate-300 bg-white/50 p-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-950/40" /><div className="mt-1 text-right text-xs text-slate-500">{jobDescription.length} characters</div></div>
              <AnimatePresence>{error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">{error}</motion.p>}</AnimatePresence>
              <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70">{loading ? <><LoaderCircle className="animate-spin" size={19} /> Analyzing resume...</> : <><Sparkles size={19} /> Analyze my resume</>}</button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={13} /> Your resume is processed in memory and never stored.</p>
            </form>
          </GlassCard>
          <AnimatePresence>{result && <Results result={result} />}</AnimatePresence>
        </div>
      </div>
    </main>
  );
}
