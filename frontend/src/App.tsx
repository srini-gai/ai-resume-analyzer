import { useEffect, useState, useRef, type FormEvent, type ReactNode } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileSearch, LoaderCircle, ShieldCheck, Sparkles, UploadCloud, X,
  CheckCircle2, AlertCircle, FileText, Wand2,
  Mail, MessageSquare, Menu, Layers, LogOut, ShieldAlert, History,
} from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";
import { Results } from "./components/Results";
import { ReportPDFDownloadLink } from "./components/pdf/ReportPDF";
import ResumeBuilder from "./pages/ResumeBuilder";
import CoverLetter from "./pages/CoverLetter";
import InterviewPrep from "./pages/InterviewPrep";
import BatchApply from "./pages/BatchApply";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import type { V2AnalysisResult } from "./types";

// ─── Auth types ───────────────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  status: string;
  isAdmin: boolean;
}

type AuthState =
  | { type: "loading" }
  | { type: "no_auth" }
  | { type: "unauthenticated"; error?: string }
  | { type: "pending"; user: AuthUser }
  | { type: "authenticated"; user: AuthUser };

interface HistoryItem {
  id: string;
  filename: string | null;
  created_at: string;
  result: V2AnalysisResult;
}

// Inline word-level diff — highlights words that are new/changed in the revised text
function WordDiff({ original, revised }: { original: string; revised: string }) {
  const origWords = new Set(original.toLowerCase().split(/\s+/));
  const tokens = revised.split(/(\s+)/);
  return (
    <>
      {tokens.map((token, i) =>
        token.trim() === "" ? (
          <span key={i}>{token}</span>
        ) : origWords.has(token.toLowerCase().replace(/[^a-z0-9]/g, "")) ? (
          <span key={i} className="text-slate-700 dark:text-slate-300">{token}</span>
        ) : (
          <span key={i} className="rounded bg-emerald-100 px-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">{token}</span>
        )
      )}
    </>
  );
}

const apiUrl = import.meta.env.VITE_API_URL ?? "";

const LOADING_STEPS = [
  "Parsing resume...",
  "Analyzing skills...",
  "Generating optimized version...",
  "Building gap analysis...",
];

// Light: solid white card with subtle shadow. Dark: deep navy card with border.
const cardCls = "rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-700/60 dark:bg-slate-900";

type Tab = "analysis" | "optimized" | "report";

export default function App() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<V2AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("analysis");
  const [skillFilter, setSkillFilter] = useState<"all" | "matched" | "missing">("all");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Auth
  const [authState, setAuthState] = useState<AuthState>({ type: "loading" });
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const downloadOptimizedPdf = async () => {
    if (!file) { alert("Original resume file no longer available. Please re-upload."); return; }
    setDownloadingPdf(true);
    try {
      const body = new FormData();
      body.append("resume", file);
      body.append("jobDescription", jobDescription);
      const response = await fetch(`${apiUrl}/api/v2/optimized-pdf`, { method: "POST", body });
      if (!response.ok) throw new Error("PDF generation failed");

      const contentType = response.headers.get("content-type") ?? "";
      const date = new Date().toISOString().slice(0, 10);
      const safeName = (result?.optimizedResume.candidateName ?? "Resume").replace(/\s+/g, "_");
      const filename = `ResumeIQ_Optimized_${safeName}_${date}.pdf`;

      if (contentType.includes("application/pdf")) {
        // PDF input — backend returned an edited PDF
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      } else {
        // DOCX input — backend returned JSON, generate PDF on the client
        const json = await response.json() as { useClientSide?: boolean; optimizedResume?: V2AnalysisResult["optimizedResume"] };
        if (!json.useClientSide || !json.optimizedResume) throw new Error("Unexpected server response");
        const { pdf } = await import("@react-pdf/renderer");
        const { ResumePDFDocument } = await import("./components/pdf/ResumePDF");
        const blob = await pdf(<ResumePDFDocument data={json.optimizedResume} />).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      alert("Could not generate optimized PDF. " + (e instanceof Error ? e.message : ""));
    } finally {
      setDownloadingPdf(false);
    }
  };
  const downloadOptimizedDocx = async () => {
    if (!result) return;
    setDownloadingDocx(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const safeName = (result.optimizedResume.candidateName ?? "Resume").replace(/\s+/g, "_");
      const filename = `ResumeIQ_Optimized_${safeName}_${date}.docx`;

      let response: Response;

      if (result.inputFormat === "docx" && file) {
        // Original was a DOCX: send the file back so the backend can edit XML in-place,
        // preserving the original table structure, fonts, and styles.
        const body = new FormData();
        body.append("resume", file);
        body.append("optimizedResume", JSON.stringify(result.optimizedResume));
        response = await fetch(`${apiUrl}/api/v2/optimized-docx-v2`, { method: "POST", body });
      } else {
        // PDF / DOC input or file no longer available: generate from template
        response = await fetch(`${apiUrl}/api/v2/optimized-docx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optimizedResume: result.optimizedResume }),
        });
      }

      if (!response.ok) throw new Error("DOCX generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Could not generate Word document. " + (e instanceof Error ? e.message : ""));
    } finally {
      setDownloadingDocx(false);
    }
  };

  const loadingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // ── Auth check on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get("error");
    if (oauthError) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    fetch(`${apiUrl}/auth/me`)
      .then(async r => {
        if (r.ok) {
          const data = await r.json() as { authEnabled?: boolean } | AuthUser;
          if ("authEnabled" in data && data.authEnabled === false) {
            setAuthState({ type: "no_auth" });
          } else {
            const user = data as AuthUser;
            if (user.status === "approved") {
              setAuthState({ type: "authenticated", user });
            } else if (user.status === "pending") {
              setAuthState({ type: "pending", user });
            } else {
              setAuthState({ type: "unauthenticated", error: oauthError ?? undefined });
            }
          }
        } else {
          setAuthState({ type: "unauthenticated", error: oauthError ?? undefined });
        }
      })
      .catch(() => setAuthState({ type: "no_auth" }));
  }, []);

  // ── Load analysis history after auth ──────────────────────────────────────
  useEffect(() => {
    if (authState.type !== "authenticated") return;
    fetch(`${apiUrl}/api/v2/history`)
      .then(r => r.ok ? r.json() as Promise<{ analyses: HistoryItem[] }> : Promise.resolve({ analyses: [] }))
      .then(d => setHistory(d.analyses.slice(0, 3)))
      .catch(() => {/* silently skip */});
  }, [authState.type]);

  const logout = () => {
    fetch(`${apiUrl}/auth/logout`, { method: "POST" })
      .finally(() => setAuthState({ type: "unauthenticated" }));
  };

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
    const name = candidate.name.toLowerCase();
    const ok = candidate.type === "application/pdf"
      || candidate.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || candidate.type === "application/msword"
      || name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc");
    if (!ok) return setError("Please upload a PDF or Word (.doc/.docx) resume.");
    if (candidate.size > 5 * 1024 * 1024) return setError("File must be smaller than 5MB.");
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

  // Shared slim header used by full-page tool views (builder, cover letter, interview prep)
  const toolHeader = (
    <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
      <div className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
          <FileSearch size={20} />
        </span>
        ResumeIQ
      </div>
      <ThemeToggle dark={dark} toggle={() => setDark(!dark)} />
    </header>
  );

  const toolShell = (child: ReactNode) => (
    <main className={`min-h-screen ${bgCls} text-slate-950 transition-colors dark:text-white`}>
      {dark && <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,.25),transparent_50%),radial-gradient(ellipse_at_80%_20%,rgba(139,92,246,.15),transparent_50%)]" />}
      {toolHeader}
      <div className="relative">{child}</div>
    </main>
  );

  const goToApp = () => { navigate("/app"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // ── Auth gates ──────────────────────────────────────────────────────────────
  if (authState.type === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07091a]">
        <LoaderCircle className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  if (authState.type === "pending") {
    return <Login user={authState.user} onLogout={logout} />;
  }

  const isAuthenticated = authState.type === "authenticated" || authState.type === "no_auth";
  const userName = authState.type === "authenticated" ? authState.user.name : null;
  const isAdmin = authState.type === "authenticated" && authState.user.isAdmin;
  const oauthError = authState.type === "unauthenticated" ? authState.error : undefined;

  const guard = (el: ReactNode) => isAuthenticated ? el : <Navigate to="/" replace />;

  const analyzeView = (
    <main className={`min-h-screen ${bgCls} text-slate-950 transition-colors dark:text-white`}>
      {dark && <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,.25),transparent_50%),radial-gradient(ellipse_at_80%_20%,rgba(139,92,246,.15),transparent_50%)]" />}

      {/* Nav */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30"><FileSearch size={20} /></span>
          ResumeIQ
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-2 sm:flex">
          <button onClick={() => navigate("/build-resume")}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 hover:brightness-110 transition">
            <FileText size={13} /> Build Resume
          </button>
          <button onClick={() => navigate("/cover-letter")}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-teal-500/20 hover:brightness-110 transition">
            <Mail size={13} /> Cover Letter
          </button>
          <button onClick={() => navigate("/interview-prep")}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/20 hover:brightness-110 transition">
            <MessageSquare size={13} /> Interview Prep
          </button>
          <button onClick={() => navigate("/batch-apply")}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-500/20 hover:brightness-110 transition">
            <Layers size={13} /> Batch Apply
          </button>
          {isAdmin && (
            <button onClick={() => navigate("/admin")}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition">
              <ShieldAlert size={13} /> Admin
            </button>
          )}
          <ThemeToggle dark={dark} toggle={() => setDark(!dark)} />
          {authState.type === "authenticated" && (
            <div className="flex items-center gap-2 pl-1">
              {authState.user.avatar_url ? (
                <img src={authState.user.avatar_url} alt="" className="size-7 rounded-full ring-2 ring-indigo-500/40" />
              ) : (
                <div className="grid size-7 place-items-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
                  {(authState.user.name ?? authState.user.email)[0]?.toUpperCase()}
                </div>
              )}
              <button onClick={logout} title="Sign out"
                className="grid size-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 transition">
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Mobile: theme + hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle dark={dark} toggle={() => setDark(!dark)} />
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full z-50 flex flex-col gap-2 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900 sm:hidden"
            >
              {[
                { label: "Build Resume",   path: "/build-resume",   cls: "from-indigo-600 to-violet-500", icon: <FileText size={14} /> },
                { label: "Cover Letter",   path: "/cover-letter",   cls: "from-teal-500 to-emerald-500",  icon: <Mail size={14} /> },
                { label: "Interview Prep", path: "/interview-prep", cls: "from-amber-500 to-orange-500",  icon: <MessageSquare size={14} /> },
                { label: "Batch Apply",    path: "/batch-apply",    cls: "from-violet-600 to-purple-600", icon: <Layers size={14} /> },
                ...(isAdmin
                  ? [{ label: "Admin", path: "/admin", cls: "from-slate-600 to-slate-700", icon: <ShieldAlert size={14} /> }]
                  : []),
              ].map(item => (
                <button key={item.label}
                  onClick={() => { navigate(item.path); setMenuOpen(false); }}
                  className={`flex items-center gap-2 rounded-2xl bg-gradient-to-r ${item.cls} px-4 py-2.5 text-sm font-bold text-white`}>
                  {item.icon} {item.label}
                </button>
              ))}
              {authState.type === "authenticated" && (
                <button onClick={() => { logout(); setMenuOpen(false); }}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <LogOut size={14} /> Sign out ({authState.user.name?.split(" ")[0] ?? authState.user.email})
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
                  <label className="mb-2 block text-sm font-semibold">Resume file</label>
                  <label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}
                    className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-8 text-center transition hover:bg-indigo-100 hover:border-indigo-400 dark:border-indigo-500/40 dark:bg-indigo-500/5 dark:hover:bg-indigo-500/10">
                    <UploadCloud className="mb-3 text-indigo-500" size={32} />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{file ? file.name : "Drop your resume here"}</span>
                    <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF, DOC or DOCX · up to 5MB</span>
                    <input className="hidden" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => selectFile(e.target.files?.[0])} />
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
                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck size={13} />
                  {authState.type === "authenticated" ? "Analysis saved to your history." : "Your resume is processed securely."}
                </p>
              </form>
            </div>
          )}

          {/* Recent analyses history */}
          {!result && history.length > 0 && (
            <div className={`${cardCls} p-5 mx-auto max-w-3xl`} style={{ gridColumn: "1 / -1" }}>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <History size={13} /> Recent analyses
              </p>
              <div className="space-y-2">
                {history.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setResult(item.result); setActiveTab("analysis"); setFile(null); }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {item.filename ?? "Unnamed analysis"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 gap-2">
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        Match {item.result.matchScore}%
                      </span>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        Str {item.result.strengthScore}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
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
                    <span className="text-sm font-semibold">{file ? file.name : "Drop resume (PDF/DOCX)"}</span>
                    <input className="hidden" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => selectFile(e.target.files?.[0])} />
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

                  {/* Tab 2: Optimized Resume — side-by-side section diff */}
                  {activeTab === "optimized" && result.optimizedResume && (
                    <motion.div key="optimized" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

                      {/* Header bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                            Detected layout: <span className="capitalize">{result.optimizedResume.layout?.type?.replace("-", " ") ?? "single column"}</span>
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            Your resume structure preserved — only the language was improved.
                          </p>
                        </div>
                      </div>

                      {/* Column headers */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          Original
                        </div>
                        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                          Optimized ✦
                        </div>
                      </div>

                      {/* Per-section diff */}
                      {result.optimizedResume.sections
                        .filter(s => s.type !== "header")
                        .map((section, idx) => (
                          <div key={idx} className={`${cardCls} overflow-hidden`}>
                            {/* Section title bar */}
                            <div className="border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50 px-5 py-2.5">
                              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                {section.originalTitle}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700/60">
                              {/* Original */}
                              <div className="min-w-0 overflow-hidden p-4">
                                {section.bullets.length > 0
                                  ? <ul className="space-y-2">
                                      {section.bullets.map((b, i) => (
                                        <li key={i} className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                                          <span className="min-w-0 break-words">{b}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  : <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 break-words">{section.originalContent}</p>
                                }
                              </div>

                              {/* Optimized — highlight new words in green */}
                              <div className="min-w-0 overflow-hidden p-4 bg-indigo-50/30 dark:bg-indigo-900/10">
                                {section.rewrittenBullets.length > 0
                                  ? <ul className="space-y-2">
                                      {section.rewrittenBullets.map((b, i) => (
                                        <li key={i} className="flex gap-2 text-xs">
                                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-400" />
                                          <span className="min-w-0 break-words leading-relaxed">
                                            <WordDiff original={section.bullets[i] ?? ""} revised={b} />
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  : <p className="text-xs leading-relaxed break-words">
                                      <WordDiff original={section.originalContent} revised={section.rewrittenContent} />
                                    </p>
                                }
                              </div>
                            </div>
                          </div>
                        ))}
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

  return (
    <Routes>
      <Route path="/" element={
        oauthError
          ? <Login error={oauthError} />
          : <Landing isAuthenticated={isAuthenticated} userName={userName} onGoToApp={goToApp} />
      } />
      <Route path="/app"           element={guard(analyzeView)} />
      <Route path="/build-resume"  element={guard(toolShell(<ResumeBuilder   onBack={goToApp} />))} />
      <Route path="/cover-letter"  element={guard(toolShell(<CoverLetter     onBack={goToApp} />))} />
      <Route path="/interview-prep"element={guard(toolShell(<InterviewPrep   onBack={goToApp} />))} />
      <Route path="/batch-apply"   element={guard(toolShell(<BatchApply      onBack={goToApp} />))} />
      <Route path="/admin"         element={guard(toolShell(<Admin           onBack={goToApp} />))} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
  );
}
