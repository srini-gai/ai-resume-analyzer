import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  FileSearch, Sparkles, Mail, MessageSquare, Layers, FileText,
  ArrowRight, Star, ChevronDown,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated mockup card ─────────────────────────────────────────────────────

function MockupCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
      className="relative rounded-2xl border border-slate-700/60 bg-slate-900 p-5 shadow-2xl shadow-indigo-500/10"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold text-white">Analysis Complete</span>
        <div className="flex gap-2">
          <span className="rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-400">Match: 85%</span>
          <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-bold text-violet-400">Strength: 78%</span>
        </div>
      </div>
      {/* Score bars */}
      <div className="mb-4 space-y-2.5">
        {[
          { label: "Technical Skills", val: 88, color: "from-indigo-500 to-violet-500" },
          { label: "ATS Keywords",     val: 76, color: "from-emerald-500 to-teal-500" },
          { label: "Impact Language",  val: 91, color: "from-amber-500 to-orange-500" },
        ].map(({ label, val, color }) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-400">{label}</span>
              <span className="font-semibold text-white">{val}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${val}%` }}
                transition={{ duration: 0.9, delay: 0.6, ease: "easeOut" }}
                className={`h-1.5 rounded-full bg-gradient-to-r ${color}`}
              />
            </div>
          </div>
        ))}
      </div>
      {/* Skill chips */}
      <div className="flex flex-wrap gap-1.5">
        {["React ✓", "TypeScript ✓", "AWS ✓", "GraphQL ✗", "Kubernetes ✗"].map(skill => (
          <span
            key={skill}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              skill.endsWith("✓")
                ? "bg-emerald-900/40 text-emerald-400"
                : "bg-slate-800 text-slate-500"
            }`}
          >
            {skill}
          </span>
        ))}
      </div>
      {/* Floating badge */}
      <div className="absolute -bottom-3 -right-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-400 shadow-lg backdrop-blur-sm">
        ✦ Powered by Claude AI
      </div>
    </motion.div>
  );
}

// ─── Features data ────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: <FileSearch size={20} />, title: "Resume Analyzer", desc: "Match your CV to any job in seconds with AI-powered gap analysis.", color: "from-indigo-500 to-violet-500" },
  { icon: <Mail size={20} />, title: "Cover Letter", desc: "Write tailored, professional cover letters instantly.", color: "from-teal-500 to-emerald-500" },
  { icon: <MessageSquare size={20} />, title: "Interview Prep", desc: "Practice with AI that knows your resume and the target role.", color: "from-amber-500 to-orange-500" },
  { icon: <Layers size={20} />, title: "Batch Apply", desc: "Apply to 10 companies with personalised letters in one click.", color: "from-violet-600 to-purple-600" },
  { icon: <FileText size={20} />, title: "Resume Builder", desc: "Build a professional, ATS-ready CV from scratch in minutes.", color: "from-rose-500 to-pink-500" },
];

const STEPS = [
  { num: "01", title: "Upload your resume", desc: "PDF or Word — we extract and understand every detail." },
  { num: "02", title: "Paste the job description", desc: "Copy the role requirements, responsibilities, and required skills." },
  { num: "03", title: "Get AI-powered insights", desc: "Instant gap analysis, rewritten resume, and a full coaching report." },
];

const TESTIMONIALS = [
  { quote: "Got 3 interviews in a week after optimizing my resume. The gap analysis showed exactly what was missing.", name: "Priya S.", role: "Software Engineer", stars: 5 },
  { quote: "The interview prep feature is like having a personal coach who actually read my CV. Questions were spot-on.", name: "Rahul M.", role: "Product Manager", stars: 5 },
  { quote: "Cover letter generator saved me hours of writing. Each one felt genuinely tailored to the company.", name: "Ananya K.", role: "Data Analyst", stars: 5 },
];

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "",
    features: ["3 analyses / month", "Cover letter generator", "Interview prep", "Resume builder"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹999",
    period: "/month",
    features: ["Unlimited analyses", "Batch apply (10 companies)", "Analysis history", "Priority support", "All free features"],
    cta: "Get Pro",
    highlight: true,
  },
  {
    name: "Team",
    price: "₹2999",
    period: "/month",
    features: ["5 team members", "Shared templates", "Admin dashboard", "Custom branding", "All Pro features"],
    cta: "Get Team",
    highlight: false,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#07091a] text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,.2),transparent_55%),radial-gradient(ellipse_at_80%_20%,rgba(139,92,246,.12),transparent_55%)]" />

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <FileSearch size={18} className="text-white" />
          </span>
          ResumeIQ
        </div>
        <a
          href="/auth/google"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2 text-sm font-bold shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
        >
          Get Started <ArrowRight size={14} />
        </a>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:px-10">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-indigo-400">
                <Sparkles size={12} /> Smart career intelligence
              </div>
              <h1 className="mb-5 text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl">
                Land your dream job{" "}
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                  faster.
                </span>
              </h1>
              <p className="mb-8 max-w-lg text-lg leading-relaxed text-slate-400">
                AI-powered resume analysis, personalised cover letters, and interview prep — all in one platform.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/auth/google"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-3.5 font-bold shadow-xl shadow-indigo-500/25 transition hover:brightness-110"
                >
                  <Sparkles size={16} /> Get Started with Google
                </a>
                <button
                  onClick={() => {
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 px-6 py-3.5 font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                >
                  See how it works <ChevronDown size={15} />
                </button>
              </div>
              <p className="mt-5 text-xs text-slate-500">🔒 Access by invitation only · No credit card required</p>
            </motion.div>
          </div>

          {/* Right — animated mockup */}
          <div className="hidden lg:block">
            <MockupCard />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <FadeIn className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Features</p>
          <h2 className="text-3xl font-black sm:text-4xl">Everything you need to get hired</h2>
        </FadeIn>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.07}>
              <div className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5">
                <div className={`mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} shadow-lg`}>
                  {f.icon}
                </div>
                <h3 className="mb-2 font-bold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative mx-auto max-w-5xl px-6 py-24 sm:px-10">
        <FadeIn className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">How it works</p>
          <h2 className="text-3xl font-black sm:text-4xl">Three steps to a stronger application</h2>
        </FadeIn>
        <div className="relative grid gap-8 sm:grid-cols-3">
          {/* Dashed connector line */}
          <div className="absolute left-[calc(1/6*100%)] right-[calc(1/6*100%)] top-8 hidden h-px border-t border-dashed border-slate-700 sm:block" />
          {STEPS.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.12} className="relative text-center">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-2xl font-black text-indigo-400">
                {s.num}
              </div>
              <h3 className="mb-2 font-bold text-white">{s.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{s.desc}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Social proof ─────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-6 py-24 sm:px-10">
        <FadeIn className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Testimonials</p>
          <h2 className="text-3xl font-black sm:text-4xl">Trusted by job seekers</h2>
        </FadeIn>
        <div className="grid gap-5 sm:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} size={13} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mb-4 text-sm leading-relaxed text-slate-300">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-5xl px-6 py-24 sm:px-10">
        <FadeIn className="mb-4 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Pricing</p>
          <h2 className="mb-2 text-3xl font-black sm:text-4xl">Simple, transparent pricing</h2>
          <p className="text-sm text-slate-400">Currently invite-only. Request access to get started.</p>
        </FadeIn>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.08}>
              <div
                className={`relative rounded-2xl border p-7 ${
                  plan.highlight
                    ? "border-indigo-500/60 bg-indigo-500/5 shadow-xl shadow-indigo-500/10"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-1 text-xs font-bold">
                    Most Popular
                  </div>
                )}
                <h3 className="mb-1 text-lg font-black text-white">{plan.name}</h3>
                <div className="mb-5 flex items-end gap-1">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="mb-1 text-sm text-slate-400">{plan.period}</span>
                </div>
                <ul className="mb-6 space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="text-indigo-400">✦</span> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="/auth/google"
                  className={`block w-full rounded-xl py-2.5 text-center text-sm font-bold transition ${
                    plan.highlight
                      ? "bg-gradient-to-r from-indigo-600 to-violet-500 text-white hover:brightness-110"
                      : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="relative border-t border-slate-800 px-6 py-12 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2 font-bold">
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <FileSearch size={16} />
              </span>
              <span className="text-white">ResumeIQ</span>
              <span className="text-slate-500 text-sm font-normal">— AI-powered career intelligence</span>
            </div>
            <div className="flex gap-5 text-sm text-slate-500">
              <a href="#" className="transition hover:text-white">Privacy Policy</a>
              <a href="#" className="transition hover:text-white">Terms</a>
              <a href="#" className="transition hover:text-white">Contact</a>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-800 pt-6 text-xs text-slate-600 sm:flex-row">
            <span>Built with Claude AI by Srini</span>
            <span>© 2026 ResumeIQ. All rights reserved.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
