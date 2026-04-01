import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/auth-web";
import { useLocation } from "wouter";
import { ArrowRight, Eye, Zap, Bot, Shield } from "lucide-react";

export default function About() {
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
      eyebrow="About Hostack"
      title="Deployment infrastructure that doesn't hide the details."
      description="Hostack is a deploy-from-GitHub platform built around transparency, observability, and AI-native workflows for modern development teams."
    >
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">The Problem</h2>
        <Card>
          <CardContent className="space-y-4 pt-6 text-zinc-300">
            <p>
              Modern deployment platforms feel magical right up until something breaks. When a build fails in a way that doesn't match the error message, when a deployment succeeds but the app behaves differently in production, when you need to understand exactly what Docker image ran your build—most platforms leave you guessing.
            </p>
            <p>
              The "magic" of one-click deployments is real and valuable. But magic shouldn't mean opacity. The build path, runtime assumptions, and rollback model should be visible to the team operating the platform, not hidden behind abstractions that only matter when they fail.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">Our Approach</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <Eye className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Transparent by Default</CardTitle>
              <CardDescription>
                Every build step, every Docker image, every environment variable injection is visible. You can see exactly what ran, when, and why—not just whether it succeeded.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <Bot className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">AI That Augments, Not Replaces</CardTitle>
              <CardDescription>
                Our AI copilot suggests build configurations, detects framework patterns, and helps diagnose failures. But you're always in control—the copilot advises, you decide.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <Zap className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Speed Without Compromise</CardTitle>
              <CardDescription>
                Automated deployments on every push, preview environments for every PR, and one-click rollbacks. Transparency doesn't mean slower—it means you can move fast with confidence.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Security Without Friction</CardTitle>
              <CardDescription>
                SSH deploy keys per project, encrypted environment variables, and scoped access controls. Security that works with your workflow, not against it.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">Why AI-Native Deployment Matters</h2>
        <Card>
          <CardContent className="space-y-4 pt-6 text-zinc-300">
            <p>
              The next wave of developer tooling isn't about replacing engineers—it's about reducing the cognitive overhead of operational tasks that don't require human judgment. Configuring build commands, detecting framework versions, diagnosing common error patterns: these are tasks where AI can meaningfully reduce friction.
            </p>
            <p>
              Hostack embeds AI at the deployment layer, where it has the most context: your repository structure, your build history, your environment configuration, and your deployment patterns. A copilot that knows your stack can give you better suggestions than one that's working from generic knowledge alone.
            </p>
            <p>
              We're building toward a future where the deployment platform understands your application well enough to catch configuration mistakes before they become incidents, suggest optimizations based on observed patterns, and explain failures in terms of your specific setup—not generic documentation.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-zinc-900">
          <CardContent className="py-12 text-center">
            <h2 className="mb-4 text-3xl font-semibold text-white">Start deploying with Hostack</h2>
            <p className="mb-8 text-lg text-zinc-400">
              Free forever for personal projects. No credit card required.
            </p>
            <Button size="lg" onClick={handleCTA} className="h-12 px-10 text-base">
              {isAuthenticated ? "Go to Dashboard" : "Get Started Free"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </PublicPageShell>
  );
}
