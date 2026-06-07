export function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? "#34d399" : score >= 50 ? "#818cf8" : "#fb7185";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid size-36 place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, rgba(148,163,184,.18) 0deg)` }}>
        <div className="grid size-28 place-items-center rounded-full bg-slate-50 text-center dark:bg-slate-950">
          <strong className="text-4xl">{score}</strong><span className="-mt-4 text-xs text-slate-500">/ 100</span>
        </div>
      </div>
      <p className="font-medium text-slate-600 dark:text-slate-300">{label}</p>
    </div>
  );
}
