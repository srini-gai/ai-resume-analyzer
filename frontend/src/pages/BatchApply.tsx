import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, UploadCloud, X, Sparkles, LoaderCircle,
  ChevronDown, ChevronUp, Copy, Check, Download, Layers,
} from "lucide-react";

const apiUrl = import.meta.env.VITE_API_URL ?? "";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BatchLetter {
  company: string;
  role: string;
  coverLetter: string;
  wordCount: number;
}

interface BatchResult {
  letters: BatchLetter[];
  elapsed: number;
  candidateName: string;
}

interface ParsedCompany { company: string; role: string }

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 " +
  "placeholder-slate-400 outline-none transition focus:border-violet-500 focus:bg-white " +
  "focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-800 " +
  "dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-violet-500 dark:focus:bg-slate-800";

const cardCls =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900";

function parseCompanies(text: string): ParsedCompany[] {
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map(line => {
      const di = line.indexOf(" - ");
      if (di > 0) return { company: line.slice(0, di).trim(), role: line.slice(di + 3).trim() || "the position" };
      return { company: line.trim(), role: "the position" };
    })
    .filter(c => c.company.length > 0);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BatchApply({ onBack }: { onBack: () => void }) {
  const [file, setFile]                       = useState<File | null>(null);
  const [jobDescription, setJobDescription]   = useState("");
  const [companiesText, setCompaniesText]     = useState("");
  const [loading, setLoading]                 = useState(false);
  const [progressIdx, setProgressIdx]         = useState(0);
  const [error, setError]                     = useState("");
  const [result, setResult]                   = useState<BatchResult | null>(null);
  const [openCards, setOpenCards]             = useState<Set<number>>(new Set());
  const [copyingIdx, setCopyingIdx]           = useState<number | null>(null);
  const [downloadingIdx, setDownloadingIdx]   = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsedCompanies = parseCompanies(companiesText);

  // Simulate progress — advances every ~7s (approx generation time per letter)
  useEffect(() => {
    if (!loading || parsedCompanies.length === 0) { setProgressIdx(0); return; }
    setProgressIdx(0);
    const id = setInterval(() => {
      setProgressIdx(p => {
        if (p >= parsedCompanies.length - 1) { clearInterval(id); return p; }
        return p + 1;
      });
    }, 7000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const selectFile = (f: File | undefined) => {
    if (!f) return;
    const name = f.name.toLowerCase();
    const ok = f.type === "application/pdf"
      || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || f.type === "application/msword"
      || name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc");
    if (!ok) { setError("Please upload a PDF or Word resume."); return; }
    if (f.size > 5 * 1024 * 1024) { setError("File must be smaller than 5 MB."); return; }
    setError(""); setFile(f);
  };

  const generate = async () => {
    if (!file)                            { setError("Please upload your resume."); return; }
    if (parsedCompanies.length === 0)     { setError("Add at least one company in 'Company - Job Role' format."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const body = new FormData();
      body.append("resume", file);
      body.append("jobDescription", jobDescription);
      body.append("companiesText", companiesText);

      const res = await fetch(`${apiUrl}/api/v2/batch-cover-letters`, { method: "POST", body });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Batch generation failed.";
        try { msg = (JSON.parse(text) as { message?: string }).message ?? msg; } catch { /* was HTML */ }
        throw new Error(msg);
      }
      const data = await res.json() as BatchResult;
      setResult(data);
      setOpenCards(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to server.");
    } finally { setLoading(false); }
  };

  const toggleCard = (i: number) => {
    setOpenCards(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const copyLetter = async (i: number, letter: string) => {
    await navigator.clipboard.writeText(letter);
    setCopyingIdx(i); setTimeout(() => setCopyingIdx(null), 2000);
  };

  const downloadDocx = async (letter: BatchLetter, candidateName: string) => {
    const idx = result!.letters.indexOf(letter);
    setDownloadingIdx(idx);
    try {
      const res = await fetch(`${apiUrl}/api/v2/cover-letter-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetter: letter.coverLetter,
          candidateName,
          companyName: letter.company,
          jobRole: letter.role,
        }),
      });
      if (!res.ok) throw new Error("Download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CoverLetter_${letter.company.replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally { setDownloadingIdx(null); }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-4">
      {/* Back */}
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition">
        <ArrowLeft size={16} /> Back to Analyzer
      </button>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20">
          <Layers size={13} /> Batch Apply
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          Apply to{" "}
          <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            multiple companies
          </span>
          {" "}at once.
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Upload your resume, list up to 10 companies, and get tailored cover letters for each — in one click.
        </p>
      </motion.div>

      {/* Form card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${cardCls} p-6 mb-6 space-y-5`}>

        {/* Upload (required) */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Resume <span className="text-xs text-rose-500">*</span>
          </label>
          <label
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}
            className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/50 p-6 text-center transition hover:bg-violet-50 hover:border-violet-400 dark:border-violet-500/30 dark:bg-violet-500/5 dark:hover:bg-violet-500/10"
          >
            <UploadCloud className="mb-2 text-violet-500" size={26} />
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

        {/* Companies */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Target Companies <span className="font-normal text-slate-400">(one per line, format: Company - Job Role)</span>
          </label>
          <textarea
            className={`${inputCls} resize-none font-mono`}
            rows={6}
            value={companiesText}
            onChange={e => setCompaniesText(e.target.value)}
            placeholder={"Google - SAP Security Consultant\nAmazon - GRC Lead\nMicrosoft - Security Architect\nDeloitte - Risk & Compliance Analyst"}
          />
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{parsedCompanies.length} / 10 companies parsed</span>
            {parsedCompanies.length > 10 && <span className="text-amber-600">Only first 10 will be used</span>}
          </div>
        </div>

        {/* Shared JD */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Shared Job Description <span className="font-normal text-slate-400">(optional — applied to all companies)</span>
          </label>
          <textarea className={`${inputCls} resize-none`} rows={4} value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste common requirements that apply across these roles…" />
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

        {/* Generate */}
        <button
          onClick={generate} disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
        >
          {loading
            ? <><LoaderCircle className="animate-spin" size={18} /> Generating letters…</>
            : <><Sparkles size={18} /> ✦ Generate All Cover Letters</>}
        </button>

        {/* Progress indicator */}
        <AnimatePresence>
          {loading && parsedCompanies.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              <p className="text-xs text-slate-500 text-center">
                Processing {parsedCompanies[progressIdx]?.company ?? "…"} ({progressIdx + 1} of {parsedCompanies.length})
              </p>
              <div className="flex gap-1.5">
                {parsedCompanies.map((c, i) => (
                  <div key={i} title={c.company}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < progressIdx ? "bg-violet-500" : i === progressIdx ? "animate-pulse bg-violet-400" : "bg-slate-200 dark:bg-slate-700"}`}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Summary banner */}
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 dark:border-violet-700/40 dark:bg-violet-900/20">
              <div>
                <span className="text-sm font-bold text-violet-700 dark:text-violet-400">
                  {result.letters.length} cover letters generated
                </span>
                <span className="ml-2 text-xs text-slate-500">in {result.elapsed}s</span>
              </div>
              <span className="text-xs text-slate-500">for {result.candidateName}</span>
            </div>

            {/* Letter cards */}
            <div className="space-y-3">
              {result.letters.map((letter, i) => {
                const isOpen = openCards.has(i);
                const preview = letter.coverLetter.split("\n\n").slice(0, 1).join(" ").slice(0, 160);

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`${cardCls} overflow-hidden`}
                  >
                    {/* Card header */}
                    <button
                      onClick={() => toggleCard(i)}
                      className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-black text-white">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{letter.company}</p>
                        <p className="text-xs text-slate-500 mb-1">{letter.role}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{preview}…</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold ${letter.wordCount >= 230 && letter.wordCount <= 320 ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {letter.wordCount}w
                        </span>
                        {isOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                      </div>
                    </button>

                    {/* Expanded letter */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-slate-200 dark:border-slate-700 px-4 pb-4 pt-4">
                            <div className="mb-4 space-y-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                              {letter.coverLetter.split(/\n\n+/).filter(Boolean).map((para, j) => (
                                <p key={j}>{para.trim()}</p>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => { void copyLetter(i, letter.coverLetter); }}
                                className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                              >
                                {copyingIdx === i ? <><Check size={13} className="text-teal-500" /> Copied!</> : <><Copy size={13} /> Copy</>}
                              </button>
                              <button
                                onClick={() => { void downloadDocx(letter, result.candidateName); }}
                                disabled={downloadingIdx === i}
                                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-60 transition"
                              >
                                {downloadingIdx === i ? <LoaderCircle size={13} className="animate-spin" /> : <Download size={13} />}
                                Download DOCX
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
