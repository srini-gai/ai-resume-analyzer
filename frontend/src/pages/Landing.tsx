import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import {
  FileSearch, Sparkles, Mail, MessageSquare, Layers, FileText,
  ArrowRight, Star, ChevronDown, Zap, Check, X as XIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  isAuthenticated: boolean;
  userName?: string | null;
  onGoToApp: () => void;
}

// ─── Scroll fade-in helper ────────────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated hero mockup ─────────────────────────────────────────────────────

const SKILL_PILLS = [
  { label: "React ✓",       matched: true,  delay: 0.7 },
  { label: "TypeScript ✓",  matched: true,  delay: 0.9 },
  { label: "AWS ✓",         matched: true,  delay: 1.1 },
  { label: "GraphQL ✗",     matched: false, delay: 1.3 },
  { label: "Kubernetes ✗",  matched: false, delay: 1.5 },
];

function MockupCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 36, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
      className="relative rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl shadow-indigo-500/10"
    >
      {/* Glow */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/5" />

      {/* Scores */}
      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-bold text-white">Analysis Complete</span>
        <div className="flex gap-2">
          <span className="rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-400">
            Match: 87%
          </span>
          <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-bold text-violet-400">
            Strength: 91%
          </span>
        </div>
      </div>

      {/* Progress bars */}
      <div className="mb-5 space-y-3">
        {[
          { label: "Technical Skills", pct: 92, color: "from-indigo-500 to-violet-500" },
          { label: "ATS Keywords",     pct: 79, color: "from-emerald-500 to-teal-500" },
          { label: "Impact Language",  pct: 88, color: "from-amber-500 to-orange-500" },
        ].map(({ label, pct, color }) => (
          <div key={label}>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-slate-400">{label}</span>
              <span className="font-bold text-white">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
                className={`h-1.5 rounded-full bg-gradient-to-r ${color}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Skill pills — stagger in */}
      <div className="flex flex-wrap gap-1.5">
        {SKILL_PILLS.map(({ label, matched, delay }) => (
          <motion.span
            key={label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay }}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              matched
                ? "bg-emerald-900/40 text-emerald-400"
                : "bg-slate-800 text-slate-500"
            }`}
          >
            {label}
          </motion.span>
        ))}
      </div>

      {/* Badge */}
      <div className="absolute -bottom-3 -right-3 rounded-xl border border-indigo-500/30 bg-[#07091a] px-3 py-1.5 text-xs font-bold text-indigo-400 shadow-lg">
        ✦ Powered by Claude AI
      </div>
    </motion.div>
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: <Zap size={20} />,           title: "Resume Analyzer",  desc: "Match your CV to any JD in seconds with AI-powered gap analysis.", color: "from-indigo-500 to-violet-500" },
  { icon: <Mail size={20} />,          title: "Cover Letter",     desc: "Write tailored, professional cover letters instantly.", color: "from-teal-500 to-emerald-500" },
  { icon: <MessageSquare size={20} />, title: "Interview Prep",   desc: "Practice with AI that knows your actual CV and target role.", color: "from-amber-500 to-orange-500" },
  { icon: <Layers size={20} />,        title: "Batch Apply",      desc: "Apply to 10 companies with personalised letters in one click.", color: "from-violet-600 to-purple-600" },
  { icon: <FileText size={20} />,      title: "Resume Builder",   desc: "Build a professional, ATS-ready CV from scratch in minutes.", color: "from-rose-500 to-pink-500" },
];

const STEPS = [
  { num: "01", title: "Upload Resume",         desc: "PDF or Word — we parse and understand every detail." },
  { num: "02", title: "Paste Job Description", desc: "Copy the requirements and responsibilities from any job post." },
  { num: "03", title: "Get AI Insights",       desc: "Instant gap analysis, rewritten resume, and a coaching report." },
];

const TESTIMONIALS = [
  {
    quote: "Got 3 interviews in a week after optimizing my resume with ResumeIQ. The gap analysis showed exactly what was missing.",
    name: "Priya S.", role: "Software Engineer at Infosys",
  },
  {
    quote: "The resume-aware interview prep is like having a personal coach who read my entire CV. Questions were spot-on.",
    name: "Rahul M.", role: "Product Manager at Flipkart",
  },
  {
    quote: "Generated 5 tailored cover letters in under 2 minutes. Absolutely incredible tool.",
    name: "Ananya K.", role: "Data Analyst at Deloitte",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "/month",
    features: [
      { text: "3 resume analyses / month",  ok: true },
      { text: "Cover letter generator",      ok: true },
      { text: "Interview prep (3 questions)",ok: true },
      { text: "Batch apply",                 ok: false },
      { text: "Analysis history",            ok: false },
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹999",
    period: "/month",
    badge: "Most Popular",
    features: [
      { text: "Unlimited analyses",          ok: true },
      { text: "All features unlocked",       ok: true },
      { text: "Batch apply (10 companies)",  ok: true },
      { text: "Analysis history",            ok: true },
      { text: "Priority support",            ok: true },
    ],
    cta: "Get Pro",
    highlight: true,
  },
  {
    name: "Team",
    price: "₹2,999",
    period: "/month",
    features: [
      { text: "Everything in Pro",           ok: true },
      { text: "5 team members",              ok: true },
      { text: "Admin dashboard",             ok: true },
      { text: "Custom templates",            ok: true },
      { text: "Dedicated support",           ok: true },
    ],
    cta: "Get Team",
    highlight: false,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Landing({ isAuthenticated, userName, onGoToApp }: Props) {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const ctaButton = isAuthenticated ? (
    <button
      onClick={onGoToApp}
      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-7 py-3.5 font-bold text-white shadow-xl shadow-indigo-500/25 transition hover:brightness-110"
    >
      Go to App <ArrowRight size={16} />
    </button>
  ) : (
    <a
      href="/auth/google"
      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-7 py-3.5 font-bold text-white shadow-xl shadow-indigo-500/25 transition hover:brightness-110"
    >
      Continue with Google <ArrowRight size={16} />
    </a>
  );

  return (
    <div className="min-h-screen bg-[#07091a] text-white">

      {/* ── Animated background orbs ─────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute -right-32 top-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/8 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 8 }}
          className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-indigo-500/6 blur-3xl"
        />
      </div>

      {/* ── Sticky Nav ───────────────────────────────────────────────────── */}
      <nav
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          navScrolled
            ? "border-b border-slate-800/80 bg-[#07091a]/90 backdrop-blur-xl"
            : ""
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <div className="flex items-center gap-2 font-bold text-lg">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
              <FileSearch size={18} className="text-white" />
            </span>
            ResumeIQ
          </div>

          <div className="hidden items-center gap-6 sm:flex">
            <button onClick={() => scrollTo("features")} className="text-sm text-slate-400 transition hover:text-white">Features</button>
            <button onClick={() => scrollTo("pricing")}  className="text-sm text-slate-400 transition hover:text-white">Pricing</button>
            {isAuthenticated ? (
              <button
                onClick={onGoToApp}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2 text-sm font-bold shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
              >
                Go to App →
              </button>
            ) : (
              <a
                href="/auth/google"
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2 text-sm font-bold shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
              >
                Sign In
              </a>
            )}
          </div>

          {/* Mobile sign-in */}
          <div className="sm:hidden">
            {isAuthenticated ? (
              <button onClick={onGoToApp} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold">
                App →
              </button>
            ) : (
              <a href="/auth/google" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold">
                Sign In
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-36 sm:px-10">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left copy */}
          <div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-indigo-400">
                <Sparkles size={12} /> ✦ Powered by Claude AI
              </div>

              <h1 className="mb-5 text-[3.25rem] font-black leading-[1.05] tracking-tight sm:text-6xl">
                Land your dream job{" "}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                  faster.
                </span>
              </h1>

              <p className="mb-8 max-w-lg text-lg leading-relaxed text-slate-400">
                AI-powered resume analysis, personalised cover letters, and interview prep — all in one platform.
              </p>

              <div className="mb-6 flex flex-wrap gap-3">
                {ctaButton}
                <button
                  onClick={() => scrollTo("how-it-works")}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 px-6 py-3.5 font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  See how it works <ChevronDown size={15} />
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-3">
                {["🔒 Invite Only", "⚡ Powered by Claude AI", "🎯 ATS Optimized"].map(badge => (
                  <span key={badge} className="rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1 text-xs font-medium text-slate-400">
                    {badge}
                  </span>
                ))}
              </div>

              {isAuthenticated && userName && (
                <p className="mt-5 text-sm text-slate-500">
                  Welcome back, <span className="font-semibold text-indigo-400">{userName.split(" ")[0]}</span>!
                </p>
              )}
            </motion.div>
          </div>

          {/* Right: mockup card */}
          <div className="hidden lg:block">
            <MockupCard />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="relative mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <FadeIn className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Features</p>
          <h2 className="text-3xl font-black sm:text-4xl">Everything you need to get hired</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">One platform for the entire job-search workflow.</p>
        </FadeIn>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.07}>
              <div className="group h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/8">
                <div className={`mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} text-white shadow-lg`}>
                  {f.icon}
                </div>
                <h3 className="mb-2 font-bold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative mx-auto max-w-5xl px-6 py-24 sm:px-10">
        <FadeIn className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Process</p>
          <h2 className="text-3xl font-black sm:text-4xl">Get hired in 3 steps</h2>
        </FadeIn>

        <div className="relative grid gap-10 sm:grid-cols-3">
          {/* Dashed connector line — desktop only */}
          <div
            aria-hidden
            className="absolute left-[calc(1/6*100%)] right-[calc(1/6*100%)] top-8 hidden h-px border-t border-dashed border-slate-700 sm:block"
          />
          {STEPS.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.12} className="relative text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.4 }}
                className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-2xl font-black text-indigo-400"
              >
                {s.num}
              </motion.div>
              <h3 className="mb-2 font-bold text-white">{s.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{s.desc}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <FadeIn className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Testimonials</p>
          <h2 className="text-3xl font-black sm:text-4xl">Loved by job seekers</h2>
        </FadeIn>

        <div className="grid gap-5 sm:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={13} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mb-5 flex-1 text-sm leading-relaxed text-slate-300">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="relative mx-auto max-w-5xl px-6 py-24 sm:px-10">
        <FadeIn className="mb-4 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Pricing</p>
          <h2 className="mb-2 text-3xl font-black sm:text-4xl">Simple, transparent pricing</h2>
          <p className="text-sm text-slate-400">
            Currently invite-only. Request access and we&apos;ll review within 24 hours.
          </p>
        </FadeIn>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.08}>
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-7 ${
                  plan.highlight
                    ? "border-indigo-500/60 bg-gradient-to-b from-indigo-500/5 to-transparent shadow-2xl shadow-indigo-500/10"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-1 text-xs font-bold shadow-lg">
                    {plan.badge}
                  </div>
                )}

                <h3 className="mb-1 text-lg font-black text-white">{plan.name}</h3>
                <div className="mb-6 flex items-end gap-1">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="mb-1 text-sm text-slate-400">{plan.period}</span>
                </div>

                <ul className="mb-8 flex-1 space-y-2.5">
                  {plan.features.map(f => (
                    <li key={f.text} className="flex items-center gap-2.5 text-sm">
                      {f.ok
                        ? <Check size={14} className="shrink-0 text-emerald-400" />
                        : <XIcon size={14} className="shrink-0 text-slate-600" />}
                      <span className={f.ok ? "text-slate-300" : "text-slate-600"}>{f.text}</span>
                    </li>
                  ))}
                </ul>

                {isAuthenticated ? (
                  <button
                    onClick={onGoToApp}
                    className={`block w-full rounded-xl py-3 text-center text-sm font-bold transition ${
                      plan.highlight
                        ? "bg-gradient-to-r from-indigo-600 to-violet-500 text-white hover:brightness-110"
                        : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
                    }`}
                  >
                    {plan.cta}
                  </button>
                ) : (
                  <a
                    href="/auth/google"
                    className={`block w-full rounded-xl py-3 text-center text-sm font-bold transition ${
                      plan.highlight
                        ? "bg-gradient-to-r from-indigo-600 to-violet-500 text-white hover:brightness-110"
                        : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
                    }`}
                  >
                    {plan.cta}
                  </a>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative border-t border-slate-800 px-6 py-12 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <FileSearch size={15} />
              </span>
              <span className="font-bold text-white">ResumeIQ</span>
              <span className="text-sm font-normal text-slate-500">— AI-powered career intelligence</span>
            </div>
            <div className="flex gap-5 text-sm text-slate-500">
              <a href="#" className="transition hover:text-white">Privacy Policy</a>
              <a href="#" className="transition hover:text-white">Terms of Service</a>
              <a href="#" className="transition hover:text-white">Contact</a>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-800 pt-6 text-xs text-slate-600 sm:flex-row">
            <span>Built with ♥ and Claude AI by Srini · Bangalore, India</span>
            <span>© 2026 ResumeIQ. All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
