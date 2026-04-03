import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PUBLIC_ROUTES, REPO_URL } from "@/lib/site-links";
import { BookOpen, Github, Activity, FileText, Puzzle, Rocket, ArrowRight, ExternalLink } from "lucide-react";

const RESOURCES = [
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Comprehensive guides for getting started, configuring deployments, managing domains, and using all platform features.",
    href: PUBLIC_ROUTES.docs,
    cta: "Read the Docs",
    external: false,
  },
  {
    icon: FileText,
    title: "Blog",
    description: "Architecture decisions, implementation milestones, and the operational details behind building a transparent deployment platform.",
    href: PUBLIC_ROUTES.blog,
    cta: "Read the Blog",
    external: false,
  },
  {
    icon: Activity,
    title: "System Status",
    description: "Real-time status of the Hostack platform—API, deployments, log streaming, domain provisioning, and integrations.",
    href: PUBLIC_ROUTES.status,
    cta: "Check Status",
    external: false,
  },
  {
    icon: Github,
    title: "GitHub",
    description: "Explore the open source components of Hostack, contribute to the platform, and follow development updates.",
    href: PUBLIC_ROUTES.github,
    cta: "View on GitHub",
    external: false,
  },
  {
    icon: Activity,
    title: "Changelog",
    description: "A running log of every feature, fix, and improvement shipped to the platform. See what's new and what's coming.",
    href: PUBLIC_ROUTES.changelog,
    cta: "View Changelog",
    external: false,
  },
  {
    icon: Puzzle,
    title: "Integrations Guide",
    description: "Step-by-step guides for connecting Slack, Discord, Sentry, Datadog, Cloudflare, and other supported integrations.",
    href: PUBLIC_ROUTES.docsIntegrations,
    cta: "Integration Guides",
    external: false,
  },
];

const DEPLOYMENT_GUIDES = [
  { title: "Deploy a Next.js app", href: PUBLIC_ROUTES.docsGettingStarted },
  { title: "Deploy a static site", href: PUBLIC_ROUTES.docsGettingStarted },
  { title: "Deploy a Node.js API", href: PUBLIC_ROUTES.docsDeployments },
  { title: "Connect a custom domain", href: PUBLIC_ROUTES.docsDomains },
  { title: "Set up SSH keys for private repos", href: PUBLIC_ROUTES.docsSshKeys },
  { title: "Configure preview environments", href: PUBLIC_ROUTES.docsPreview },
  { title: "Roll back a deployment", href: PUBLIC_ROUTES.docsRollback },
  { title: "Add environment variables", href: PUBLIC_ROUTES.docsEnvVars },
];

export default function Resources() {
  return (
    <PublicPageShell
      eyebrow="Resources"
      title="Everything you need to get the most out of Hostack."
      description="Documentation, guides, status updates, and community resources—all in one place."
    >
      <section className="mb-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((resource) => {
            const Icon = resource.icon;
            return (
              <Card key={resource.title} className="flex flex-col">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-white">{resource.title}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  {resource.external ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={resource.href} target="_blank" rel="noreferrer">
                        {resource.cta} <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={resource.href}>
                        {resource.cta} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-semibold text-white">Deployment Guides</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-2 md:grid-cols-2">
              {DEPLOYMENT_GUIDES.map((guide) => (
                <Link
                  key={guide.title}
                  href={guide.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  <Rocket className="h-4 w-4 shrink-0 text-violet-400" />
                  {guide.title}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </PublicPageShell>
  );
}
