import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export default function Careers() {
  return (
    <PublicPageShell
      eyebrow="Careers"
      title="Small team, hard problems, no fake hiring page."
      description="Hostack is still early. We are not listing open roles yet, but the kind of work we care about is already clear."
    >
      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Systems thinking</CardTitle>
            <CardDescription>
              Control planes, workers, queue semantics, runtime activation, and recovery paths. Building deployment infrastructure that scales and stays debuggable.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Product discipline</CardTitle>
            <CardDescription>
              Fast developer experience matters, but only if the operational model remains understandable. We optimize for clarity, not just speed.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Honest software</CardTitle>
            <CardDescription>
              No fake automation, no hidden steps, and no pretending reliability appears after launch. Transparency is a design principle, not a marketing claim.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-white">What working on Hostack looks like</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-300">
          <p>
            Hostack is a deployment platform built around observability, AI-native workflows, and transparent execution. The technical challenges are real: distributed worker orchestration, real-time log streaming, AI copilot integration, framework detection, and rollback semantics.
          </p>
          <p>
            The product challenges are equally real: how do you make deployment infrastructure that's both powerful and approachable? How do you surface complexity without overwhelming users? How do you build AI features that actually help, not just check a box?
          </p>
          <p>
            If those questions sound interesting, you're the kind of person we want to work with.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-white">How to get on the radar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-300">
          <p>
            There are no open public roles today. If that changes, this page will carry the real openings.
          </p>
          <p>
            Until then, the best signal is thoughtful product or engineering feedback, reproducible bug reports, and strong technical reasoning on the platform direction. If you're using Hostack and have ideas on how to make it better, we want to hear from you.
          </p>
          <div className="pt-4">
            <Button asChild variant="outline">
              <a href="mailto:careers@hostack.dev">
                <Mail className="mr-2 h-4 w-4" />
                Get in Touch
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PublicPageShell>
  );
}
