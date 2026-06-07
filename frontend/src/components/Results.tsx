import { motion } from "framer-motion";
import { CheckCircle2, Download, Lightbulb, Target } from "lucide-react";
import type { AnalysisResult } from "../types";
import { GlassCard } from "./GlassCard";
import { ScoreRing } from "./ScoreRing";

export function Results({ result }: { result: AnalysisResult }) {
  const exportReport = async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(22); pdf.text("ResumeIQ Analysis Report", 18, 22);
    pdf.setFontSize(12); pdf.text(`Match score: ${result.matchScore}/100`, 18, 36); pdf.text(`Resume strength: ${result.strengthScore}/100`, 18, 44);
    let y = 58;
    const section = (title: string, items: string[]) => {
      pdf.setFontSize(15); pdf.text(title, 18, y); y += 8; pdf.setFontSize(10);
      items.forEach((item) => { const lines = pdf.splitTextToSize(`- ${item}`, 170); if (y + lines.length * 5 > 280) { pdf.addPage(); y = 20; } pdf.text(lines, 20, y); y += lines.length * 5 + 2; }); y += 4;
    };
    section("Matched skills", result.matchedSkills.length ? result.matchedSkills : ["No direct skill matches detected"]);
    section("Skills gap", result.missingSkills.length ? result.missingSkills : ["No major skill gaps detected"]);
    section("ATS suggestions", result.suggestions);
    pdf.save("resume-analysis-report.pdf");
  };
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-indigo-500">Your report</p><h2 className="text-2xl font-bold">Analysis complete</h2></div><button onClick={exportReport} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"><Download size={16} /> Export PDF</button></div>
      <GlassCard className="grid gap-8 sm:grid-cols-2"><ScoreRing score={result.matchScore} label="Job match" /><ScoreRing score={result.strengthScore} label="Resume strength" /></GlassCard>
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard><h3 className="mb-4 flex items-center gap-2 font-bold"><CheckCircle2 className="text-emerald-500" /> Matched skills</h3><div className="flex flex-wrap gap-2">{result.matchedSkills.length ? result.matchedSkills.map(s => <span key={s} className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-700 dark:text-emerald-300">{s}</span>) : <p className="text-sm text-slate-500">No direct matches detected.</p>}</div></GlassCard>
        <GlassCard><h3 className="mb-4 flex items-center gap-2 font-bold"><Target className="text-rose-500" /> Skills gap</h3><div className="flex flex-wrap gap-2">{result.missingSkills.length ? result.missingSkills.map(s => <span key={s} className="rounded-full bg-rose-500/15 px-3 py-1 text-sm text-rose-700 dark:text-rose-300">{s}</span>) : <p className="text-sm text-slate-500">No major gaps detected.</p>}</div></GlassCard>
      </div>
      <GlassCard><h3 className="mb-4 flex items-center gap-2 font-bold"><Lightbulb className="text-amber-500" /> ATS optimization suggestions</h3><div className="space-y-3">{result.suggestions.map((item, i) => <div key={item} className="flex gap-3 rounded-2xl bg-slate-500/5 p-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-xs font-bold text-indigo-500">{i + 1}</span><p className="text-sm text-slate-600 dark:text-slate-300">{item}</p></div>)}</div></GlassCard>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(result.stats).map(([key, value]) => <div key={key} className="rounded-2xl border border-white/10 bg-white/50 p-4 text-center dark:bg-slate-900/40"><strong className="block text-2xl text-indigo-500">{value}</strong><span className="text-xs capitalize text-slate-500">{key.replace(/([A-Z])/g, " $1")}</span></div>)}</div>
    </motion.div>
  );
}
