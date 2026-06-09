import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, UploadCloud, X, Sparkles, LoaderCircle,
  ChevronDown, ChevronUp, Download, MessageSquare,
} from "lucide-react";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Question {
  question: string;
  type: "technical" | "behavioural";
  difficulty?: string;
  keyPoints: string[];
  modelAnswer: string;
  tip: string;
  followUpQuestions?: string[];
}

interface PrepResult {
  questions: Question[];
  jobRole: string;
  interviewType: string;
  difficulty: string;
  targetCompany?: string;
}

type InterviewType = "Technical" | "Behavioural" | "Mixed";
type Difficulty    = "Beginner" | "Intermediate" | "Advanced";

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 " +
  "placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white " +
  "focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 " +
  "dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800";

const cardCls =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900";

const TYPE_BADGE: Record<string, string> = {
  technical:   "border-indigo-400/30 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  behavioural: "border-amber-400/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
};
const DIFF_BADGE: Record<string, string> = {
  beginner:     "border-emerald-400/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  intermediate: "border-amber-400/30 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  advanced:     "border-red-400/30 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function InterviewPrep({ onBack }: { onBack: () => void }) {
  // Form state
  const [file, setFile]                     = useState<File | null>(null);
  const [jobRole, setJobRole]               = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType]   = useState<InterviewType>("Mixed");
  const [questionCount, setQuestionCount]   = useState<5 | 7 | 10>(5);
  const [difficulty, setDifficulty]         = useState<Difficulty>("Intermediate");
  const [targetCompany, setTargetCompany]   = useState("");
  const [followUpsEnabled, setFollowUpsEnabled] = useState(false);

  // UI state
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [result, setResult]                 = useState<PrepResult | null>(null);
  const [openAnswers, setOpenAnswers]       = useState<Set<number>>(new Set());
  const [openFollowUps, setOpenFollowUps]   = useState<Set<number>>(new Set());
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!jobRole.trim()) { setError("Please enter the job role."); return; }
    setError(""); setLoading(true); setResult(null); setOpenAnswers(new Set()); setOpenFollowUps(new Set());
    try {
      const body = new FormData();
      if (file) body.append("resume", file);
      body.append("jobRole", jobRole);
      body.append("jobDescription", jobDescription);
      body.append("interviewType", interviewType);
      body.append("questionCount", String(questionCount));
      body.append("difficulty", difficulty);
      body.append("targetCompany", targetCompany);
      body.append("followUps", String(followUpsEnabled));

      const res = await fetch(`${apiUrl}/api/v2/interview-prep`, { method: "POST", body });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Generation failed. Please try again.";
        try { msg = (JSON.parse(text) as { message?: string }).message ?? msg; } catch { /* was HTML */ }
        throw new Error(msg);
      }
      const data = await res.json() as PrepResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to the server.");
    } finally { setLoading(false); }
  };

  const toggleAnswer   = (i: number) => setOpenAnswers(p   => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleFollowUp = (i: number) => setOpenFollowUps(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const downloadPdf = async () => {
    if (!result) return;
    setDownloadingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const margin = 20; const pageW = 210; const maxW = pageW - margin * 2;
      let y = 25;
      const addPage = () => { doc.addPage(); y = 25; };
      const checkY = (n: number) => { if (y + n > 270) addPage(); };

      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(67, 56, 202);
      doc.text(`Interview Prep — ${result.jobRole}`, margin, y); y += 7;
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
      const subtitle = [result.interviewType, result.difficulty, result.targetCompany].filter(Boolean).join(" · ");
      doc.text(`${subtitle}  ·  ${result.questions.length} Questions  ·  Generated by ResumeIQ`, margin, y); y += 12;

      result.questions.forEach((q, i) => {
        checkY(24);
        const typeLabel = (q.type ?? "technical").charAt(0).toUpperCase() + (q.type ?? "technical").slice(1);
        const diffLabel = (q.difficulty ?? result.difficulty).charAt(0).toUpperCase() + (q.difficulty ?? result.difficulty).slice(1);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.setTextColor(q.type === "technical" ? 67 : 180, q.type === "technical" ? 56 : 100, q.type === "technical" ? 202 : 11);
        doc.text(`[${typeLabel}] [${diffLabel}]`, margin, y); y += 5;

        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
        const qLines = doc.splitTextToSize(`Q${i + 1}: ${q.question}`, maxW);
        checkY(qLines.length * 5 + 4);
        doc.text(qLines, margin, y); y += qLines.length * 5 + 3;

        checkY(10);
        doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(67, 56, 202);
        doc.text("Key Points:", margin + 2, y); y += 4.5;
        doc.setFont("helvetica", "normal"); doc.setTextColor(51, 65, 85);
        (q.keyPoints ?? []).forEach(pt => {
          const lines = doc.splitTextToSize(`• ${pt}`, maxW - 6);
          checkY(lines.length * 4.5);
          doc.text(lines, margin + 5, y); y += lines.length * 4.5;
        });
        y += 2;

        checkY(14);
        doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(67, 56, 202);
        doc.text("Model Answer:", margin + 2, y); y += 4.5;
        doc.setFont("helvetica", "normal"); doc.setTextColor(51, 65, 85);
        const ansLines = doc.splitTextToSize(q.modelAnswer, maxW - 6);
        checkY(ansLines.length * 4.5);
        doc.text(ansLines, margin + 5, y); y += ansLines.length * 4.5 + 3;

        doc.setFontSize(8); doc.setTextColor(180, 100, 11);
        const tipLines = doc.splitTextToSize(`💡 Tip: ${q.tip}`, maxW - 4);
        checkY(tipLines.length * 4 + 2);
        doc.text(tipLines, margin + 2, y); y += tipLines.length * 4 + 4;

        if (q.followUpQuestions?.length) {
          checkY(10);
          doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 116, 139);
          doc.text("Follow-ups:", margin + 2, y); y += 4;
          doc.setFont("helvetica", "normal");
          q.followUpQuestions.forEach((fu, fi) => {
            const fuLines = doc.splitTextToSize(`  ${fi + 1}. ${fu}`, maxW - 6);
            checkY(fuLines.length * 4);
            doc.text(fuLines, margin + 4, y); y += fuLines.length * 4;
          });
        }
        y += 8;
      });

      const fname = `InterviewPrep_${result.jobRole.replace(/\s+/g, "_")}${result.targetCompany ? `_${result.targetCompany}` : ""}.pdf`;
      doc.save(fname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF generation failed.");
    } finally { setDownloadingPdf(false); }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-4">
      {/* Back */}
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition">
        <ArrowLeft size={16} /> Back to Analyzer
      </button>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
          <MessageSquare size={13} /> Interview Prep Pro
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">
          Walk in{" "}
          <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            confident and prepared.
          </span>
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Tailored questions with model answers, coaching tips, and difficulty-matched depth.
        </p>
      </motion.div>

      {/* Form card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${cardCls} p-6 mb-6 space-y-5`}>

        {/* Resume upload (optional) */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Resume <span className="text-xs font-normal text-slate-400">(optional — enables role-specific questions)</span>
          </label>
          <label
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}
            className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-5 text-center transition hover:bg-amber-50 hover:border-amber-400 dark:border-amber-500/30 dark:bg-amber-500/5 dark:hover:bg-amber-500/10"
          >
            <UploadCloud className="mb-2 text-amber-500" size={24} />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {file ? file.name : "Drop resume here or click to browse"}
            </span>
            <span className="mt-1 text-xs text-slate-500">PDF, DOC or DOCX · up to 5 MB</span>
            <input ref={inputRef} className="hidden" type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => selectFile(e.target.files?.[0])} />
          </label>
          {file && (
            <button onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
              className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 hover:text-rose-500 transition">
              <X size={12} /> Remove
            </button>
          )}
          {file ? (
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span>✦</span> Resume-aware — questions tailored to your experience
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Upload resume for personalised questions
            </p>
          )}
        </div>

        {/* Row 1: Role / Difficulty / Type */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Job Role *</label>
            <input className={inputCls} value={jobRole} onChange={e => setJobRole(e.target.value)} placeholder="SAP Consultant" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Difficulty</label>
            <select className={inputCls} value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Interview Type</label>
            <select className={inputCls} value={interviewType} onChange={e => setInterviewType(e.target.value as InterviewType)}>
              <option value="Technical">Technical</option>
              <option value="Behavioural">Behavioural</option>
              <option value="Mixed">Mixed</option>
            </select>
          </div>
        </div>

        {/* Row 2: Questions / Target Company */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Questions</label>
            <select className={inputCls} value={questionCount} onChange={e => setQuestionCount(Number(e.target.value) as 5 | 7 | 10)}>
              <option value={5}>5 questions</option>
              <option value={7}>7 questions</option>
              <option value={10}>10 questions</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Target Company <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input className={inputCls} value={targetCompany} onChange={e => setTargetCompany(e.target.value)}
              placeholder="Google, Amazon, Deloitte…" />
          </div>
        </div>

        {/* Follow-ups toggle */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Follow-up Questions</p>
            <p className="text-xs text-slate-500">Generate 2 progressively harder follow-ups per question</p>
          </div>
          <button
            onClick={() => setFollowUpsEnabled(v => !v)}
            className={`relative flex h-6 w-11 items-center rounded-full transition-colors ${followUpsEnabled ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}
          >
            <span className={`absolute h-5 w-5 rounded-full bg-white shadow transition-all ${followUpsEnabled ? "left-5" : "left-0.5"}`} />
          </button>
        </div>

        {/* JD */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Job Description <span className="font-normal text-slate-400">(optional — sharpens technical questions)</span>
          </label>
          <textarea className={`${inputCls} resize-none`} rows={4} value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste key responsibilities and requirements…" />
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
        <button onClick={generate} disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
        >
          {loading
            ? <><LoaderCircle className="animate-spin" size={18} /> Generating questions…</>
            : <><Sparkles size={18} /> ✦ Generate Interview Questions</>}
        </button>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Header row */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{result.questions.length} Questions</span>
                <span className="ml-2 text-xs text-slate-500">for {result.jobRole}</span>
              </div>
              <button onClick={downloadPdf} disabled={downloadingPdf}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-amber-500/20 hover:brightness-110 disabled:opacity-60 transition">
                {downloadingPdf ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />}
                Download Q&A PDF
              </button>
            </div>

            {/* Accordion */}
            <div className="space-y-3">
              {result.questions.map((q, i) => {
                const isOpen      = openAnswers.has(i);
                const fuOpen      = openFollowUps.has(i);
                const typeKey     = (q.type ?? "technical").toLowerCase();
                const diffKey     = (q.difficulty ?? result.difficulty ?? "intermediate").toLowerCase();
                const typeBadge   = TYPE_BADGE[typeKey] ?? TYPE_BADGE["technical"]!;
                const diffBadge   = DIFF_BADGE[diffKey] ?? DIFF_BADGE["intermediate"]!;
                const hasFollowUps= (q.followUpQuestions?.length ?? 0) > 0;

                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }} className={`${cardCls} overflow-hidden`}>

                    {/* Question header */}
                    <button onClick={() => toggleAnswer(i)}
                      className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 text-xs font-black text-white">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="mb-1.5 flex flex-wrap gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeBadge}`}>{typeKey}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${diffBadge}`}>{diffKey}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{q.question}</p>
                      </div>
                      <span className="ml-2 mt-0.5 shrink-0 text-slate-400">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </button>

                    {/* Expanded answer */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="border-t border-slate-200 dark:border-slate-700 px-4 pb-5 pt-4 space-y-4">
                            {/* Key points */}
                            <div>
                              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Key Points to Cover</p>
                              <ul className="space-y-1">
                                {(q.keyPoints ?? []).map((pt, j) => (
                                  <li key={j} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />{pt}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {/* Model answer */}
                            <div>
                              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Model Answer</p>
                              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{q.modelAnswer}</p>
                            </div>
                            {/* Coach tip */}
                            {q.tip && (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-900/20">
                                <p className="text-xs text-amber-800 dark:text-amber-300"><span className="font-bold">💡 Coach Tip: </span>{q.tip}</p>
                              </div>
                            )}
                            {/* Follow-up questions */}
                            {hasFollowUps && (
                              <div>
                                <button onClick={() => toggleFollowUp(i)}
                                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                                  {fuOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  Follow-up Questions ({q.followUpQuestions!.length})
                                </button>
                                <AnimatePresence initial={false}>
                                  {fuOpen && (
                                    <motion.div key="fu" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                                      <div className="mt-3 space-y-2 border-l-2 border-indigo-300 dark:border-indigo-700 pl-3">
                                        {q.followUpQuestions!.map((fu, j) => (
                                          <p key={j} className="text-sm text-slate-700 dark:text-slate-300">
                                            <span className="mr-1 font-bold text-indigo-500">↳</span>{fu}
                                          </p>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Session summary */}
            <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Session Summary</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-semibold">{result.questions.length} questions</span>
                <span className="mx-1.5 text-slate-400">·</span>{result.interviewType}
                <span className="mx-1.5 text-slate-400">·</span>{result.difficulty ?? difficulty}
                <span className="mx-1.5 text-slate-400">·</span>{result.jobRole}
                {result.targetCompany && <><span className="mx-1.5 text-slate-400">at</span><span className="font-semibold">{result.targetCompany}</span></>}
                {followUpsEnabled && <><span className="mx-1.5 text-slate-400">·</span>with follow-ups</>}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
