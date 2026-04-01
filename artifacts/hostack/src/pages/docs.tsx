import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/auth-web";
import { Button } from "@/components/ui/button";
import { Boxes, ArrowRight, ChevronRight } from "lucide-react";
import { PUBLIC_ROUTES } from "@/lib/site-links";

const DOC_SECTIONS = [
  {
    title: "Getting Started",
    items: [
      { title: "Overview", href: PUBLIC_ROUTES.docsGettingStarted },
      { title: "Connect GitHub", href: PUBLIC_ROUTES.docsGitHub },
      { title: "Deploy your first app", href: PUBLIC_ROUTES.docsDeployments },
    ],
  },
  {
    title: "Deployments",
    items: [
      { title: "Automated deployments", href: PUBLIC_ROUTES.docsDeployments },
      { title: "Preview environments", href: PUBLIC_ROUTES.docsPreview },
      { title: "Roll back a deployment", href: PUBLIC_ROUTES.docsRollback },
      { title: "Build rules", href: PUBLIC_ROUTES.docsDeployments },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "Environment variables", href: PUBLIC_ROUTES.docsEnvVars },
      { title: "SSH keys", href: PUBLIC_ROUTES.docsSshKeys },
      { title: "Custom domains", href: PUBLIC_ROUTES.docsDomains },
    ],
  },
  {
    title: "Integrations",
    items: [
      { title: "Integrations overview", href: PUBLIC_ROUTES.docsIntegrations },
      { title: "Slack & Discord", href: PUBLIC_ROUTES.docsIntegrations },
      { title: "Sentry & Datadog", href: PUBLIC_ROUTES.docsIntegrations },
      { title: "Cloudflare", href: PUBLIC_ROUTES.docsIntegrations },
    ],
  },
];

function DocsSidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="w-64 shrink-0">
      <nav className="sticky top-20 space-y-6">
        {DOC_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href + item.title}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      currentPath === item.href
                        ? "bg-violet-500/10 text-violet-400"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function DocsLayout({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  const { isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
      return;
    }
    login("/dashboard");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.16),transparent_30%),linear-gradient(to_bottom,rgba(9,9,11,0.2),rgba(9,9,11,1))]" />
      </div>
      <nav className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href={PUBLIC_ROUTES.home} className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-violet-400">
              <Boxes className="h-5 w-5" />
            </div>
            Hostack
          </Link>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Link href={PUBLIC_ROUTES.home} className="transition-colors hover:text-white">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-white">Docs</span>
          </div>
          <Button onClick={handlePrimaryAction} className="font-medium">
            {isAuthenticated ? "Go to Dashboard" : "Start Deploying"} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </nav>
      <div className="relative z-10 mx-auto flex max-w-7xl gap-12 px-6 py-12">
        <DocsSidebar currentPath={currentPath} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export default function Docs() {
  const [currentPath] = useLocation();

  return (
    <DocsLayout currentPath={currentPath}>
      <div className="prose prose-invert max-w-none">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-sm text-violet-400">
          Documentation
        </div>
        <h1 className="mb-4 text-4xl font-semibold text-white">Hostack Documentation</h1>
        <p className="mb-8 text-lg text-zinc-400">
          Everything you need to deploy, manage, and monitor your applications with Hostack.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {DOC_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">{section.title}</h2>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.href + item.title}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
                    >
                      <ChevronRight className="h-3.5 w-3.5 text-violet-400" />
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </DocsLayout>
  );
}

function DocArticle({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  const [currentPath] = useLocation();
  return (
    <DocsLayout currentPath={currentPath}>
      <article className="prose prose-invert max-w-none">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-sm text-violet-400">
          {eyebrow}
        </div>
        <h1 className="mb-4 text-4xl font-semibold text-white">{title}</h1>
        {children}
      </article>
    </DocsLayout>
  );
}

export function DocsGettingStarted() {
  return (
    <DocArticle title="Getting Started with Hostack" eyebrow="Getting Started">
      <p className="text-lg text-zinc-400">
        Hostack deploys your GitHub repositories automatically. This guide walks you through connecting your first repository and triggering your first deployment.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Prerequisites</h2>
      <p className="text-zinc-400">
        You'll need a GitHub account and a repository with a buildable project. Hostack supports static sites, Node.js applications, and most modern frontend frameworks.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Step 1: Create an account</h2>
      <p className="text-zinc-400">
        Sign in to Hostack using your GitHub account. This grants Hostack read access to your public repositories. For private repositories, you'll need to configure SSH keys or grant additional OAuth scopes.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Step 2: Create a project</h2>
      <p className="text-zinc-400">
        From the dashboard, click "New Project" and select a repository. Hostack will analyze your repository and suggest a build configuration. Review the suggestions and click "Deploy."
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Step 3: Watch your deployment</h2>
      <p className="text-zinc-400">
        Your first deployment starts immediately. Navigate to the deployment detail page to watch real-time build logs. Once complete, your app is live at a Hostack-provided URL.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Next steps</h2>
      <ul className="space-y-2 text-zinc-400">
        <li><Link href={PUBLIC_ROUTES.docsDomains} className="text-violet-400 hover:underline">Add a custom domain</Link></li>
        <li><Link href={PUBLIC_ROUTES.docsEnvVars} className="text-violet-400 hover:underline">Configure environment variables</Link></li>
        <li><Link href={PUBLIC_ROUTES.docsPreview} className="text-violet-400 hover:underline">Enable preview environments</Link></li>
        <li><Link href={PUBLIC_ROUTES.docsIntegrations} className="text-violet-400 hover:underline">Connect integrations</Link></li>
      </ul>
    </DocArticle>
  );
}

export function DocsGitHub() {
  return (
    <DocArticle title="Connect GitHub" eyebrow="GitHub Integration">
      <p className="text-lg text-zinc-400">
        Hostack integrates with GitHub to trigger deployments on push, display commit metadata in deployment history, and support pull request preview environments.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">OAuth Connection</h2>
      <p className="text-zinc-400">
        When you sign in with GitHub, Hostack receives an OAuth token with read access to your public repositories. For private repositories, you can either grant additional OAuth scopes or use SSH deploy keys.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">SSH Deploy Keys</h2>
      <p className="text-zinc-400">
        SSH deploy keys are the recommended approach for private repositories. Each project gets its own ED25519 key pair. The private key is stored encrypted in Hostack; you add the public key to your GitHub repository's deploy keys.
      </p>
      <p className="text-zinc-400 mt-2">
        To generate a deploy key: navigate to your project settings, find the "SSH Deploy Key" section, and click "Generate Key." Copy the public key and add it to your GitHub repository under Settings → Deploy keys.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Webhooks</h2>
      <p className="text-zinc-400">
        Hostack uses GitHub webhooks to receive push and pull request events. When you connect a repository, Hostack registers a webhook automatically. Each webhook has a unique secret for payload verification.
      </p>
    </DocArticle>
  );
}

export function DocsDeployments() {
  return (
    <DocArticle title="Deployments" eyebrow="Deployments">
      <p className="text-lg text-zinc-400">
        Hostack triggers a deployment every time you push to a connected branch. Deployments run in isolated containers with full build log streaming.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Deployment lifecycle</h2>
      <p className="text-zinc-400">
        Each deployment goes through the following stages: queued → cloning → installing → building → deploying → live. You can watch each stage in real-time from the deployment detail page.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Build configuration</h2>
      <p className="text-zinc-400">
        Hostack auto-detects your framework and sets sensible defaults. You can override the build command, output directory, and install command from the project settings. For advanced configuration, use a <code className="text-violet-400">hostack.yaml</code> file in your repository root.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Manual deployments</h2>
      <p className="text-zinc-400">
        Trigger a deployment manually from the project detail page or deployments list. Select the branch and environment, then click "Deploy Now."
      </p>
    </DocArticle>
  );
}

export function DocsDomains() {
  return (
    <DocArticle title="Custom Domains" eyebrow="Domains">
      <p className="text-lg text-zinc-400">
        Add your own domain to any Hostack project. SSL certificates are provisioned automatically and renewals are handled for you.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Adding a domain</h2>
      <p className="text-zinc-400">
        From your project settings, navigate to the "Domains" tab and click "Add Domain." Enter your domain name and Hostack will provide the DNS records you need to add.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">DNS configuration</h2>
      <p className="text-zinc-400">
        For apex domains (example.com), add an A record pointing to Hostack's IP. For subdomains (app.example.com), add a CNAME record pointing to your project's Hostack URL. Hostack polls for DNS propagation and automatically provisions SSL once verified.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Cloudflare integration</h2>
      <p className="text-zinc-400">
        If you use Cloudflare for DNS, connect your Cloudflare account in the Integrations page. Hostack can then create and manage DNS records automatically when you add a domain.
      </p>
    </DocArticle>
  );
}

export function DocsSshKeys() {
  return (
    <DocArticle title="SSH Keys" eyebrow="SSH Keys">
      <p className="text-lg text-zinc-400">
        SSH deploy keys let Hostack clone private repositories without requiring a personal access token. Each project gets its own ED25519 key pair.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Generating a key</h2>
      <p className="text-zinc-400">
        Navigate to your project settings and find the "SSH Deploy Key" section. Click "Generate Key" to create a new ED25519 key pair. The private key is encrypted and stored securely; only the public key is shown to you.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Adding the key to GitHub</h2>
      <p className="text-zinc-400">
        Copy the public key from the project settings. In your GitHub repository, go to Settings → Deploy keys → Add deploy key. Paste the public key, give it a name like "Hostack Deploy Key," and save. You do not need to grant write access.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Rotating keys</h2>
      <p className="text-zinc-400">
        To rotate a key, click "Remove Key" in the project settings and then "Generate Key" again. Update the deploy key in your GitHub repository settings with the new public key.
      </p>
    </DocArticle>
  );
}

export function DocsEnvVars() {
  return (
    <DocArticle title="Environment Variables" eyebrow="Configuration">
      <p className="text-lg text-zinc-400">
        Manage secrets and environment variables per project and per environment. Variables are encrypted at rest and never exposed in build logs.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Adding variables</h2>
      <p className="text-zinc-400">
        From your project settings, navigate to the "Environment Variables" tab. Add key-value pairs and select which environments they apply to: production, preview, or both.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Variable scoping</h2>
      <p className="text-zinc-400">
        Variables can be scoped to production deployments only, preview deployments only, or all deployments. Use this to keep production secrets out of preview environments.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Build-time vs runtime</h2>
      <p className="text-zinc-400">
        Variables are injected at build time by default. For runtime injection (e.g., Node.js process.env), ensure your build command doesn't bake the values into static assets.
      </p>
    </DocArticle>
  );
}

export function DocsPreview() {
  return (
    <DocArticle title="Preview Environments" eyebrow="Deployments">
      <p className="text-lg text-zinc-400">
        Every pull request gets an isolated preview deployment with its own URL. Share with reviewers, run QA, and merge with confidence.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">How preview environments work</h2>
      <p className="text-zinc-400">
        When a pull request is opened against a connected branch, Hostack automatically triggers a deployment. The preview URL is unique to the PR and is updated with every new commit to that branch.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Environment variables in previews</h2>
      <p className="text-zinc-400">
        Variables scoped to "preview" environments are injected into preview deployments. Use this to point preview deployments at staging databases or test API endpoints.
      </p>

      <h2 className="mt-8 text-2zt font-semibold text-white">Cleanup</h2>
      <p className="text-zinc-400">
        Preview deployments are automatically cleaned up when a pull request is closed or merged. The deployment history remains accessible for audit purposes.
      </p>
    </DocArticle>
  );
}

export function DocsRollback() {
  return (
    <DocArticle title="Rollbacks" eyebrow="Deployments">
      <p className="text-lg text-zinc-400">
        Every deployment is versioned and immutable. Roll back to any previous deployment in seconds—no rebuild required.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">How to roll back</h2>
      <p className="text-zinc-400">
        Navigate to your project's deployment history. Find the deployment you want to restore and click "Redeploy." The previous deployment's build artifacts are served immediately—no rebuild is triggered.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">What gets rolled back</h2>
      <p className="text-zinc-400">
        A rollback restores the build artifacts and configuration from the selected deployment. Environment variables are not rolled back—they reflect the current project settings.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Rollback vs redeploy</h2>
      <p className="text-zinc-400">
        A rollback serves a previous build artifact immediately. A redeploy triggers a fresh build from the same commit. Use rollback for speed; use redeploy if you need to pick up environment variable changes.
      </p>
    </DocArticle>
  );
}

export function DocsIntegrations() {
  return (
    <DocArticle title="Integrations" eyebrow="Integrations">
      <p className="text-lg text-zinc-400">
        Connect Hostack to your existing tools. Integrations are configured per workspace and can be linked to individual projects.
      </p>

      <h2 className="mt-8 text-2xl font-semibold text-white">Available integrations</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[
          { name: "Slack", desc: "Deployment notifications to channels" },
          { name: "Discord", desc: "Deployment alerts to Discord servers" },
          { name: "Sentry", desc: "Error tracking with deployment markers" },
          { name: "Datadog", desc: "Metrics and deployment events" },
          { name: "Cloudflare", desc: "DNS management and CDN" },
          { name: "GitHub", desc: "Repository connection and webhooks" },
        ].map((integration) => (
          <div key={integration.name} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="font-medium text-white">{integration.name}</p>
            <p className="text-sm text-zinc-400">{integration.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-2xl font-semibold text-white">Connecting an integration</h2>
      <p className="text-zinc-400">
        Navigate to the Integrations page from the sidebar. Find the integration you want to connect and click "Connect." Follow the provider-specific instructions to provide API keys or complete an OAuth flow.
      </p>
    </DocArticle>
  );
}
