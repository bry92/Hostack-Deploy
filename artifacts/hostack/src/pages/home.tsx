import { useLocation } from "wouter";
import { useAuth } from "@workspace/auth-web";
import { Button } from "@/components/ui/button";
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
import { useEffect, useState, useRef } from "react";

const DEPLOY_LINES = [
  { text: "$ hostack deploy --prod", delay: 0, color: "text-green-400" },
  { text: "⠋ Connecting to repository...", delay: 600, color: "text-muted-foreground" },
  { text: "✔ Repository connected (main @ a3f29c1)", delay: 1200, color: "text-cyan-400" },
  { text: "⠋ AI Copilot analyzing build configuration...", delay: 1800, color: "text-purple-400" },
  { text: '✔ Copilot: Detected Next.js 14 — recommending "static export"', delay: 2600, color: "text-purple-400" },
  { text: "✔ Copilot: Auto-configured environment variables (3 secrets)", delay: 3200, color: "text-purple-400" },
  { text: "⠋ Installing dependencies...", delay: 3800, color: "text-muted-foreground" },
  { text: "✔ Dependencies installed (2.1s)", delay: 4600, color: "text-cyan-400" },
  { text: "⠋ Building project...", delay: 5000, color: "text-muted-foreground" },
  { text: "✔ Build completed (4.7s) — 12 pages, 340KB gzip", delay: 6200, color: "text-cyan-400" },
  { text: "⠋ Deploying to edge network...", delay: 6800, color: "text-muted-foreground" },
  { text: "✔ Deployed to 42 edge locations", delay: 7800, color: "text-green-400" },
  { text: "", delay: 8200, color: "" },
  { text: "🚀 Live at https://myapp.hostack.dev", delay: 8400, color: "text-green-400 font-bold" },
  { text: "   Total time: 11.2s", delay: 8800, color: "text-muted-foreground" },
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
      if (cycleTimeout.current) clearTimeout(cycleTimeout.current);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [visibleLines]);

  return (
    <div role="img" aria-label="Simulated deployment terminal showing AI Copilot analyzing and deploying a Next.js project in 11 seconds" className="w-full max-w-2xl mx-auto rounded-xl border border-white/10 bg-black/60 backdrop-blur-sm shadow-2xl shadow-primary/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs text-muted-foreground font-mono">hostack — deploy</span>
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
    description: "Roll back to any previous deployment in one click — zero downtime.",
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
    description: "Every pull request gets its own preview URL — share and review before merging.",
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
  const { isAuthenticated, isLoading, login } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <div className="min-h-screen bg-background" />;

  const handleCTA = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    } else {
      login("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-glow.png`}
          alt=""
          className="w-full h-full object-cover mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
      </div>

      <nav className="relative z-10 border-b border-white/5 bg-background/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
              <Boxes className="w-5 h-5" />
            </div>
            Hostack
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#compare" className="hover:text-white transition-colors">Compare</a>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Button onClick={() => setLocation("/dashboard")} className="font-semibold shadow-lg shadow-primary/20">
                Go to Dashboard
              </Button>
            ) : (
              <Button onClick={() => login("/dashboard")} className="font-semibold shadow-lg shadow-primary/20">
                Log In
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero */}
        <section className="pt-24 md:pt-32 pb-8 px-6 text-center max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300 mb-8">
              <Bot className="w-4 h-4" />
              <span>Powered by AI Deploy Copilot</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
              Your AI Copilot for
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-cyan-400">
                Zero-Config Deploys.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Hostack&apos;s AI analyzes your repo, auto-configures your build, and fixes failures before you even notice.
              Connect, deploy, done — faster than any other platform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={handleCTA} className="h-12 px-8 text-base shadow-xl shadow-primary/25 w-full sm:w-auto">
                {isAuthenticated ? "Enter Dashboard" : "Start Deploying Free"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-white/5 border-white/10 text-white hover:bg-white/10 w-full sm:w-auto">
                Read the Docs
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Fake Terminal */}
        <section className="pb-24 px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <FakeTerminal />
          </motion.div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-24 px-6 border-y border-white/5">
          <div className="max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Three steps. No config files. No YAML nightmares.
              </p>
            </motion.div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-8"
            >
              {HOW_IT_WORKS_STEPS.map((s) => (
                <motion.div key={s.step} variants={itemVariants} className="relative text-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-6">
                    <s.icon className="w-7 h-7" />
                  </div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/30">
                    {s.step}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                  <p className="text-muted-foreground">{s.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 px-6 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything You Need to Ship</h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                From AI-powered configuration to global edge deployments — all in one platform.
              </p>
            </motion.div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {FEATURES.map((f) => (
                <motion.div
                  key={f.title}
                  variants={itemVariants}
                  className={`p-6 rounded-2xl border shadow-xl hover:-translate-y-1 transition-transform duration-300 ${
                    f.highlight
                      ? "bg-gradient-to-br from-purple-500/10 to-primary/10 border-purple-500/30"
                      : "bg-card border-border"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                    f.highlight ? "bg-purple-500/20 text-purple-400" : "bg-primary/10 text-primary"
                  }`}>
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm">{f.description}</p>
                  {f.highlight && (
                    <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                      <Bot className="w-3 h-3" /> Hostack Exclusive
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Comparison Table */}
        <section id="compare" className="py-24 px-6 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How Hostack Compares</h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                The only platform with an AI copilot that configures and fixes your deploys.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/10 overflow-hidden bg-card"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="text-left px-6 py-4 text-muted-foreground font-medium">Feature</th>
                      <th className="text-center px-6 py-4 text-primary font-bold">Hostack</th>
                      <th className="text-center px-6 py-4 text-muted-foreground font-medium">Vercel</th>
                      <th className="text-center px-6 py-4 text-muted-foreground font-medium">Netlify</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_FEATURES.map((row, i) => (
                      <tr key={row.name} className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                        <td className="px-6 py-3.5 text-white font-medium">{row.name}</td>
                        <td className="text-center px-6 py-3.5">
                          {row.hostack ? <><Check aria-hidden className="w-5 h-5 text-green-400 mx-auto" /><span className="sr-only">Yes</span></> : <><X aria-hidden className="w-5 h-5 text-red-400/50 mx-auto" /><span className="sr-only">No</span></>}
                        </td>
                        <td className="text-center px-6 py-3.5">
                          {row.vercel ? <><Check aria-hidden className="w-5 h-5 text-muted-foreground mx-auto" /><span className="sr-only">Yes</span></> : <><X aria-hidden className="w-5 h-5 text-red-400/50 mx-auto" /><span className="sr-only">No</span></>}
                        </td>
                        <td className="text-center px-6 py-3.5">
                          {row.netlify ? <><Check aria-hidden className="w-5 h-5 text-muted-foreground mx-auto" /><span className="sr-only">Yes</span></> : <><X aria-hidden className="w-5 h-5 text-red-400/50 mx-auto" /><span className="sr-only">No</span></>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Band */}
        <section className="py-20 px-6 bg-gradient-to-r from-primary/10 via-purple-500/10 to-cyan-500/10 border-y border-white/5">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to deploy smarter?</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join developers who ship faster with AI-powered deployments. Free forever for personal projects.
            </p>
            <Button size="lg" onClick={handleCTA} className="h-12 px-10 text-base shadow-xl shadow-primary/25">
              {isAuthenticated ? "Go to Dashboard" : "Get Started — It's Free"} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 font-bold text-lg text-white mb-4">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                  <Boxes className="w-4 h-4" />
                </div>
                Hostack
              </div>
              <p className="text-sm text-muted-foreground">
                The AI-powered deployment platform for modern frontend teams.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#compare" className="hover:text-white transition-colors">Compare</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Docs</a></li>
                <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1.5"><Github className="w-3.5 h-3.5" /> GitHub</a></li>
                <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Hostack. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
