import {
  HostackConfigFileSchema,
  type HostackConfigFile,
  type HostackProject,
  normalizeRepoRelativePath,
  ResolvedHostackConfigSchema,
  type ResolvedHostackConfig,
  type ResolvedHostackProject,
} from "./schema.js";

function resolveRuntime(project: HostackProject): ResolvedHostackProject["runtime"] {
  switch (project.type) {
    case "static":
    case "react-vite":
    case "wordpress-static":
      return "static";
    case "node":
    case "next":
    case "n8n":
      return "node";
    case "auto":
      return project.build?.runtime ?? "auto";
  }
}

function resolveBuilderImage(project: HostackProject): string | null {
  if (project.build?.builderImage) {
    return project.build.builderImage;
  }

  if (project.type === "wordpress-static") {
    return "hostack/wp-static:latest";
  }

  return null;
}

function resolveBuildCommand(project: HostackProject): string | null {
  if (project.build?.build) {
    return project.build.build;
  }

  if (project.type === "next") {
    return "next build";
  }

  return null;
}

function resolveStartCommand(project: HostackProject, runtime: ResolvedHostackProject["runtime"]): string | null {
  if (runtime === "static") {
    return null;
  }

  if (project.build?.start) {
    return project.build.start;
  }

  if (project.type === "next") {
    return "next start";
  }

  return null;
}

function resolveOutput(project: HostackProject): string | null {
  if (project.deploy?.output) {
    return normalizeRepoRelativePath(project.deploy.output);
  }

  if (project.type === "react-vite" || project.type === "wordpress-static") {
    return "dist";
  }

  return null;
}

function resolveWordpress(project: HostackProject): ResolvedHostackProject["wordpress"] {
  if (project.type !== "wordpress-static") {
    return null;
  }

  return {
    wpContentPath: normalizeRepoRelativePath(project.wordpress?.wpContentPath ?? "wp-content"),
    contentPath: normalizeRepoRelativePath(project.wordpress?.contentPath ?? "content/posts"),
    crawlBaseUrl: project.wordpress?.crawlBaseUrl ?? "http://127.0.0.1:8080",
  };
}

function resolveN8n(project: HostackProject): ResolvedHostackProject["n8n"] {
  if (project.type !== "n8n") {
    return null;
  }

  return {
    workflowsPath: normalizeRepoRelativePath(project.n8n?.workflowsPath ?? "n8n/workflows"),
    useGitDiff: project.n8n?.useGitDiff ?? true,
    externalize: project.n8n?.externalize ?? true,
  };
}

export function resolveHostackProject(project: HostackProject): ResolvedHostackProject {
  const runtime = resolveRuntime(project);

  return {
    name: project.name,
    path: normalizeRepoRelativePath(project.path ?? "."),
    type: project.type,
    packageManager: project.build?.packageManager ?? "auto",
    runtime,
    builderImage: resolveBuilderImage(project),
    install: project.build?.install ?? null,
    build: resolveBuildCommand(project),
    start: resolveStartCommand(project, runtime),
    output: resolveOutput(project),
    port: project.deploy?.port ?? null,
    healthCheckPath: project.deploy?.healthCheckPath ?? null,
    env: project.build?.env ?? {},
    envFromProject: project.build?.envFromProject ?? [],
    wordpress: resolveWordpress(project),
    n8n: resolveN8n(project),
  };
}

export function resolveHostackConfig(input: HostackConfigFile): ResolvedHostackConfig {
  const config = HostackConfigFileSchema.parse(input);
  return ResolvedHostackConfigSchema.parse({
    version: config.version,
    projects: config.projects.map(resolveHostackProject),
  });
}
