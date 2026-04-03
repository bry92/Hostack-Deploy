import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/auth-web";
import { useLocation } from "wouter";
import { Zap, GitBranch, Bot, RotateCcw, Globe, Shield, Terminal, ArrowRight } from "lucide-react";

export default function Product() {
  const { isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();

  const handleCTA = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
      return;
    }
    login("/dashboard");
  };

  return (
    <PublicPageShell
      eyebrow="Product"
      title="AI-powered deployment platform built for transparency."
      description="Hostack combines automated GitHub deployments with real-time observability, preview environments, and an AI copilot that understands your build context."
    >
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">How Hostack Works</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <GitBranch className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Connect Your Repository</CardTitle>
              <CardDescription>
                Link your GitHub repository and Hostack automatically detects your framework, build commands, and environment requirements.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <Bot className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">AI Copilot Analysis</CardTitle>
              <CardDescription>
                Our AI copilot analyzes your codebase, suggests optimal build configurations, and auto-configures environment variables based on detected dependencies.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <Zap className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Automated Deployments</CardTitle>
              <CardDescription>
                Every push triggers a deployment. Watch real-time build logs, see exactly what's happening, and get instant preview URLs for every branch.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <Globe className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Production Ready</CardTitle>
              <CardDescription>
                Custom domains, automatic SSL, edge CDN distribution, and one-click rollbacks. Everything you need to ship with confidence.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">Key Capabilities</h2>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Terminal className="h-5 w-5 text-violet-400" />
                Real-Time Build Logs
              </CardTitle>
              <CardDescription>
                Stream build logs in real-time via SSE. Filter by log level, search for specific errors, and download complete build artifacts for debugging.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <RotateCcw className="h-5 w-5 text-violet-400" />
                Instant Rollbacks
              </CardTitle>
              <CardDescription>
                Every deployment is versioned and immutable. Roll back to any previous deployment with a single click—no rebuild required.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Shield className="h-5 w-5 text-violet-400" />
                SSH Key Support
              </CardTitle>
              <CardDescription>
                Generate ED25519 SSH keys for private repositories. No need to share personal access tokens—Hostack manages deploy keys securely.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">Why Hostack Is Different</h2>
        <Card className="border-violet-500/20 bg-zinc-900">
          <CardContent className="space-y-4 pt-6 text-zinc-300">
            <p>
              Most deployment platforms hide the complexity behind "magic" abstractions. That works great—until something breaks. Hostack takes a different approach: we believe transparency and automation aren't mutually exclusive.
            </p>
            <p>
              You get the speed and convenience of automated deployments, but with full visibility into framework detection, build execution, worker state, and deployment artifacts. When you need to debug, you have the tools. When you don't, everything just works.
            </p>
            <p>
              Our AI copilot doesn't replace your judgment—it augments it. It suggests configurations, detects common patterns, and helps you avoid pitfalls, but you're always in control.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-zinc-900">
          <CardContent className="py-12 text-center">
            <h2 className="mb-4 text-3xl font-semibold text-white">Ready to deploy smarter?</h2>
            <p className="mb-8 text-lg text-zinc-400">
              Join developers who ship faster with AI-powered deployments.
            </p>
            <Button size="lg" onClick={handleCTA} className="h-12 px-10 text-base">
              {isAuthenticated ? "Go to Dashboard" : "Get Started - It's Free"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </PublicPageShell>
  );
}
