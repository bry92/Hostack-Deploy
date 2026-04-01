import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, GitBranch, Star, ExternalLink } from "lucide-react";
import { REPO_URL } from "@/lib/site-links";

export default function GitHubPage() {
  return (
    <PublicPageShell
      eyebrow="GitHub"
      title="Open source components and development updates."
      description="Hostack is being built with transparency as a core value. Some platform components are open source, and development happens in public."
    >
      <section className="mb-12">
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
              <Github className="h-5 w-5" />
            </div>
            <CardTitle className="text-white">Hostack Deploy Repository</CardTitle>
            <CardDescription>
              The core deployment platform, including the API server, worker engine, frontend, and configuration libraries. Development is ongoing and the repository reflects the current state of the platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                <Github className="mr-2 h-4 w-4" />
                View on GitHub <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${REPO_URL}/commits/main`} target="_blank" rel="noreferrer">
                <GitBranch className="mr-2 h-4 w-4" />
                Commit History
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">What's in the repository</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-white">API Server</CardTitle>
              <CardDescription>
                Express-based API with authentication, project management, deployment orchestration, integrations, observability, and SSH key management.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-white">Worker Engine</CardTitle>
              <CardDescription>
                Deployment worker that handles repository cloning, dependency installation, build execution, and artifact serving. Runs in Docker with full isolation.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-white">Frontend</CardTitle>
              <CardDescription>
                React + TypeScript + TailwindCSS dashboard and marketing site. Includes the full component library, routing, and API client code generation.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-white">Libraries</CardTitle>
              <CardDescription>
                Shared packages: API spec (OpenAPI), generated client, Zod validators, database schema (Drizzle), queue system, auth context, and config loader.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-semibold text-white">Contributing</h2>
        <Card>
          <CardContent className="space-y-4 pt-6 text-zinc-300">
            <p>
              Hostack welcomes contributions in the form of bug reports, feature requests, and pull requests. Before submitting a PR, please open an issue to discuss the change.
            </p>
            <p>
              The most valuable contributions right now are reproducible bug reports, performance improvements, and documentation improvements. Check the open issues on GitHub for areas where help is needed.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="outline" asChild>
                <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
                  Open Issues <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`${REPO_URL}/blob/main/README.md`} target="_blank" rel="noreferrer">
                  Read README <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-zinc-700 bg-zinc-900">
          <CardContent className="py-8 text-center">
            <Star className="mx-auto mb-4 h-8 w-8 text-amber-400" />
            <h2 className="mb-2 text-xl font-semibold text-white">Star the repository</h2>
            <p className="mb-6 text-zinc-400">
              If Hostack is useful to you, a GitHub star helps others discover the project.
            </p>
            <Button variant="outline" asChild>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                <Github className="mr-2 h-4 w-4" />
                Star on GitHub <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </PublicPageShell>
  );
}
