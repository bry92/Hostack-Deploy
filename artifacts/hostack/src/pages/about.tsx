import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const PILLARS = [
  {
    title: "Transparent by default",
    description: "Aetheria shows the actual build, runtime, and deployment path instead of hiding them behind opaque platform conventions.",
  },
  {
    title: "GitHub-native workflows",
    description: "Projects begin with a repo, a branch, and a deployment plan. Aetheria stays close to that source of truth instead of inventing a second system.",
  },
  {
    title: "Control plane and workers",
    description: "The API orchestrates. Background workers execute. That separation keeps deployments observable, recoverable, and easier to scale.",
  },
];

export default function About() {
  return (
    <PublicPageShell
      eyebrow="About Aetheria"
      title="A deployment platform that refuses to be a black box."
      description="Aetheria Build Flow is being built to give teams Vercel-level speed with clearer control over builds, workers, logs, runtime behavior, and rollback."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {PILLARS.map((pillar) => (
          <Card key={pillar.title}>
            <CardHeader>
              <CardTitle className="text-white">{pillar.title}</CardTitle>
              <CardDescription>{pillar.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-white">What Aetheria already does</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            <p>Connect GitHub repositories, create projects, queue deployments, stream logs, and keep a deployment history tied to authenticated users.</p>
            <p>The current architecture already separates frontend, API, shared DB schema, and worker execution inside the monorepo.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-white">What comes next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            <p>Repo analysis as a first-class module, stronger worker lease handling, immutable release activation, and instant rollback through release pointer switching.</p>
            <p>The goal is a production-grade control plane, not another hidden CI pipeline wrapped in nice marketing.</p>
          </CardContent>
        </Card>
      </div>
    </PublicPageShell>
  );
}
