import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PUBLIC_ROUTES } from "@/lib/site-links";
import { FileText, Users, ArrowRight } from "lucide-react";

export default function Company() {
  return (
    <PublicPageShell
      eyebrow="Company"
      title="Building deployment infrastructure that doesn't hide the details."
      description="Hostack is a deployment platform designed around transparency, observability, and AI-native workflows."
    >
      <section className="mb-12">
        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-zinc-300">
            Most deployment platforms treat the build engine as a black box. That works great—until something breaks. Hostack takes a different approach: we believe transparency and automation aren't mutually exclusive.
          </p>
          <p className="text-zinc-300">
            You get the speed and convenience of automated deployments, but with full visibility into framework detection, build execution, worker state, and deployment artifacts. When you need to debug, you have the tools. When you don't, everything just works.
          </p>
          <p className="text-zinc-300">
            Our AI copilot doesn't replace your judgment—it augments it. It suggests configurations, detects common patterns, and helps you avoid pitfalls, but you're always in control.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">Learn More</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <FileText className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">About Hostack</CardTitle>
              <CardDescription>
                Read about our mission, the problem we're solving, and why AI-native deployment infrastructure matters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link href={PUBLIC_ROUTES.about}>
                  Read About Us <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <FileText className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Blog</CardTitle>
              <CardDescription>
                Architecture decisions, implementation milestones, and the operational details that usually stay hidden.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link href={PUBLIC_ROUTES.blog}>
                  Read the Blog <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle className="text-white">Careers</CardTitle>
              <CardDescription>
                Small team, hard problems, no fake hiring page. See what it's like to work on Hostack.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link href={PUBLIC_ROUTES.careers}>
                  View Careers <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicPageShell>
  );
}
