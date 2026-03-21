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
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-glow.png`}
          alt=""
          className="w-full h-full object-cover mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
      </div>

      <nav className="relative z-10 border-b border-white/5 bg-background/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={PUBLIC_ROUTES.home} className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
              <Boxes className="w-5 h-5" />
            </div>
            Hostack
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <Link href={PUBLIC_ROUTES.about} className="hover:text-white transition-colors">About</Link>
            <Link href={PUBLIC_ROUTES.blog} className="hover:text-white transition-colors">Blog</Link>
            <Link href={PUBLIC_ROUTES.careers} className="hover:text-white transition-colors">Careers</Link>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handlePrimaryAction} className="font-semibold shadow-lg shadow-primary/20">
              {isAuthenticated ? "Go to Dashboard" : "Start Deploying"} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="pt-20 md:pt-24 pb-10 px-6">
          <div className="max-w-5xl mx-auto">
            <Link href={PUBLIC_ROUTES.home} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-8">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>

            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-6">
                <span>{eyebrow}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-tight mb-5">
                {title}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </section>
      </main>

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
                Transparent GitHub deployments with a real control plane and worker engine behind them.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href={PUBLIC_ROUTES.home} className="hover:text-white transition-colors">Home</Link></li>
                <li><a href={`${PUBLIC_ROUTES.home}#features`} className="hover:text-white transition-colors">Features</a></li>
                <li><a href={`${PUBLIC_ROUTES.home}#compare`} className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href={CHANGELOG_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href={DOCS_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Docs</a></li>
                <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5"><Github className="w-3.5 h-3.5" /> GitHub</a></li>
                <li><a href={STATUS_URL} className="hover:text-white transition-colors flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href={PUBLIC_ROUTES.about} className="hover:text-white transition-colors">About</Link></li>
                <li><Link href={PUBLIC_ROUTES.blog} className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href={PUBLIC_ROUTES.careers} className="hover:text-white transition-colors">Careers</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Hostack. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href={PUBLIC_ROUTES.privacy} className="hover:text-white transition-colors">Privacy</Link>
              <Link href={PUBLIC_ROUTES.terms} className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
