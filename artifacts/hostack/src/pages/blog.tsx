import { Link } from "wouter";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { blogPostRoute, DEVTO_ARTICLE_URL } from "@/lib/site-links";
import { ArrowRight, ExternalLink } from "lucide-react";

export const BLOG_POSTS = [
  {
    slug: "ai-native-deployment",
    title: "Why AI-native deployment is the next wave",
    excerpt: "Deployment platforms have been getting smarter for years, but most AI integrations are bolt-ons. Here is what it looks like when AI is designed into the deployment layer from the start.",
    author: "Hostack Team",
    date: "March 15, 2026",
    readTime: "6 min read",
    body: "The history of deployment platforms is a history of abstraction. AI-native deployment is the next abstraction layer, but it does not have to follow the same pattern. The best AI integrations in developer tooling do not hide complexity; they help you navigate it. An AI-native deployment platform has access to the full context of your deployment: your repository structure, your build history, your environment configuration, your runtime logs, and your deployment patterns.",
  },
  {
    slug: "preview-environments",
    title: "Preview environments without the DevOps overhead",
    excerpt: "Preview environments are one of the highest-leverage features in modern deployment workflows. Here is how Hostack makes them work without requiring a dedicated DevOps engineer to maintain them.",
    author: "Hostack Team",
    date: "February 28, 2026",
    readTime: "5 min read",
    body: "Preview environments let you review changes in a real environment before merging, catch issues that only appear in production-like conditions, and share work-in-progress with stakeholders without deploying to production. Hostack builds preview environments into the deployment model, not bolted on. Every pull request gets a deployment triggered automatically.",
  },
  {
    slug: "deployment-friction",
    title: "How Hostack reduces deployment friction",
    excerpt: "Deployment friction is the accumulated cost of every manual step, every configuration decision, and every debugging session that stands between writing code and shipping it.",
    author: "Hostack Team",
    date: "February 14, 2026",
    readTime: "7 min read",
    body: "Deployment friction is insidious. It does not show up as a single big problem, it shows up as a hundred small ones. The configuration file you have to update manually. The environment variable you have to remember to set. The build command that works locally but fails in CI. Each of these is small. Together, they add up to a significant tax on shipping velocity.",
  },
  {
    slug: "rollback-first-workflows",
    title: "Shipping faster with rollback-first workflows",
    excerpt: "The teams that ship fastest are not the ones who never break things. They are the ones who can recover quickly when they do. Rollback-first workflows are the key.",
    author: "Hostack Team",
    date: "January 30, 2026",
    readTime: "5 min read",
    body: "There is a common misconception about deployment velocity: that shipping faster means taking more risk. The teams that ship most frequently are often the most conservative about risk, but they manage risk differently. Instead of trying to prevent all failures, they optimize for fast recovery. Rollback-first workflows are the practical expression of this philosophy.",
  },
  {
    slug: "transparent-builds",
    title: "Peeling back the black box of GitHub deployments",
    excerpt: "Most deployment platforms hide the complexity behind magic abstractions. Hostack takes a different approach: we show you exactly what is happening, every step of the way.",
    author: "Hostack Team",
    date: "January 15, 2026",
    readTime: "8 min read",
    href: DEVTO_ARTICLE_URL,
    body: "Modern deployment platforms feel magical right up until something breaks. Hostack is being designed so the build path, runtime assumptions, and rollback model stay visible to the team operating it.",
  },
  {
    slug: "workers-before-analyzers",
    title: "Why workers matter before analyzers",
    excerpt: "A queue without a worker is just a waiting room. The first real architectural shift in building a deployment platform is getting builds out of the API process.",
    author: "Hostack Team",
    date: "December 20, 2025",
    readTime: "4 min read",
    body: "When you are building a deployment platform, it is tempting to start with the smart parts: framework detection, build configuration analysis, AI-powered suggestions. But they are useless without a reliable execution layer. The fundamental architectural decision is separating the control plane from the execution plane.",
  },
];

export default function Blog() {
  return (
    <PublicPageShell
      eyebrow="Hostack Blog"
      title="Notes from building a transparent deployment platform."
      description="Architecture decisions, implementation milestones, and the operational details that usually stay hidden."
    >
      <div className="grid gap-6">
        {BLOG_POSTS.map((post) => (
          <Card key={post.slug}>
            <CardHeader>
              <div className="mb-1 flex items-center gap-3 text-xs text-zinc-500">
                <span>{post.date}</span>
                <span>·</span>
                <span>{post.readTime}</span>
              </div>
              <CardTitle className="text-white">{post.title}</CardTitle>
              <CardDescription>{post.excerpt}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href={blogPostRoute(post.slug)}>
                  Read Article <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
              {"href" in post && post.href ? (
                <Button asChild variant="ghost" size="sm">
                  <a href={post.href} target="_blank" rel="noreferrer">
                    Read on DEV <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
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
