import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, UploadCloud, X, Sparkles, LoaderCircle,
  Copy, Check, Download, FileText,
} from "lucide-react";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface CoverLetterResult {
  coverLetter: string;
  wordCount: number;
  candidateName: string;
}

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 " +
  "placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white " +
  "focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 " +
  "dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800";

const cardCls =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900";

export default function CoverLetter({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CoverLetterResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFile = (f: File | undefined) => {
    if (!f) return;
    const name = f.name.toLowerCase();
    const ok = f.type === "application/pdf"
      || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || f.type === "application/msword"
      || name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc");
    if (!ok) { setError("Please upload a PDF or Word (.docx/.doc) resume."); return; }
    if (f.size > 5 * 1024 * 1024) { setError("File must be smaller than 5 MB."); return; }
    setError(""); setFile(f);
  };

  const generate = async () => {
    if (!companyName.trim()) { setError("Please enter a company name."); return; }
    if (!jobRole.trim())     { setError("Please enter the job role."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const body = new FormData();
      if (file) body.append("resume", file);
      body.append("companyName", companyName);
      body.append("jobRole", jobRole);
      body.append("jobDescription", jobDescription);

      const res = await fetch(`${apiUrl}/api/v2/cover-letter`, { method: "POST", body });
      const data = await res.json() as CoverLetterResult & { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Generation failed.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to the server.");
    } finally { setLoading(false); }
  };

  const copyToClipboard = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadDocx = async () => {
    if (!result) return;
    setDownloadingDocx(true);
    try {
      const res = await fetch(`${apiUrl}/api/v2/cover-letter-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetter:   result.coverLetter,
          candidateName: result.candidateName,
          companyName,
          jobRole,
        }),
      });
      if (!res.ok) throw new Error("Download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CoverLetter_${companyName.replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally { setDownloadingDocx(false); }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-4">
      {/* Back */}
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition">
        <ArrowLeft size={16} /> Back to Analyzer
      </button>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-teal-600 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20">
          <FileText size={13} /> Cover Letter Generator
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          Write a{" "}
          <span className="bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">
            tailored cover letter
          </span>
          {" "}in seconds.
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Upload your resume, enter the role details, and get a professional 250–300 word cover letter.
        </p>
      </motion.div>

      {/* Form card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${cardCls} p-6 mb-6 space-y-5`}>

        {/* Upload */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Resume <span className="text-xs font-normal text-slate-400">(optional — improves personalisation)</span>
          </label>
          <label
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}
            className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/50 p-6 text-center transition hover:bg-teal-50 hover:border-teal-400 dark:border-teal-500/30 dark:bg-teal-500/5 dark:hover:bg-teal-500/10"
          >
            <UploadCloud className="mb-2 text-teal-500" size={26} />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {file ? file.name : "Drop resume here or click to browse"}
            </span>
            <span className="mt-1 text-xs text-slate-500">PDF, DOC or DOCX · up to 5 MB</span>
            <input
              ref={inputRef} className="hidden" type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => selectFile(e.target.files?.[0])}
            />
          </label>
          {file && (
            <button onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
              className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 hover:text-rose-500 transition">
              <X size={12} /> Remove
            </button>
          )}
        </div>

        {/* Company + Role */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Company Name *</label>
            <input className={inputCls} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Google, McKinsey, Infosys…" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Job Role / Title *</label>
            <input className={inputCls} value={jobRole} onChange={e => setJobRole(e.target.value)} placeholder="SAP Security Consultant" />
          </div>
        </div>

        {/* JD */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Job Description <span className="font-normal text-slate-400">(optional — paste for tighter tailoring)</span>
          </label>
          <textarea className={`${inputCls} resize-none`} rows={5} value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste key requirements, responsibilities, and skills…" />
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-600 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400">
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Generate button */}
        <button
          onClick={generate} disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
        >
          {loading
            ? <><LoaderCircle className="animate-spin" size={18} /> Generating your letter…</>
            : <><Sparkles size={18} /> ✦ Generate Cover Letter</>}
        </button>
      </motion.div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Word count badge */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Your Cover Letter</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${result.wordCount >= 230 && result.wordCount <= 320 ? "border-teal-400/30 bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400" : "border-amber-400/30 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"}`}>
                {result.wordCount} words
              </span>
            </div>

            {/* Letter card */}
            <div className={`${cardCls} p-7 mb-4`}>
              <div className="space-y-4">
                {result.coverLetter.split(/\n\n+/).filter(Boolean).map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">{para.trim()}</p>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
              >
                {copied ? <><Check size={15} className="text-teal-500" /> Copied!</> : <><Copy size={15} /> Copy to Clipboard</>}
              </button>
              <button
                onClick={downloadDocx} disabled={downloadingDocx}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-teal-500/20 hover:brightness-110 disabled:opacity-60 transition"
              >
                {downloadingDocx ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
                Download as DOCX
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
