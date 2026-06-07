import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return <button aria-label="Toggle theme" onClick={toggle} className="rounded-full border border-white/15 bg-white/70 p-2.5 text-slate-700 transition hover:scale-105 dark:bg-slate-900/70 dark:text-slate-200">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>;
}
