import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DEVTO_ARTICLE_URL } from "@/lib/site-links";

const POSTS = [
  {
    title: "Peeling Back the Black Box of GitHub Deployments",
    description: "Why Aetheria Build Flow is being built around visibility into framework detection, worker execution, build logs, and deployment artifacts.",
    body: "Modern deployment platforms feel magical right up until something breaks. Aetheria Build Flow is being designed so the build path, runtime assumptions, and rollback model stay visible to the team operating it.",
    href: DEVTO_ARTICLE_URL,
    cta: "Read on DEV",
  },
  {
    title: "Why workers matter before analyzers",
    description: "A queue without a worker is just a waiting room. The first real architectural shift is getting builds out of the API process.",
    body: "Aetheria now has a jobs table, a queue package, and a worker package. That separation is the foundation for build reliability, retries, and real deployment state transitions.",
  },
  {
    title: "Typed config beats mystery YAML",
    description: "The project config direction is about explicit overrides without turning deployments back into user-defined shell spaghetti.",
    body: "A typed config layer lets teams override runtime, build, or specialized project settings while keeping the platform deterministic enough to reason about in production.",
  },
];

export default function Blog() {
  return (
    <PublicPageShell
      eyebrow="Aetheria Build Flow Blog"
      title="Notes from building a transparent deployment platform."
      description="This is the public product journal for Aetheria Build Flow: architecture decisions, implementation milestones, and the operational details that usually stay hidden."
    >
      <Card className="mb-6 border-violet-500/20 bg-violet-500/10">
        <CardHeader>
          <CardTitle className="text-white">Published now on DEV</CardTitle>
          <CardDescription>
            The first Aetheria Build Flow essay is live publicly. Use this page as the archive, and the DEV post as the outward-facing article.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href={DEVTO_ARTICLE_URL} target="_blank" rel="noreferrer">
              Read the published article
            </a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {POSTS.map((post) => (
          <Card key={post.title}>
            <CardHeader>
              <CardTitle className="text-white">{post.title}</CardTitle>
              <CardDescription>{post.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-400">
              <p>{post.body}</p>
              {"href" in post && post.href ? (
                <Button asChild variant="outline">
                  <a href={post.href} target="_blank" rel="noreferrer">
                    {post.cta ?? "Read article"}
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </PublicPageShell>
  );
}
