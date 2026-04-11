/**
 * Pipeline Configuration & Constants
 */

import type { StageConfig, PipelineStage } from "./types";

/**
 * Stage-specific log messages with emojis
 * These create the "Hostack voice" - authentic deployment language
 */
export const STAGE_LOGS: Record<PipelineStage, string[]> = {
  prepare: [
    "🧠 Analyzing repository structure...",
    "🔍 Detecting framework and dependencies...",
    "📋 Reading hostack.yaml configuration...",
    "✅ Validation passed",
  ],
  install: [
    "📦 Resolving dependency graph...",
    "⚙️ Installing packages with pnpm...",
    "🔗 Linking workspace packages...",
    "✅ All dependencies installed",
  ],
  build: [
    "🧩 Compiling TypeScript...",
    "⚡ Bundling application with Vite...",
    "📊 Optimizing production assets...",
    "🎯 Tree-shaking unused code...",
    "✅ Build complete",
  ],
  package: [
    "📦 Preparing deployment artifact...",
    "🗂️ Structuring output for static hosting...",
    "🔐 Generating source maps...",
    "✅ Artifact ready",
  ],
  deploy: [
    "🚀 Uploading build to edge network...",
    "🌐 Assigning production domain...",
    "🔄 Propagating to CDN edge locations...",
    "✅ Live on production",
  ],
  verify: [
    "🔎 Running deployment health checks...",
    "🌍 Testing endpoint connectivity...",
    "📡 Verifying SSL certificate...",
    "✅ Confirming application availability...",
    "✅ Deployment successful!",
  ],
};

/**
 * Stage configuration
 * Defines progress targets and realistic durations
 */
export const STAGE_CONFIG: Record<PipelineStage, StageConfig> = {
  prepare: {
    stage: "prepare",
    progressTarget: 10,
    durationMs: 2000,
    successMessage: "Repository structure analyzed",
    logs: STAGE_LOGS.prepare,
  },
  install: {
    stage: "install",
    progressTarget: 30,
    durationMs: 8000,
    successMessage: "Dependencies installed",
    logs: STAGE_LOGS.install,
  },
  build: {
    stage: "build",
    progressTarget: 60,
    durationMs: 15000,
    successMessage: "Application built",
    logs: STAGE_LOGS.build,
  },
  package: {
    stage: "package",
    progressTarget: 75,
    durationMs: 3000,
    successMessage: "Deployment artifact prepared",
    logs: STAGE_LOGS.package,
  },
  deploy: {
    stage: "deploy",
    progressTarget: 90,
    durationMs: 5000,
    successMessage: "Deployed to production",
    logs: STAGE_LOGS.deploy,
  },
  verify: {
    stage: "verify",
    progressTarget: 100,
    durationMs: 4000,
    successMessage: "Deployment verified",
    logs: STAGE_LOGS.verify,
  },
};

/**
 * Stage order for pipeline execution
 */
export const PIPELINE_STAGES: PipelineStage[] = [
  "prepare",
  "install",
  "build",
  "package",
  "deploy",
  "verify",
];

/**
 * Color mapping for log types
 * Used for terminal UI rendering
 */
export const LOG_TYPE_COLORS: Record<
  string,
  { bg: string; text: string; icon: string }
> = {
  thinking: { bg: "bg-purple-500/20", text: "text-purple-400", icon: "🧠" },
  action: { bg: "bg-blue-500/20", text: "text-blue-400", icon: "⚙️" },
  success: { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: "✅" },
  error: { bg: "bg-red-500/20", text: "text-red-400", icon: "❌" },
};

/**
 * Pipeline example result URLs
 */
export const DEPLOYMENT_RESULT_TEMPLATE = {
  appDomain: "https://{project-name}.hostack.dev",
  statusUrl: "/deployments/{deployment-id}",
};
