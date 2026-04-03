import { Link, useParams } from "wouter";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PUBLIC_ROUTES, blogPostRoute, DEVTO_ARTICLE_URL } from "@/lib/site-links";
import { ArrowLeft, ArrowRight, ExternalLink, Clock, User } from "lucide-react";
import { BLOG_POSTS } from "./blog";

export default function BlogPost() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <PublicPageShell
        eyebrow="Blog"
        title="Post not found"
        description="The blog post you're looking for doesn't exist."
      >
        <Button asChild variant="outline">
          <Link href={PUBLIC_ROUTES.blog}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Link>
        </Button>
      </PublicPageShell>
    );
  }

  const currentIndex = BLOG_POSTS.findIndex((p) => p.slug === slug);
  const prevPost = currentIndex < BLOG_POSTS.length - 1 ? BLOG_POSTS[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? BLOG_POSTS[currentIndex - 1] : null;

  return (
    <PublicPageShell
      eyebrow="Hostack Blog"
      title={post.title}
      description={post.excerpt}
    >
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
        <span className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          {post.author}
        </span>
        <span>{post.date}</span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {post.readTime}
        </span>
      </div>

      {"href" in post && post.href ? (
        <Card className="mb-8 border-violet-500/20 bg-violet-500/10">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-zinc-300">
              This post was originally published on DEV. Read the full article there.
            </p>
            <Button asChild size="sm">
              <a href={post.href} target="_blank" rel="noreferrer">
                Read on DEV <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-12">
        <CardContent className="prose prose-invert max-w-none pt-6">
          <div className="space-y-4 text-zinc-300 leading-relaxed">
            {post.body.trim().split("\n\n").map((paragraph, i) => {
              if (paragraph.startsWith("**") && paragraph.endsWith("**")) {
                return (
                  <h3 key={i} className="text-lg font-semibold text-white mt-6">
                    {paragraph.replace(/\*\*/g, "")}
                  </h3>
                );
              }
              if (paragraph.startsWith("- ")) {
                const items = paragraph.split("\n").filter((l) => l.startsWith("- "));
                return (
                  <ul key={i} className="space-y-1 list-disc list-inside">
                    {items.map((item, j) => (
                      <li key={j} className="text-zinc-300">{item.replace(/^- /, "")}</li>
                    ))}
                  </ul>
                );
              }
              // Handle inline bold
              const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
              return (
                <p key={i}>
                  {parts.map((part, j) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return <strong key={j} className="text-white font-semibold">{part.replace(/\*\*/g, "")}</strong>;
                    }
                    return <span key={j}>{part}</span>;
                  })}
                </p>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 border-t border-zinc-800 pt-8">
        {prevPost ? (
          <Button asChild variant="outline">
            <Link href={blogPostRoute(prevPost.slug)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {prevPost.title.length > 40 ? prevPost.title.slice(0, 40) + "…" : prevPost.title}
            </Link>
          </Button>
        ) : (
          <div />
        )}
        {nextPost ? (
          <Button asChild variant="outline">
            <Link href={blogPostRoute(nextPost.slug)}>
              {nextPost.title.length > 40 ? nextPost.title.slice(0, 40) + "…" : nextPost.title}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <div />
        )}
      </div>
    </PublicPageShell>
  );
}
