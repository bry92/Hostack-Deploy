import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/auth-web";
import { Button } from "@/components/ui/button";
import { CHANGELOG_URL, DEVTO_ARTICLE_URL, DOCS_URL, PUBLIC_ROUTES, REPO_URL, STATUS_URL } from "@/lib/site-links";
import { motion } from "framer-motion";
import {
  Boxes,
  Zap,
  Terminal,
  ArrowRight,
  GitBranch,
  Settings,
  Rocket,
  Bot,
  ScrollText,
  RotateCcw,
  Bell,
  FileCode,
  Globe,
  Check,
  X,
  Github,
  BookOpen,
  Activity,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEPLOY_LINES = [
  { text: "$ hostack deploy --prod", delay: 0, color: "text-green-400" },
  { text: "[~] Connecting to repository...", delay: 600, color: "text-zinc-500" },
  { text: "[ok] Repository connected (main @ a3f29c1)", delay: 1200, color: "text-blue-400" },
  { text: "[~] AI Copilot analyzing build configuration...", delay: 1800, color: "text-violet-400" },
  { text: '[ok] Copilot: Detected Next.js 14 - recommending "static export"', delay: 2600, color: "text-violet-400" },
  { text: "[ok] Copilot: Auto-configured environment variables (3 secrets)", delay: 3200, color: "text-violet-400" },
  { text: "[~] Installing dependencies...", delay: 3800, color: "text-zinc-500" },
  { text: "[ok] Dependencies installed (2.1s)", delay: 4600, color: "text-blue-400" },
  { text: "[~] Building project...", delay: 5000, color: "text-zinc-500" },
  { text: "[ok] Build completed (4.7s) - 12 pages, 340KB gzip", delay: 6200, color: "text-blue-400" },
  { text: "[~] Deploying to edge network...", delay: 6800, color: "text-zinc-500" },
  { text: "[ok] Deployed to 42 edge locations", delay: 7800, color: "text-green-400" },
  { text: "", delay: 8200, color: "" },
  { text: "Live at https://hostack.dev", delay: 8400, color: "text-green-400 font-bold" },
  { text: "   Total time: 11.2s", delay: 8800, color: "text-zinc-500" },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

function FakeTerminal() {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const terminalRef = useRef<HTMLDivElement>(null);
  const cycleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setVisibleLines(DEPLOY_LINES.length);
      return;
    }

    let timeouts: ReturnType<typeof setTimeout>[] = [];

    function runCycle() {
      setVisibleLines(0);
      DEPLOY_LINES.forEach((line, i) => {
        const t = setTimeout(() => {
          setVisibleLines(i + 1);
        }, line.delay);
        timeouts.push(t);
      });

      cycleTimeout.current = setTimeout(() => {
        timeouts.forEach(clearTimeout);
        timeouts = [];
        runCycle();
      }, DEPLOY_LINES[DEPLOY_LINES.length - 1].delay + 3000);
    }

    runCycle();

    return () => {
      timeouts.forEach(clearTimeout);
      if (cycleTimeout.current) {
        clearTimeout(cycleTimeout.current);
      }
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [visibleLines]);

  return (
    <div
      role="img"
      aria-label="Simulated deployment terminal showing AI Copilot analyzing and deploying a Next.js project in 11 seconds"
      className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 font-mono text-xs text-zinc-500">hostack - deploy</span>
      </div>
      <div ref={terminalRef} className="p-4 font-mono text-sm leading-relaxed h-[320px] overflow-y-auto scrollbar-thin">
        {DEPLOY_LINES.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={`${i}-${visibleLines > DEPLOY_LINES.length - 1 ? "r" : ""}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className={`${line.color} ${line.text === "" ? "h-4" : ""}`}
          >
            {line.text}
          </motion.div>
        ))}
        <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
      </div>
    </div>
  );
}

const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    icon: GitBranch,
    title: "Connect Your Repo",
    description: "Link your GitHub repository in one click. Hostack auto-detects your framework and branch.",
  },
  {
    step: 2,
    icon: Settings,
    title: "Configure with AI",
    description: "The AI Copilot analyzes your project, suggests build settings, and sets up environment variables.",
  },
  {
    step: 3,
    icon: Rocket,
    title: "Deploy Instantly",
    description: "Push to deploy. Watch real-time logs stream as your app goes live across the global edge network.",
  },
];

const FEATURES = [
  {
    icon: Bot,
    title: "AI Deploy Copilot",
    description: "AI analyzes your repo, auto-configures builds, and suggests fixes when deployments fail.",
    highlight: true,
  },
  {
    icon: ScrollText,
    title: "Live Log Streaming",
    description: "Watch every build step in real-time with streaming terminal output.",
  },
  {
    icon: RotateCcw,
    title: "Instant Rollbacks",
    description: "Roll back to any previous deployment in one click - zero downtime.",
  },
  {
    icon: Bell,
    title: "Deploy Notifications",
    description: "Get notified on Slack, email, or webhooks when deployments succeed or fail.",
  },
  {
    icon: FileCode,
    title: "Build Rules",
    description: "Customize build commands, output directories, and triggers per branch.",
  },
  {
    icon: Globe,
    title: "Custom Domains",
    description: "Add your own domain with automatic SSL certificates and DNS verification.",
  },
  {
    icon: Zap,
    title: "Edge Deployments",
    description: "Deploy to 42+ edge locations worldwide for sub-50ms response times.",
  },
  {
    icon: GitBranch,
    title: "Preview Deployments",
    description: "Every pull request gets its own preview URL - share and review before merging.",
  },
  {
    icon: Terminal,
    title: "CLI & API Access",
    description: "Deploy from your terminal or integrate with CI/CD using our REST API.",
  },
];

const COMPARISON_FEATURES = [
  { name: "AI Deploy Copilot", hostack: true, vercel: false, netlify: false },
  { name: "Live Log Streaming", hostack: true, vercel: false, netlify: false },
  { name: "Instant Rollbacks", hostack: true, vercel: true, netlify: true },
  { name: "Preview Deployments", hostack: true, vercel: true, netlify: true },
  { name: "Custom Domains", hostack: true, vercel: true, netlify: true },
  { name: "Edge Network", hostack: true, vercel: true, netlify: true },
  { name: "Build Failure Auto-Fix", hostack: true, vercel: false, netlify: false },
  { name: "Deploy Notifications", hostack: true, vercel: true, netlify: true },
  { name: "Free Tier", hostack: true, vercel: true, netlify: true },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Home() {
  const { isAuthenticated, isLoading, login, isFallbackMode } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  const handleCTA = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    } else {
      login("/dashboard");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white selection:bg-violet-500/30">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-20">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-glow.png`}
          alt=""
          className="h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.16),transparent_30%),linear-gradient(to_bottom,rgba(9,9,11,0.2),rgba(9,9,11,1))]" />
      </div>

      <nav className="sticky top-0 relative z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-violet-400">
              <Boxes className="w-5 h-5" />
            </div>
            Hostack
          </div>
          <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it Works</a>
            <a href="#compare" className="transition-colors hover:text-white">Compare</a>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Button onClick={() => setLocation("/dashboard")} className="font-medium">
                Go to Dashboard
              </Button>
            ) : (
              <Button onClick={() => login("/dashboard")} className="font-medium">
                Log In
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {isFallbackMode && (
          <section className="px-6 pt-6">
            <div className="mx-auto max-w-5xl rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Local fallback mode is active. Auth and database-backed API routes are stubbed until real configuration is provided.
            </div>
          </section>
        )}

        <section className="mx-auto max-w-5xl px-6 pb-8 pt-24 text-center md:pt-32">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-sm text-violet-300">
              <Bot className="w-4 h-4" />
              <span>Powered by AI Deploy Copilot</span>
            </div>
            <h1 className="mb-6 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-7xl">
              Your AI Copilot for
              <br />
              <span className="text-zinc-400">
                Zero-Config Deploys.
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 md:text-xl">
              Hostack's AI analyzes your repo, auto-configures your build, and fixes failures before you even notice.
              Connect, deploy, done - faster than any other platform.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" onClick={handleCTA} className="h-12 w-full px-8 text-base sm:w-auto">
                {isAuthenticated ? "Enter Dashboard" : "Start Deploying Free"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 w-full px-8 text-base sm:w-auto">
                <a href={DOCS_URL} target="_blank" rel="noreferrer">
                  Read the Docs
                </a>
              </Button>
            </div>
          </motion.div>
        </section>

        <section className="px-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <FakeTerminal />
          </motion.div>
        </section>

        <section id="how-it-works" className="border-y border-zinc-800 px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-semibold text-white md:text-4xl">How It Works</h2>
              <p className="mx-auto max-w-xl text-lg text-zinc-400">
                Three steps. No config files. No YAML nightmares.
              </p>
            </motion.div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid gap-8 md:grid-cols-3"
            >
              {HOW_IT_WORKS_STEPS.map((s) => (
                <motion.div key={s.step} variants={itemVariants} className="app-panel relative text-center">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-violet-400">
                    <s.icon className="w-7 h-7" />
                  </div>
                  <div className="absolute left-1/2 top-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-sm font-semibold text-violet-300">
                    {s.step}
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-white">{s.title}</h3>
                  <p className="text-zinc-400">{s.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="features" className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-semibold text-white md:text-4xl">Everything You Need to Ship</h2>
              <p className="mx-auto max-w-xl text-lg text-zinc-400">
                From AI-powered configuration to global edge deployments - all in one platform.
              </p>
            </motion.div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {FEATURES.map((f) => (
                <motion.div
                  key={f.title}
                  variants={itemVariants}
                  className={`rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm transition hover:bg-zinc-800 ${
                    f.highlight ? "ring-1 ring-violet-500/20" : ""
                  }`}
                >
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border ${
                    f.highlight ? "border-violet-500/20 bg-violet-500/10 text-violet-400" : "border-zinc-800 bg-zinc-950 text-zinc-300"
                  }`}>
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">{f.title}</h3>
                  <p className="text-sm text-zinc-400">{f.description}</p>
                  {f.highlight && (
                    <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-300">
                      <Bot className="w-3 h-3" /> Hostack Exclusive
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="compare" className="border-t border-zinc-800 px-6 py-24">
          <div className="mx-auto max-w-4xl">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-semibold text-white md:text-4xl">How Hostack Compares</h2>
              <p className="mx-auto max-w-xl text-lg text-zinc-400">
                The only platform with an AI copilot that configures and fixes your deploys.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950">
                      <th className="px-6 py-4 text-left font-medium text-zinc-400">Feature</th>
                      <th className="px-6 py-4 text-center font-semibold text-violet-400">Hostack</th>
                      <th className="px-6 py-4 text-center font-medium text-zinc-400">Vercel</th>
                      <th className="px-6 py-4 text-center font-medium text-zinc-400">Netlify</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_FEATURES.map((row, i) => (
                      <tr key={row.name} className={`border-b border-zinc-800 ${i % 2 === 0 ? "bg-zinc-950/60" : ""}`}>
                        <td className="px-6 py-3.5 font-medium text-white">{row.name}</td>
                        <td className="text-center px-6 py-3.5">
                          {row.hostack ? <><Check aria-hidden className="w-5 h-5 text-green-400 mx-auto" /><span className="sr-only">Yes</span></> : <><X aria-hidden className="w-5 h-5 text-red-400/50 mx-auto" /><span className="sr-only">No</span></>}
                        </td>
                        <td className="text-center px-6 py-3.5">
                          {row.vercel ? <><Check aria-hidden className="mx-auto h-5 w-5 text-zinc-400" /><span className="sr-only">Yes</span></> : <><X aria-hidden className="mx-auto h-5 w-5 text-red-400/50" /><span className="sr-only">No</span></>}
                        </td>
                        <td className="text-center px-6 py-3.5">
                          {row.netlify ? <><Check aria-hidden className="mx-auto h-5 w-5 text-zinc-400" /><span className="sr-only">Yes</span></> : <><X aria-hidden className="mx-auto h-5 w-5 text-red-400/50" /><span className="sr-only">No</span></>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-zinc-800 px-6 py-20">
          <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-12 text-center shadow-sm">
            <h2 className="mb-4 text-3xl font-semibold text-white md:text-4xl">Ready to deploy smarter?</h2>
            <p className="mb-8 text-lg text-zinc-400">
              Join developers who ship faster with AI-powered deployments. Free forever for personal projects.
            </p>
            <Button size="lg" onClick={handleCTA} className="h-12 px-10 text-base">
              {isAuthenticated ? "Go to Dashboard" : "Get Started - It's Free"} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="mb-12 grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-violet-400">
                  <Boxes className="w-4 h-4" />
                </div>
                Hostack
              </div>
              <p className="text-sm text-zinc-400">
                The AI-powered deployment platform for modern frontend teams.
              </p>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><Link href={PUBLIC_ROUTES.features} className="transition-colors hover:text-white">Features</Link></li>
                <li><Link href={PUBLIC_ROUTES.compare} className="transition-colors hover:text-white">Compare</Link></li>
                <li><Link href={PUBLIC_ROUTES.pricing} className="transition-colors hover:text-white">Pricing</Link></li>
                <li><Link href={PUBLIC_ROUTES.changelog} className="transition-colors hover:text-white">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">Resources</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><Link href={PUBLIC_ROUTES.docs} className="flex items-center gap-1.5 transition-colors hover:text-white"><BookOpen className="w-3.5 h-3.5" /> Docs</Link></li>
                <li><Link href={PUBLIC_ROUTES.github} className="flex items-center gap-1.5 transition-colors hover:text-white"><Github className="w-3.5 h-3.5" /> GitHub</Link></li>
                <li><Link href={PUBLIC_ROUTES.status} className="flex items-center gap-1.5 transition-colors hover:text-white"><Activity className="w-3.5 h-3.5" /> Status</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">Company</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><Link href={PUBLIC_ROUTES.about} className="transition-colors hover:text-white">About</Link></li>
                <li><Link href={PUBLIC_ROUTES.blog} className="transition-colors hover:text-white">Blog</Link></li>
                <li><Link href={PUBLIC_ROUTES.careers} className="transition-colors hover:text-white">Careers</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-800 pt-8 text-sm text-zinc-400 sm:flex-row">
            <p>&copy; {new Date().getFullYear()} Hostack. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href={PUBLIC_ROUTES.privacy} className="transition-colors hover:text-white">Privacy</Link>
              <Link href={PUBLIC_ROUTES.terms} className="transition-colors hover:text-white">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
