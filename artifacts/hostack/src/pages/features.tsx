import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap, GitBranch, Bot, RotateCcw, Globe, Shield, Terminal,
  Bell, BarChart2, Eye, Key, Puzzle, Users, FileCode, Lock
} from "lucide-react";

const FEATURES = [
  {
    category: "Deployments",
    icon: Zap,
    items: [
      {
        title: "Automated Deployments",
        description: "Every push to your connected repository triggers an automatic deployment. Configure branch-specific rules to control what deploys to production versus preview environments.",
        badge: "Core",
      },
      {
        title: "Preview Environments",
        description: "Every pull request gets its own isolated preview URL. Share with teammates, run QA, and merge with confidence knowing exactly what you're shipping.",
        badge: "Core",
      },
      {
        title: "Rollbacks",
        description: "Every deployment is versioned and stored. Roll back to any previous version in seconds—no rebuild, no downtime, no drama.",
        badge: "Core",
      },
      {
        title: "Build Rules",
        description: "Configure per-branch build commands, environment overrides, and deployment targets. Fine-grained control without YAML spaghetti.",
        badge: "Core",
      },
    ],
  },
  {
    category: "Observability",
    icon: Eye,
    items: [
      {
        title: "Live Deployment Logs",
        description: "Stream build and deployment logs in real-time via Server-Sent Events. Filter by log level, search for errors, and download complete artifacts for offline debugging.",
        badge: "Observability",
      },
      {
        title: "Runtime Logs",
        description: "Access application logs from your deployed services. Container-level visibility into what your app is doing in production, not just during the build.",
        badge: "Observability",
      },
      {
        title: "Metrics & Performance",
        description: "Track request counts, response times, error rates, and resource utilization. Time-series charts, configurable alerts, and exportable data.",
        badge: "Observability",
      },
      {
        title: "Health Dashboard",
        description: "A unified view of all your projects' health status, recent deployments, active incidents, and performance trends across your entire workspace.",
        badge: "Observability",
      },
    ],
  },
  {
    category: "Domains & SSL",
    icon: Globe,
    items: [
      {
        title: "Custom Domains",
        description: "Add your own domain to any project. Hostack verifies DNS ownership, provisions SSL certificates automatically, and handles renewals without any manual steps.",
        badge: "Domains",
      },
      {
        title: "Automatic SSL",
        description: "Every deployment—including preview environments—gets a valid SSL certificate. No configuration required, no certificate management overhead.",
        badge: "Domains",
      },
    ],
  },
  {
    category: "Security",
    icon: Shield,
    items: [
      {
        title: "SSH Key Support",
        description: "Generate ED25519 SSH deploy keys per project. Grant Hostack access to private repositories without sharing personal access tokens or organization-wide credentials.",
        badge: "Security",
      },
      {
        title: "Environment Variables",
        description: "Manage secrets and environment variables per project and per environment. Encrypted at rest, never exposed in logs, and scoped to exactly the deployments that need them.",
        badge: "Security",
      },
    ],
  },
  {
    category: "Integrations",
    icon: Puzzle,
    items: [
      {
        title: "GitHub Integration",
        description: "Native GitHub integration for repository connection, webhook-triggered deployments, commit metadata in deployment history, and PR preview links.",
        badge: "Integrations",
      },
      {
        title: "Slack & Discord",
        description: "Send deployment success/failure notifications, preview URLs, and rollback alerts directly to your team channels. Configure per-project or workspace-wide.",
        badge: "Integrations",
      },
      {
        title: "Sentry & Datadog",
        description: "Connect your error tracking and monitoring stack. Correlate deployments with error spikes, track performance regressions, and get deployment markers in your dashboards.",
        badge: "Integrations",
      },
      {
        title: "Cloudflare",
        description: "Automatic DNS record management, CDN caching, and DDoS protection via Cloudflare integration. Connect your Cloudflare account and let Hostack handle the rest.",
        badge: "Integrations",
      },
    ],
  },
  {
    category: "AI Copilot",
    icon: Bot,
    items: [
      {
        title: "Framework Detection",
        description: "The AI copilot automatically detects your framework—Next.js, Astro, Remix, Vite, Express, and more—and recommends optimal build configurations.",
        badge: "AI",
      },
      {
        title: "Build Configuration Suggestions",
        description: "Get intelligent suggestions for build commands, output directories, and environment variables based on your project's dependency graph and detected patterns.",
        badge: "AI",
      },
      {
        title: "Deployment Context",
        description: "Ask the copilot about your deployment history, build failures, and performance trends. Get contextual answers grounded in your actual deployment data.",
        badge: "AI",
      },
    ],
  },
  {
    category: "Team Workflow",
    icon: Users,
    items: [
      {
        title: "Project Management",
        description: "Organize deployments by project. Each project has its own settings, environment variables, deployment history, and team access controls.",
        badge: "Teams",
      },
      {
        title: "Notification Settings",
        description: "Configure who gets notified about what. Per-event, per-channel notification settings so your team only gets the alerts that matter to them.",
        badge: "Teams",
      },
    ],
  },
];

const BADGE_COLORS: Record<string, string> = {
  Core: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Observability: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Domains: "bg-green-500/10 text-green-400 border-green-500/20",
  Security: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Integrations: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  AI: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Teams: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export default function Features() {
  return (
    <PublicPageShell
      eyebrow="Features"
      title="Everything you need to deploy with confidence."
      description="From automated builds to real-time observability, Hostack gives you the tools to ship faster without sacrificing visibility or control."
    >
      <div className="space-y-16">
        {FEATURES.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.category}>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold text-white">{section.category}</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {section.items.map((item) => (
                  <Card key={item.title}>
                    <CardHeader>
                      <div className="mb-1 flex items-center justify-between">
                        <CardTitle className="text-base text-white">{item.title}</CardTitle>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[item.badge] ?? "bg-zinc-700/50 text-zinc-300 border-zinc-700"}`}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PublicPageShell>
  );
}
