import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CHANGELOG = [
  {
    date: "March 2026",
    version: "v0.9",
    entries: [
      {
        type: "feat",
        label: "Feature",
        title: "Embedded worker mode for zero-config deployments",
        description: "The API server can now run an embedded deployment worker in the same process, eliminating the need for a separate worker service in simple single-host setups. The worker stays alive during long-running installs and build steps.",
      },
      {
        type: "feat",
        label: "Feature",
        title: "Real deployment pipeline with secrets handling",
        description: "Complete deployment pipeline now runs end-to-end: repository clone, dependency install, build execution, and artifact serving. Environment variables and secrets are injected securely at build time.",
      },
      {
        type: "fix",
        label: "Fix",
        title: "Auth redirect origins hardened",
        description: "Fixed edge cases where auth redirects could fail when the frontend and API were accessed from different origins. The proxy setup now enforces consistent origin handling.",
      },
    ],
  },
  {
    date: "February 2026",
    version: "v0.8",
    entries: [
      {
        type: "feat",
        label: "Feature",
        title: "SSH key support for GitHub repositories",
        description: "Projects can now generate ED25519 SSH deploy keys. Copy the public key to your GitHub repository's deploy keys and Hostack will use it for all subsequent clones—no personal access tokens required.",
      },
      {
        type: "feat",
        label: "Feature",
        title: "Real DNS verification flow for custom domains",
        description: "Custom domain setup now includes a real DNS verification step. Add the provided CNAME or A record, and Hostack polls for propagation before provisioning SSL.",
      },
      {
        type: "feat",
        label: "Feature",
        title: "Node version detection",
        description: "The build system now reads .nvmrc, .node-version, and the engines field in package.json to select the correct Node.js version for each build.",
      },
    ],
  },
  {
    date: "January 2026",
    version: "v0.7",
    entries: [
      {
        type: "feat",
        label: "Feature",
        title: "Integrations page launched",
        description: "New integrations hub with support for GitHub, Cloudflare, Slack, Discord, Sentry, Datadog, and more. Connect external services with API key or OAuth flows, and configure per-project notifications.",
      },
      {
        type: "feat",
        label: "Feature",
        title: "SSE log streaming",
        description: "Build and deployment logs now stream in real-time via Server-Sent Events. No more polling—watch your deployment progress as it happens.",
      },
      {
        type: "feat",
        label: "Feature",
        title: "Metrics dashboard",
        description: "New metrics page with request counts, response times, error rates, and resource utilization charts. Time-series data with configurable time ranges.",
      },
    ],
  },
  {
    date: "December 2025",
    version: "v0.6",
    entries: [
      {
        type: "feat",
        label: "Feature",
        title: "Preview environments",
        description: "Every pull request now gets an isolated preview deployment with its own URL. Share with reviewers, run QA, and merge with confidence.",
      },
      {
        type: "feat",
        label: "Feature",
        title: "Rollback support",
        description: "Every deployment is versioned. Roll back to any previous deployment from the project detail page—no rebuild required.",
      },
      {
        type: "feat",
        label: "Feature",
        title: "AI copilot for deployment context",
        description: "The AI copilot can now answer questions about your deployment history, analyze build failures, and suggest configuration improvements based on your project's patterns.",
      },
    ],
  },
  {
    date: "November 2025",
    version: "v0.5",
    entries: [
      {
        type: "feat",
        label: "Feature",
        title: "Custom domains + SSL",
        description: "Add custom domains to any project. Hostack provisions SSL certificates automatically and handles renewals. Cloudflare integration available for DNS management.",
      },
      {
        type: "feat",
        label: "Feature",
        title: "Build rules per branch",
        description: "Configure different build commands, environment variables, and deployment targets per branch. Fine-grained control without complex YAML.",
      },
      {
        type: "feat",
        label: "Feature",
        title: "Notification settings",
        description: "Configure deployment success/failure notifications via Slack, Discord, or email. Per-project and workspace-wide settings.",
      },
    ],
  },
];

const TYPE_STYLES: Record<string, string> = {
  feat: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  fix: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  perf: "bg-green-500/10 text-green-400 border-green-500/20",
  break: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function Changelog() {
  return (
    <PublicPageShell
      eyebrow="Changelog"
      title="What's new in Hostack."
      description="A running log of features, fixes, and improvements shipped to the platform."
    >
      <div className="relative space-y-12">
        <div className="absolute left-0 top-0 hidden h-full w-px bg-zinc-800 md:block" />
        {CHANGELOG.map((release) => (
          <div key={release.version} className="relative md:pl-8">
            <div className="absolute -left-1.5 top-1.5 hidden h-3 w-3 rounded-full border border-violet-500/50 bg-violet-500/20 md:block" />
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-400">{release.date}</span>
              <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                {release.version}
              </span>
            </div>
            <div className="space-y-4">
              {release.entries.map((entry) => (
                <Card key={entry.title}>
                  <CardHeader>
                    <div className="mb-1 flex items-start justify-between gap-4">
                      <CardTitle className="text-base text-white">{entry.title}</CardTitle>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[entry.type] ?? "bg-zinc-700/50 text-zinc-300 border-zinc-700"}`}
                      >
                        {entry.label}
                      </span>
                    </div>
                    <CardDescription>{entry.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PublicPageShell>
  );
}
