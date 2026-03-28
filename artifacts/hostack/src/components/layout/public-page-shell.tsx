import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/auth-web";
import { Button } from "@/components/ui/button";
import { Boxes, Github, BookOpen, Activity, ArrowLeft, ArrowRight } from "lucide-react";
import { CHANGELOG_URL, DOCS_URL, PUBLIC_ROUTES, REPO_URL, STATUS_URL } from "@/lib/site-links";

interface PublicPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function PublicPageShell({
  eyebrow,
  title,
  description,
  children,
}: PublicPageShellProps) {
  const { isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
      return;
    }

    login("/dashboard");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
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
          <Link href={PUBLIC_ROUTES.home} className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-violet-400">
              <Boxes className="w-5 h-5" />
            </div>
            Aetheria
          </Link>
          <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <Link href={PUBLIC_ROUTES.about} className="transition-colors hover:text-white">About</Link>
            <Link href={PUBLIC_ROUTES.blog} className="transition-colors hover:text-white">Blog</Link>
            <Link href={PUBLIC_ROUTES.careers} className="transition-colors hover:text-white">Careers</Link>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handlePrimaryAction} className="font-medium">
              {isAuthenticated ? "Go to Dashboard" : "Start Deploying"} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="px-6 pb-10 pt-20 md:pt-24">
          <div className="mx-auto max-w-5xl">
            <Link href={PUBLIC_ROUTES.home} className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>

            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-sm text-violet-400">
                <span>{eyebrow}</span>
              </div>
              <h1 className="mb-5 text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
                {title}
              </h1>
              <p className="text-lg text-zinc-400 md:text-xl">
                {description}
              </p>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto max-w-5xl">
            {children}
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
                Aetheria
              </div>
              <p className="text-sm text-zinc-400">
                Transparent GitHub deployments with a real control plane and worker engine behind them.
              </p>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><Link href={PUBLIC_ROUTES.home} className="transition-colors hover:text-white">Home</Link></li>
                <li><a href={`${PUBLIC_ROUTES.home}#features`} className="transition-colors hover:text-white">Features</a></li>
                <li><a href={`${PUBLIC_ROUTES.home}#compare`} className="transition-colors hover:text-white">Pricing</a></li>
                <li><a href={CHANGELOG_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">Resources</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href={DOCS_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-white"><BookOpen className="w-3.5 h-3.5" /> Docs</a></li>
                <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-white"><Github className="w-3.5 h-3.5" /> GitHub</a></li>
                <li><a href={STATUS_URL} className="flex items-center gap-1.5 transition-colors hover:text-white"><Activity className="w-3.5 h-3.5" /> Status</a></li>
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
            <p>&copy; {new Date().getFullYear()} Aetheria Build Flow. All rights reserved.</p>
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
