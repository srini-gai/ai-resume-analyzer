import { useEffect, useState, useRef, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileSearch, LoaderCircle, ShieldCheck, Sparkles, UploadCloud, X,
  CheckCircle2, AlertCircle, FileText, Wand2,
} from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";
import { Results } from "./components/Results";
import { ResumePDFDownloadLink } from "./components/pdf/ResumePDF";
import { ReportPDFDownloadLink } from "./components/pdf/ReportPDF";
import ResumeBuilder from "./pages/ResumeBuilder";
import type { V2AnalysisResult } from "./types";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const LOADING_STEPS = [
  "Parsing resume...",
  "Analyzing skills...",
  "Generating optimized version...",
  "Building gap analysis...",
];

// Light: solid white card with subtle shadow. Dark: deep navy card with border.
const cardCls = "rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-700/60 dark:bg-slate-900";

type View = "analyze" | "builder";
type Tab = "analysis" | "optimized" | "report";

export default function App() {
  const [dark, setDark] = useState(true);
  const [view, setView] = useState<View>("analyze");
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<V2AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("analysis");
  const [skillFilter, setSkillFilter] = useState<"all" | "matched" | "missing">("all");
  const loadingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      loadingRef.current = setInterval(() => {
        setLoadingStep(s => (s + 1) % LOADING_STEPS.length);
      }, 1500);
    } else {
      if (loadingRef.current) clearInterval(loadingRef.current);
    }
    return () => { if (loadingRef.current) clearInterval(loadingRef.current); };
  }, [loading]);

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
      const response = await fetch(`${apiUrl}/api/v2/analyze`, { method: "POST", body });
      const data = await response.json() as V2AnalysisResult;
      if (!response.ok) throw new Error((data as { message?: string }).message || "Analysis failed.");
      setResult(data);
      setActiveTab("analysis");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect to the analyzer API."); }
    finally { setLoading(false); }
  };

  // Dark: deep navy. Light: pure white — no gray gradients.
  const bgCls = dark ? "bg-[#07091a]" : "bg-white";

  if (view === "builder") {
    return (
      <main className={`min-h-screen ${bgCls} text-slate-950 transition-colors dark:text-white`}>
        {dark && <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,.25),transparent_50%),radial-gradient(ellipse_at_80%_20%,rgba(139,92,246,.15),transparent_50%)]" />}
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
          <div className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30"><FileSearch size={20} /></span>
            ResumeIQ
          </div>
          <ThemeToggle dark={dark} toggle={() => setDark(!dark)} />
        </header>
        <div className="relative">
          <ResumeBuilder onBack={() => setView("analyze")} />
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${bgCls} text-slate-950 transition-colors dark:text-white`}>
      {dark && <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,.25),transparent_50%),radial-gradient(ellipse_at_80%_20%,rgba(139,92,246,.15),transparent_50%)]" />}

      {/* Nav */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30"><FileSearch size={20} /></span>
          ResumeIQ
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setView("builder")}
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:brightness-110 transition flex items-center gap-2">
            <FileText size={15} /> Build Resume
          </button>
          <ThemeToggle dark={dark} toggle={() => setDark(!dark)} />
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-8">
        {!result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-10 max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">
              <Sparkles size={14} /> Smart career intelligence
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              Turn your resume into a{" "}
              <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">stronger match.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 dark:text-slate-400">
              Upload your resume and target job description for AI-powered rewriting, gap analysis, and ATS optimization.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["AI-Powered Rewrite", "Gap Analysis", "ATS Optimization"].map(f => (
                <span key={f} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">✦ {f}</span>
              ))}
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl font-black text-slate-900 dark:text-white">{result.gapAnalysis?.candidateName ?? "Analysis Complete"}</span>
              <span className="rounded-full bg-indigo-500/10 border border-indigo-400/20 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">Match: {result.matchScore}%</span>
              <span className="rounded-full bg-violet-500/10 border border-violet-400/20 px-3 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">Strength: {result.strengthScore}%</span>
            </div>
            <button onClick={() => { setResult(null); setFile(null); }} className="text-xs text-slate-500 hover:text-indigo-600 transition flex items-center gap-1">
              <X size={13} /> New Analysis
            </button>
          </motion.div>
        )}

        <div className={`grid gap-7 ${result ? "lg:grid-cols-[.85fr_1.15fr]" : "mx-auto max-w-3xl"}`}>
          {/* Upload form */}
          {!result && (
            <div className={`${cardCls} p-6 h-fit`}>
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold">Resume PDF</label>
                  <label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}
                    className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-8 text-center transition hover:bg-indigo-100 hover:border-indigo-400 dark:border-indigo-500/40 dark:bg-indigo-500/5 dark:hover:bg-indigo-500/10">
                    <UploadCloud className="mb-3 text-indigo-500" size={32} />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{file ? file.name : "Drop your resume here"}</span>
                    <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF only, up to 5MB</span>
                    <input className="hidden" type="file" accept=".pdf,application/pdf" onChange={e => selectFile(e.target.files?.[0])} />
                  </label>
                </div>
                {file && <button type="button" onClick={() => setFile(null)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-500"><X size={13} /> Remove file</button>}
                <div>
                  <label htmlFor="job" className="mb-2 block text-sm font-semibold">Target job description</label>
                  <textarea id="job" value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={8}
                    placeholder="Paste the role responsibilities, requirements, and preferred skills..."
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800" />
                  <div className="mt-1 text-right text-xs text-slate-500">{jobDescription.length} characters</div>
                </div>
                <AnimatePresence>
                  {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">{error}</motion.p>}
                </AnimatePresence>

                {loading ? (
                  <div className="space-y-3">
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <motion.div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" animate={{ width: ["0%", "100%"] }} transition={{ duration: 6, ease: "linear" }} />
                    </div>
                    <p className="text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                      <LoaderCircle className="animate-spin" size={15} /> {LOADING_STEPS[loadingStep]}
                    </p>
                  </div>
                ) : (
                  <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70">
                    <Sparkles size={19} /> Analyze my resume
                  </button>
                )}
                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={13} /> Your resume is processed in memory and never stored.</p>
              </form>
            </div>
          )}

          {/* Left column with form when results are shown */}
          {result && (
            <div className={`${cardCls} p-6 h-fit`}>
              <form onSubmit={submit} className="space-y-4">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Re-analyze</p>
                <div>
                  <label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}
                    className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-indigo-400/50 bg-indigo-500/5 p-5 text-center transition hover:bg-indigo-500/10">
                    <UploadCloud className="mb-2 text-indigo-500" size={20} />
                    <span className="text-sm font-semibold">{file ? file.name : "Drop resume PDF"}</span>
                    <input className="hidden" type="file" accept=".pdf,application/pdf" onChange={e => selectFile(e.target.files?.[0])} />
                  </label>
                </div>
                <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={5}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3 text-sm font-bold text-white hover:brightness-110 transition disabled:opacity-70">
                  {loading ? <LoaderCircle className="animate-spin" size={16} /> : <Wand2 size={16} />} Re-analyze
                </button>
                <AnimatePresence>
                  {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">{error}</motion.p>}
                </AnimatePresence>
              </form>
            </div>
          )}

          {/* Results area */}
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Tabs */}
                <div className="mb-4 flex gap-1 border-b-2 border-slate-100 dark:border-slate-700/60">
                  {(["analysis", "optimized", "report"] as Tab[]).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`relative px-4 py-2.5 text-sm font-semibold capitalize transition ${activeTab === tab ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>
                      {tab === "analysis" ? "Analysis" : tab === "optimized" ? "Optimized Resume" : "Full Report"}
                      {activeTab === tab && (
                        <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                      )}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {/* Tab 1: Analysis */}
                  {activeTab === "analysis" && (
                    <motion.div key="analysis" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      <Results result={result} />
                    </motion.div>
                  )}

                  {/* Tab 2: Optimized Resume */}
                  {activeTab === "optimized" && result.optimizedResume && (
                    <motion.div key="optimized" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                      <div className={`${cardCls} p-5`}>
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Your resume has been rewritten to match this role</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Professional Summary</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed border-l-2 border-indigo-500 pl-3">{result.optimizedResume.summary}</p>
                      </div>

                      <div className={`${cardCls} p-5`}>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Optimized Experience Bullets</p>
                        <ul className="space-y-2">
                          {result.optimizedResume.experienceBullets.map((b, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300">
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-500" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className={`${cardCls} p-5`}>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {result.optimizedResume.skills.map(s => (
                            <span key={s} className="rounded-full bg-indigo-500/10 border border-indigo-400/20 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">{s}</span>
                          ))}
                        </div>
                      </div>

                      <div className="text-center pt-2">
                        <ResumePDFDownloadLink data={result.optimizedResume} />
                      </div>
                    </motion.div>
                  )}

                  {/* Tab 3: Full Report */}
                  {activeTab === "report" && result.gapAnalysis && (
                    <motion.div key="report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                      <div className="flex justify-end">
                        <ReportPDFDownloadLink data={result} />
                      </div>

                      {/* Executive Summary */}
                      <div className={`${cardCls} p-5 border-l-4 border-indigo-500`}>
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Executive Summary</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{result.gapAnalysis.executiveSummary}</p>
                      </div>

                      {/* Scores */}
                      <div className="grid grid-cols-2 gap-3">
                        {[{ label: "Match Score", val: result.matchScore }, { label: "Strength Score", val: result.strengthScore }].map(s => (
                          <div key={s.label} className={`${cardCls} p-5 text-center`}>
                            <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{s.val}%</p>
                            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Skills Gap Table */}
                      <div className={`${cardCls} p-5`}>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Skills Analysis</p>
                          <div className="flex gap-1">
                            {(["all", "matched", "missing"] as const).map(f => (
                              <button key={f} onClick={() => setSkillFilter(f)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${skillFilter === f ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {result.gapAnalysis.skillsTable
                            .filter(row => skillFilter === "all" ? (row.required || row.category === "bonus") : row.category === skillFilter)
                            .map((row, i) => (
                              <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${row.category === "matched" ? "bg-green-50 dark:bg-green-900/20" : row.category === "missing" ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-50 dark:bg-slate-800/50"}`}>
                                <span className="font-medium capitalize">{row.skill}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${row.category === "matched" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400" : row.category === "missing" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"}`}>
                                  {row.category === "matched" ? <CheckCircle2 size={11} className="inline mr-1" /> : row.category === "missing" ? <AlertCircle size={11} className="inline mr-1" /> : null}
                                  {row.category}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Keyword Density */}
                      <div className={`${cardCls} p-5`}>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Keyword Density</p>
                        <div className="flex flex-wrap gap-2">
                          {result.gapAnalysis.keywordDensity.map((kw, i) => (
                            <span key={i} className={`rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 ${kw.present ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"}`}>
                              {kw.keyword}
                              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${kw.present ? "bg-green-200 dark:bg-green-900" : "bg-slate-200 dark:bg-slate-700"}`}>{kw.count}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Items */}
                      <div className={`${cardCls} p-5`}>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Action Items</p>
                        <div className="space-y-2">
                          {result.gapAnalysis.actionItems.map((item, i) => (
                            <div key={i} className="flex gap-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2.5">
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                              <p className="text-sm text-slate-700 dark:text-slate-300">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Certifications */}
                      <div className={`${cardCls} p-5`}>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Recommended Certifications</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {result.gapAnalysis.recommendedCertifications.map((cert, i) => (
                            <div key={i} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              🎓 {cert}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Experience Gaps */}
                      <div className={`${cardCls} p-5`}>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Experience Gaps</p>
                        <div className="space-y-2">
                          {result.gapAnalysis.experienceGaps.map((gap, i) => (
                            <div key={i} className="flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                              <AlertCircle size={15} className="mt-0.5 shrink-0" />
                              {gap}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
