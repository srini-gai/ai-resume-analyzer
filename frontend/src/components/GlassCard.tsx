import type { PropsWithChildren } from "react";

export function GlassCard({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <section className={`rounded-3xl border border-white/15 bg-white/70 p-6 shadow-xl backdrop-blur-xl dark:bg-slate-900/55 ${className}`}>{children}</section>;
}
