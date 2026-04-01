export const REPO_URL = "https://github.com/bry92/Hostack-Deploy";
export const DOCS_URL = "/docs";
export const CHANGELOG_URL = "/changelog";
export const STATUS_URL = "/status";
export const DEVTO_ARTICLE_URL = "https://dev.to/hostack/peeling-back-the-black-box-of-github-deployments-3me1";

export const PUBLIC_ROUTES = {
  home: "/",
  product: "/product",
  features: "/features",
  compare: "/compare",
  pricing: "/pricing",
  changelog: "/changelog",
  resources: "/resources",
  docs: "/docs",
  docsGettingStarted: "/docs/getting-started",
  docsGitHub: "/docs/github",
  docsDeployments: "/docs/deployments",
  docsDomains: "/docs/domains",
  docsSshKeys: "/docs/ssh-keys",
  docsEnvVars: "/docs/env-vars",
  docsPreview: "/docs/preview",
  docsRollback: "/docs/rollback",
  docsIntegrations: "/docs/integrations",
  github: "/github",
  status: "/status",
  company: "/company",
  about: "/about",
  blog: "/blog",
  careers: "/careers",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export function blogPostRoute(slug: string): string {
  return `/blog/${slug}`;
}
