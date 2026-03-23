import { spawn } from "child_process";
import { mkdtemp, rm, readFile, access, writeFile, readdir } from "fs/promises";
import { tmpdir } from "os";
import { join, relative } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { db } from "@workspace/db";
import { deploymentsTable, deploymentLogsTable, projectsTable, buildRulesTable, integrationsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { x as extractTarball } from "tar";
import { dispatchDeployNotification } from "./notificationDispatcher.js";
import {
  activateNodeDeployment,
  activateStaticDeployment,
  detectNodeStartCommand,
  packageDeploymentArtifact,
  type RuntimeKind,
} from "./deploymentRuntime.js";
import { decryptMetadata, decryptString } from "../lib/secrets.js";

type LogLevel = "info" | "warn" | "error" | "success";
type FrameworkType =
  | "next.js"
  | "nuxt"
  | "sveltekit"
  | "vue"
  | "react"
  | "node-api"
  | "static"
  | "unknown";

type DeployStatus =
  | "queued"
  | "preparing"
  | "cloning"
  | "detecting"
  | "installing"
  | "building"
  | "packaging"
  | "deploying"
  | "verifying"
  | "ready"
  | "failed";

const DEFAULT_COMMAND_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_INSTALL_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_BUILD_TIMEOUT_MS = 10 * 60 * 1000;
const CANDIDATE_DIRS = [".", "app", "web", "frontend", "client", "src"];
const SHALLOW_MONOREPO_CONTAINERS = ["artifacts", "apps"];
const FRAMEWORKS_REQUIRING_BUILD: FrameworkType[] = ["next.js", "nuxt", "sveltekit", "vue", "react"];
const NEXT_CONFIG_FILES = ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs"];
const VITE_CONFIG_FILES = ["vite.config.js", "vite.config.mjs", "vite.config.ts", "vite.config.cjs"];
const NODE_ENTRY_FILES = [
  "index.js",
  "index.ts",
  "server.js",
  "server.ts",
  "app.js",
  "app.ts",
  "src/index.js",
  "src/index.ts",
  "src/server.js",
  "src/server.ts",
  "src/app.js",
  "src/app.ts",
];
const SERVER_PACKAGE_MARKERS = [
  "express",
  "fastify",
  "koa",
  "hono",
  "@nestjs/core",
  "@nestjs/common",
  "@hapi/hapi",
  "elysia",
];
const INSTALL_RETRY_DELAY_MS = 2000;
const MAX_INSTALL_ATTEMPTS = 3;

function parsePositiveIntEnv(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`[deploymentBuilder] Invalid ${name} value "${rawValue}", using ${fallback}ms`);
    return fallback;
  }

  return parsed;
}

const COMMAND_TIMEOUT_MS = parsePositiveIntEnv(
  "HOSTACK_COMMAND_TIMEOUT_MS",
  DEFAULT_COMMAND_TIMEOUT_MS,
);
const INSTALL_TIMEOUT_MS = parsePositiveIntEnv(
  "HOSTACK_INSTALL_TIMEOUT_MS",
  DEFAULT_INSTALL_TIMEOUT_MS,
);
const BUILD_TIMEOUT_MS = parsePositiveIntEnv(
  "HOSTACK_BUILD_TIMEOUT_MS",
  DEFAULT_BUILD_TIMEOUT_MS,
);

function sanitizeMessage(value: string): string {
  return value.replace(/\r/g, "").trimEnd();
}

async function insertLog(
  deploymentId: string,
  message: string,
  level: LogLevel,
  stepOrderRef: { value: number },
): Promise<void> {
  const sanitized = sanitizeMessage(message);
  if (!sanitized) return;

  await db.insert(deploymentLogsTable).values({
    deploymentId,
    logLevel: level,
    message: sanitized,
    stepOrder: stepOrderRef.value++,
  });
}

async function getNextStepOrder(deploymentId: string): Promise<number> {
  const [latestLog] = await db
    .select({ stepOrder: deploymentLogsTable.stepOrder })
    .from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, deploymentId))
    .orderBy(desc(deploymentLogsTable.stepOrder), desc(deploymentLogsTable.createdAt))
    .limit(1);

  return latestLog ? latestLog.stepOrder + 1 : 0;
}

async function setStatus(
  deploymentId: string,
  status: DeployStatus,
  failureReason?: string | null,
): Promise<void> {
  await db
    .update(deploymentsTable)
    .set({ status, failureReason: failureReason ?? null })
    .where(eq(deploymentsTable.id, deploymentId));
}

function parseCommand(command: string): { cmd: string; args: string[] } {
  const [cmd, ...args] = command.trim().split(/\s+/);
  return { cmd, args };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CommandInput =
  | string
  | {
      args: string[];
      cmd: string;
      shell?: boolean;
    };

function redactCommandForLogs(value: string): string {
  return value
    .replace(/(Authorization:\s*Bearer\s+)(\S+)/gi, "$1[REDACTED]")
    .replace(/(Authorization:\s*Basic\s+)(\S+)/gi, "$1[REDACTED]")
    .replace(/(client_secret=)([^&\s]+)/gi, "$1[REDACTED]")
    .replace(/(access_token=)([^&\s]+)/gi, "$1[REDACTED]")
    .replace(/(token=)([^&\s]+)/gi, "$1[REDACTED]");
}

function truncateForLogs(value: string, maxLength = 240): string {
  const sanitized = sanitizeMessage(value);
  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  return `${sanitized.slice(0, maxLength)}...`;
}

function summarizeCommandFailure(stderrLines: string[]): string {
  if (stderrLines.length === 0) {
    return "";
  }

  return truncateForLogs(stderrLines.join(" | "), 320);
}

function runCommand(
  command: CommandInput,
  cwd: string,
  deploymentId: string,
  stepOrderRef: { value: number },
  options?: {
    timeoutMs?: number;
  },
): Promise<void> {
  const parsed =
    typeof command === "string"
      ? {
          ...parseCommand(command),
          shell: /\b(npm|pnpm|yarn)\b/.test(command),
        }
      : {
          args: command.args,
          cmd: command.cmd,
          shell: command.shell ?? false,
        };
  const commandForLogs = redactCommandForLogs(
    typeof command === "string" ? command : `${parsed.cmd} ${parsed.args.join(" ")}`,
  );

  return new Promise((resolve, reject) => {
    const baseEnv = { ...process.env };
    delete baseEnv.GIT_ASKPASS;
    delete baseEnv.SSH_ASKPASS;
    delete baseEnv.GIT_SSH_COMMAND;
    delete baseEnv.GIT_CREDENTIAL_HELPER;

    const proc = spawn(parsed.cmd, parsed.args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: parsed.shell,
      env: {
        ...baseEnv,
        CI: "true",
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        GIT_TERMINAL_PROMPT: "0",
        npm_config_fund: "false",
        npm_config_audit: "false",
        npm_config_progress: "false",
        npm_config_loglevel: "error",
      },
    });

    const pendingLogs: Promise<void>[] = [];
    let stdoutBuf = "";
    let stderrBuf = "";
    const recentStderrLines: string[] = [];

    const flush = (line: string, level: LogLevel) => {
      const sanitized = sanitizeMessage(line);
      if (!sanitized) return;
      if (level === "error") {
        recentStderrLines.push(sanitized);
        if (recentStderrLines.length > 12) {
          recentStderrLines.shift();
        }
      }
      pendingLogs.push(insertLog(deploymentId, sanitized, level, stepOrderRef).catch(console.error));
    };

    proc.stdout.on("data", (data: Buffer) => {
      const text = stdoutBuf + data.toString();
      const lines = text.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) flush(line, "info");
    });

    proc.stderr.on("data", (data: Buffer) => {
      const text = stderrBuf + data.toString();
      const lines = text.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines) flush(line, "error");
    });

    const timeoutMs = options?.timeoutMs ?? COMMAND_TIMEOUT_MS;

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Command timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    proc.on("close", async (code) => {
      clearTimeout(timeout);
      if (stdoutBuf.trimEnd()) flush(stdoutBuf, "info");
      if (stderrBuf.trimEnd()) flush(stderrBuf, "error");
      await Promise.allSettled(pendingLogs);
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Command '${commandForLogs}' exited with code ${code}${summarizeCommandFailure(recentStderrLines) ? `: ${summarizeCommandFailure(recentStderrLines)}` : ""}`,
        ),
      );
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      const normalizedError = err as NodeJS.ErrnoException;
      if (normalizedError.code === "ENOENT") {
        reject(
          new Error(
            `Command '${parsed.cmd}' is not available in this worker environment`,
          ),
        );
        return;
      }

      reject(
        new Error(
          `Failed to start '${commandForLogs}': ${err.message}`,
        ),
      );
    });
  });
}

function isRetryableInstallError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\bEPERM\b/i.test(message) ||
    /\bEBUSY\b/i.test(message) ||
    /\bENOTEMPTY\b/i.test(message) ||
    /\boperation not permitted\b/i.test(message) ||
    /\brename\b/i.test(message)
  );
}

function getLegacyPeerDepsInstallCommand(installCommand: string): string | null {
  if (!/^npm\s+(install|ci)\b/i.test(installCommand.trim())) {
    return null;
  }

  if (/\s--legacy-peer-deps\b/i.test(installCommand) || /\s--force\b/i.test(installCommand)) {
    return null;
  }

  return `${installCommand} --legacy-peer-deps`;
}

function getNpmInstallFallbackCommand(installCommand: string): string | null {
  if (!/^npm ci\b/i.test(installCommand.trim())) {
    return null;
  }

  const preserveLegacyPeerDeps = /\s--legacy-peer-deps\b/i.test(installCommand);
  return `npm install --prefer-offline --no-audit --no-fund${preserveLegacyPeerDeps ? " --legacy-peer-deps" : ""}`;
}

function isPeerDependencyResolutionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\bERESOLVE\b/i.test(message) ||
    /unable to resolve dependency tree/i.test(message) ||
    /retry\s+.*--legacy-peer-deps/i.test(message) ||
    /Fix the upstream dependency conflict/i.test(message)
  );
}

function isNpmCiLockfileError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\bnpm ci\b/i.test(message) &&
    (
      /package-lock\.json/i.test(message) ||
      /npm-shrinkwrap\.json/i.test(message) ||
      /\bin sync\b/i.test(message) ||
      /\bEUSAGE\b/i.test(message)
    )
  );
}

async function runInstallCommandWithRetry(
  installCommand: string,
  cwd: string,
  deploymentId: string,
  stepOrderRef: { value: number },
): Promise<void> {
  let lastError: Error | null = null;
  let resolvedInstallCommand = installCommand;
  let attemptedLegacyPeerDepsFallback = false;
  let attemptedNpmInstallFallback = false;
  const legacyPeerDepsInstallCommand = getLegacyPeerDepsInstallCommand(installCommand);
  const npmInstallFallbackCommand = getNpmInstallFallbackCommand(installCommand);

  for (let attempt = 1; attempt <= MAX_INSTALL_ATTEMPTS; attempt += 1) {
    try {
      await runCommand(resolvedInstallCommand, cwd, deploymentId, stepOrderRef, {
        timeoutMs: INSTALL_TIMEOUT_MS,
      });
      return;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      lastError = normalizedError;

      if (
        !attemptedNpmInstallFallback &&
        npmInstallFallbackCommand &&
        isNpmCiLockfileError(normalizedError)
      ) {
        attemptedNpmInstallFallback = true;
        resolvedInstallCommand = npmInstallFallbackCommand;

        await insertLog(
          deploymentId,
          "npm ci could not use the lockfile cleanly. Retrying with npm install.",
          "warn",
          stepOrderRef,
        );
        continue;
      }

      if (
        !attemptedLegacyPeerDepsFallback &&
        legacyPeerDepsInstallCommand &&
        isPeerDependencyResolutionError(normalizedError)
      ) {
        attemptedLegacyPeerDepsFallback = true;
        resolvedInstallCommand = legacyPeerDepsInstallCommand;

        await insertLog(
          deploymentId,
          "npm reported a peer dependency resolution conflict. Retrying install with --legacy-peer-deps.",
          "warn",
          stepOrderRef,
        );
        continue;
      }

      if (attempt >= MAX_INSTALL_ATTEMPTS || !isRetryableInstallError(normalizedError)) {
        throw normalizedError;
      }

      await insertLog(
        deploymentId,
        `Install hit a transient filesystem lock. Retrying (${attempt + 1}/${MAX_INSTALL_ATTEMPTS})...`,
        "warn",
        stepOrderRef,
      );
      await sleep(INSTALL_RETRY_DELAY_MS);
    }
  }

  if (lastError) {
    throw lastError;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface ProjectRootCandidate {
  dir: string;
  framework: FrameworkType;
  hasBuildScript: boolean;
  hasStartScript: boolean;
  runtimeHint: RuntimeKind | null;
  score: number;
}

type PackageManager = "npm" | "pnpm" | "yarn";
type PackageManagerResolution = {
  hasLockfile: boolean;
  installCwd: string;
  packageManager: PackageManager;
};
type PackageJsonData = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

type ResolvedDeploymentPlan = {
  buildCommand: string | null;
  buildRoot: string;
  buildRootRelative: string;
  framework: FrameworkType;
  hasBuildScript: boolean;
  installCommand: string;
  installCwd: string;
  installCwdRelative: string;
  packageManager: PackageManager;
  rootDirectory: string;
  runtimeHint: RuntimeKind | null;
};

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function toStoredRelativePath(baseDir: string, targetDir: string): string {
  const relativePath = normalizeRelativePath(relative(baseDir, targetDir));
  return relativePath === "." ? "" : relativePath;
}

function toLogRelativePath(baseDir: string, targetDir: string): string {
  return toStoredRelativePath(baseDir, targetDir) || ".";
}

async function hasAnyFile(baseDir: string, fileNames: string[]): Promise<boolean> {
  for (const fileName of fileNames) {
    if (await fileExists(join(baseDir, fileName))) {
      return true;
    }
  }
  return false;
}

async function readPackageJson(dir: string): Promise<PackageJsonData | null> {
  const pkgPath = join(dir, "package.json");
  if (!(await fileExists(pkgPath))) {
    return null;
  }

  try {
    return JSON.parse(await readFile(pkgPath, "utf8")) as PackageJsonData;
  } catch {
    return null;
  }
}

function getAllDependencies(pkg: PackageJsonData): Record<string, string> {
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
}

function hasAnyDependency(allDeps: Record<string, string>, names: string[]): boolean {
  return names.some((name) => Boolean(allDeps[name]));
}

async function detectFramework(workDir: string): Promise<{
  framework: FrameworkType;
  hasBuildScript: boolean;
  hasStartScript: boolean;
  runtimeHint: RuntimeKind | null;
}> {
  const pkg = await readPackageJson(workDir);
  if (!pkg) {
    return {
      framework: "static",
      hasBuildScript: false,
      hasStartScript: false,
      runtimeHint: null,
    };
  }

  const allDeps = getAllDependencies(pkg);
  const scripts: Record<string, string> = pkg.scripts ?? {};
  const hasBuildScript = typeof scripts.build === "string" && scripts.build.trim().length > 0;
  const hasStartScript = typeof scripts.start === "string" && scripts.start.trim().length > 0;
  const hasNextConfig = await hasAnyFile(workDir, NEXT_CONFIG_FILES);
  const hasViteConfig = await hasAnyFile(workDir, VITE_CONFIG_FILES);
  const hasNodeEntry = await hasAnyFile(workDir, NODE_ENTRY_FILES);

  if (hasNextConfig || allDeps["next"]) {
    return { framework: "next.js", hasBuildScript, hasStartScript, runtimeHint: "static" };
  }
  if (allDeps["nuxt"] || allDeps["nuxt3"]) {
    return { framework: "nuxt", hasBuildScript, hasStartScript, runtimeHint: "static" };
  }
  if (allDeps["@sveltejs/kit"]) {
    return { framework: "sveltekit", hasBuildScript, hasStartScript, runtimeHint: "static" };
  }
  if (allDeps["vue"]) {
    return { framework: "vue", hasBuildScript, hasStartScript, runtimeHint: "static" };
  }
  if (allDeps["react"]) {
    return { framework: "react", hasBuildScript, hasStartScript, runtimeHint: "static" };
  }
  if (hasStartScript || hasNodeEntry || hasAnyDependency(allDeps, SERVER_PACKAGE_MARKERS)) {
    return { framework: "node-api", hasBuildScript, hasStartScript, runtimeHint: "node-api" };
  }
  if (hasViteConfig || hasBuildScript) {
    return { framework: "static", hasBuildScript, hasStartScript, runtimeHint: "static" };
  }
  if (Object.keys(allDeps).length > 0) {
    return { framework: "unknown", hasBuildScript, hasStartScript, runtimeHint: null };
  }
  return { framework: "static", hasBuildScript, hasStartScript, runtimeHint: null };
}

async function scoreCandidate(baseDir: string, candidateRelative: string): Promise<ProjectRootCandidate | null> {
  const candidatePath = candidateRelative === "." ? baseDir : join(baseDir, candidateRelative);
  const detected = await detectFramework(candidatePath);
  if (!(await fileExists(join(candidatePath, "package.json")))) {
    return null;
  }

  let score = 1;
  if (detected.hasBuildScript) score += 2;
  if (detected.hasStartScript) score += 2;
  if (detected.framework === "next.js" || detected.framework === "nuxt" || detected.framework === "sveltekit") {
    score += 4;
  } else if (detected.framework === "vue" || detected.framework === "react") {
    score += 3;
  } else if (detected.framework === "node-api") {
    score += 3;
  } else if (detected.framework === "static") {
    score += 2;
  }

  return {
    dir: candidatePath,
    framework: detected.framework,
    hasBuildScript: detected.hasBuildScript,
    hasStartScript: detected.hasStartScript,
    runtimeHint: detected.runtimeHint,
    score,
  };
}

async function discoverShallowCandidateRoots(repoDir: string): Promise<string[]> {
  const results: string[] = [];

  for (const container of SHALLOW_MONOREPO_CONTAINERS) {
    try {
      const entries = await readdir(join(repoDir, container), { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        results.push(normalizeRelativePath(join(container, entry.name)));
      }
    } catch {
      continue;
    }
  }

  return results;
}

async function findProjectRoot(repoDir: string, preferredRoot = ""): Promise<ProjectRootCandidate | null> {
  const candidates: ProjectRootCandidate[] = [];
  const seen = new Set<string>();
  const shallowCandidates = await discoverShallowCandidateRoots(repoDir);
  const candidateRoots = [
    preferredRoot.trim().length > 0 ? preferredRoot : null,
    ...CANDIDATE_DIRS,
    ...shallowCandidates,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidateRoots) {
    const normalizedCandidate = normalizeRelativePath(candidate);
    if (seen.has(normalizedCandidate)) continue;
    seen.add(normalizedCandidate);
    const result = await scoreCandidate(repoDir, candidate);
    if (!result) continue;

    if (preferredRoot && normalizedCandidate === normalizeRelativePath(preferredRoot)) {
      result.score += 1;
    }
    candidates.push(result);
  }

  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0];
}

async function detectPackageManager(
  buildRoot: string,
  repoDir: string,
): Promise<PackageManagerResolution> {
  const installRoots = [buildRoot];
  if (buildRoot !== repoDir) {
    installRoots.push(repoDir);
  }

  for (const installRoot of installRoots) {
    if (await fileExists(join(installRoot, "pnpm-lock.yaml"))) {
      return { installCwd: installRoot, packageManager: "pnpm", hasLockfile: true };
    }
    if (await fileExists(join(installRoot, "yarn.lock"))) {
      return { installCwd: installRoot, packageManager: "yarn", hasLockfile: true };
    }
    if (
      await fileExists(join(installRoot, "package-lock.json")) ||
      await fileExists(join(installRoot, "npm-shrinkwrap.json"))
    ) {
      return { installCwd: installRoot, packageManager: "npm", hasLockfile: true };
    }
  }

  return { installCwd: buildRoot, packageManager: "npm", hasLockfile: false };
}

function getInstallCommand(packageManager: PackageManager, hasLockfile: boolean): string {
  if (packageManager === "pnpm") {
    return hasLockfile ? "pnpm install --frozen-lockfile" : "pnpm install";
  }
  if (packageManager === "yarn") {
    return hasLockfile ? "yarn install --frozen-lockfile" : "yarn install";
  }
  if (hasLockfile) {
    return "npm ci --no-audit --no-fund";
  }
  return "npm install --prefer-offline --no-audit --no-fund";
}

function getBuildCommand(packageManager: PackageManager, hasBuildScript: boolean): string | null {
  if (!hasBuildScript) {
    return null;
  }

  if (packageManager === "yarn") return "yarn run build";
  return `${packageManager} run build`;
}

async function resolveDeploymentPlan(repoDir: string, preferredRoot = ""): Promise<ResolvedDeploymentPlan | null> {
  const candidate = await findProjectRoot(repoDir, preferredRoot);
  if (!candidate) {
    return null;
  }

  const buildRoot = candidate.dir;
  const packageManager = await detectPackageManager(buildRoot, repoDir);

  return {
    buildCommand: getBuildCommand(packageManager.packageManager, candidate.hasBuildScript),
    buildRoot,
    buildRootRelative: toLogRelativePath(repoDir, buildRoot),
    framework: candidate.framework,
    hasBuildScript: candidate.hasBuildScript,
    installCommand: getInstallCommand(packageManager.packageManager, packageManager.hasLockfile),
    installCwd: packageManager.installCwd,
    installCwdRelative: toLogRelativePath(repoDir, packageManager.installCwd),
    packageManager: packageManager.packageManager,
    rootDirectory: toStoredRelativePath(repoDir, buildRoot),
    runtimeHint: candidate.runtimeHint,
  };
}

function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl.replace(/\.git$/, ""));
    if (!url.hostname.includes("github.com")) return null;
    const parts = url.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

async function downloadAndExtract(
  url: string,
  destDir: string,
  token?: string | null,
): Promise<boolean> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Hostack",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    let details = "";
    try {
      details = truncateForLogs(await response.text());
    } catch {
      details = "";
    }

    throw new Error(
      `Archive download failed with ${response.status}${details ? `: ${details}` : ""}`,
    );
  }

  if (!response.body) {
    throw new Error("Archive download returned an empty response body");
  }

  await pipeline(
    Readable.fromWeb(response.body as globalThis.ReadableStream<Uint8Array>),
    extractTarball({
      cwd: destDir,
      strip: 1,
    }),
  );

  return true;
}

async function cloneRepo(
  repoUrl: string,
  branch: string,
  workDir: string,
  deploymentId: string,
  stepOrderRef: { value: number },
  githubToken?: string | null,
  commitHash?: string | null,
): Promise<void> {
  const gh = parseGitHubUrl(repoUrl);

  if (gh) {
    let lastArchiveError: Error | null = null;

    if (commitHash) {
      const tarUrl = githubToken
        ? `https://api.github.com/repos/${gh.owner}/${gh.repo}/tarball/${commitHash}`
        : `https://codeload.github.com/${gh.owner}/${gh.repo}/tar.gz/${commitHash}`;
      try {
        await downloadAndExtract(tarUrl, workDir, githubToken);
        return;
      } catch (error) {
        lastArchiveError = error instanceof Error ? error : new Error(String(error));
      }
    }

    const branchesToTry = branch ? [branch] : ["main", "master"];
    for (const candidateBranch of branchesToTry) {
      const tarUrl = githubToken
        ? `https://api.github.com/repos/${gh.owner}/${gh.repo}/tarball/${candidateBranch}`
        : `https://codeload.github.com/${gh.owner}/${gh.repo}/tar.gz/refs/heads/${candidateBranch}`;
      try {
        await downloadAndExtract(tarUrl, workDir, githubToken);
        return;
      } catch (error) {
        lastArchiveError = error instanceof Error ? error : new Error(String(error));
      }
    }

    await insertLog(
      deploymentId,
      `Archive download failed for '${repoUrl}'. Falling back to git clone${lastArchiveError ? ` (${lastArchiveError.message})` : ""}.`,
      "warn",
      stepOrderRef,
    );
  }

  if (commitHash) {
    await runCommand(
      `git clone --single-branch ${branch ? `--branch ${branch} ` : ""}${repoUrl} .`,
      workDir,
      deploymentId,
      stepOrderRef,
    );
    await runCommand(`git checkout ${commitHash}`, workDir, deploymentId, stepOrderRef);
    return;
  }

  await runCommand(
    `git clone --depth=1 --single-branch ${branch ? `--branch ${branch} ` : ""}${repoUrl} .`,
    workDir,
    deploymentId,
    stepOrderRef,
  );
}

async function fetchGitHubCommitInfo(
  repoUrl: string,
  branch: string,
  token?: string | null,
): Promise<{ hash: string; message: string }> {
  const gh = parseGitHubUrl(repoUrl);
  if (!gh) return { hash: "", message: "" };

  try {
    const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/commits/${branch || "HEAD"}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(url, { headers });
    if (!response.ok) return { hash: "", message: "" };

    const data = (await response.json()) as {
      sha?: string;
      commit?: { message?: string };
    };
    return {
      hash: data.sha ?? "",
      message: data.commit?.message?.split("\n")[0] ?? "",
    };
  } catch {
    return { hash: "", message: "" };
  }
}

async function getProjectGitHubToken(project: typeof projectsTable.$inferSelect): Promise<string | null> {
  const directToken = decryptString(project.githubToken) ?? null;
  if (directToken) {
    return directToken;
  }

  const [integration] = await db
    .select()
    .from(integrationsTable)
    .where(
      and(
        eq(integrationsTable.userId, project.userId),
        eq(integrationsTable.provider, "github"),
        eq(integrationsTable.status, "connected"),
      ),
    );

  if (!integration) {
    return null;
  }

  const metadata = decryptMetadata(integration.metadata as Record<string, unknown> | null);
  return typeof metadata.accessToken === "string" ? metadata.accessToken : null;
}

function getExpectedOutputDirs(framework: FrameworkType): string[] {
  switch (framework) {
    case "next.js":
      return [".next", "out"];
    case "nuxt":
      return [".output"];
    case "sveltekit":
      return ["build"];
    case "vue":
    case "react":
      return ["dist", "build", "out"];
    default:
      return [];
  }
}

async function resolveStaticOutputDir(
  buildRoot: string,
  frameworkType: FrameworkType,
  explicitOutputDirectory: string | null,
  buildWasRun: boolean,
): Promise<{ artifactSourcePath: string; outputDirectory: string | null }> {
  if (explicitOutputDirectory) {
    const explicitPath = join(buildRoot, explicitOutputDirectory);
    if (!(await fileExists(explicitPath))) {
      throw new Error(`Build output not found at ${explicitOutputDirectory}`);
    }
    return { artifactSourcePath: explicitPath, outputDirectory: null };
  }

  for (const candidate of getExpectedOutputDirs(frameworkType)) {
    const candidatePath = join(buildRoot, candidate);
    if (await fileExists(candidatePath)) {
      return { artifactSourcePath: candidatePath, outputDirectory: null };
    }
  }

  if (!buildWasRun && (await fileExists(join(buildRoot, "index.html")))) {
    return { artifactSourcePath: buildRoot, outputDirectory: null };
  }

  throw new Error("Could not determine static build output");
}

async function writeBuildMetadata(buildRoot: string, runtimeKind: RuntimeKind) {
  await writeFile(
    join(buildRoot, ".hostack-runtime.json"),
    JSON.stringify({ runtimeKind }, null, 2),
    "utf8",
  );
}

export async function buildDeployment(deploymentId: string): Promise<void> {
  const [deployment] = await db
    .select()
    .from(deploymentsTable)
    .where(eq(deploymentsTable.id, deploymentId));

  if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, deployment.projectId));

  if (!project) throw new Error(`Project not found for deployment ${deploymentId}`);
  if (!project.repoUrl) throw new Error("No repository URL configured for this project");

  const branch = deployment.branch || project.repoBranch || "main";
  const githubToken = await getProjectGitHubToken(project);
  const rules = await db
    .select()
    .from(buildRulesTable)
    .where(eq(buildRulesTable.projectId, deployment.projectId));

  const matchingRule = rules.find((rule) => {
    const pattern = rule.branchPattern;
    if (pattern === branch || pattern === "*") return true;
    if (pattern.endsWith("/*") && branch.startsWith(pattern.slice(0, -1))) return true;
    if (!pattern.includes("*")) return false;
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(branch);
  });

  const preferredRoot = project.rootDirectory || "";

  const stepOrderRef = { value: await getNextStepOrder(deploymentId) };
  const startedAt = Date.now();
  let workDir: string | null = null;
  let failureReason: string | null = null;

  const log = (message: string, level: LogLevel = "info") =>
    insertLog(deploymentId, message, level, stepOrderRef);

  await db
    .update(deploymentsTable)
    .set({
      status: "preparing",
      executionMode: "real",
      simulated: false,
      startedAt: new Date(),
      completedAt: null,
      failureReason: null,
    })
    .where(eq(deploymentsTable.id, deploymentId));

  dispatchDeployNotification(deploymentId, "deploy_started").catch(() => {});

  try {
    workDir = await mkdtemp(join(tmpdir(), `hostack-${deploymentId.slice(0, 8)}-`));
    await log(`Preparing deployment for ${project.name}`);
    await log(`Repository: ${project.repoUrl}`);
    await log(`Branch: ${branch}`);

    await setStatus(deploymentId, "cloning");
    await log("State transition: cloning");
    await log(`Running clone for ${project.repoUrl}`);
    await cloneRepo(project.repoUrl, branch, workDir, deploymentId, stepOrderRef, githubToken, deployment.commitHash);

    let commitHash = deployment.commitHash || "";
    let commitMessage = deployment.commitMessage || "";
    if (!commitHash) {
      const info = await fetchGitHubCommitInfo(project.repoUrl, branch, githubToken);
      commitHash = info.hash;
      commitMessage = info.message;
    }

    await setStatus(deploymentId, "detecting");
    await log("State transition: detecting");

    const resolvedPlan = await resolveDeploymentPlan(workDir, preferredRoot);
    if (!resolvedPlan) {
      failureReason = "No package.json found in repository root or known app directories";
      throw new Error(failureReason);
    }

    const buildRoot = resolvedPlan.buildRoot;
    const frameworkType = resolvedPlan.framework;
    const baseInstallCommand = resolvedPlan.installCommand;
    const detectedBuildCommand = resolvedPlan.buildCommand;
    const installCommand = matchingRule?.installCommandOverride || baseInstallCommand;
    const explicitBuildCommand =
      matchingRule?.buildCommandOverride ??
      detectedBuildCommand;
    const buildCommand = explicitBuildCommand ?? "";
    let runtimeKind: RuntimeKind | null = resolvedPlan.runtimeHint;

    await log(`Selected project root: ${resolvedPlan.buildRootRelative}`);
    await log(`Selected package manager: ${resolvedPlan.packageManager}`);
    await log(`Selected install root: ${resolvedPlan.installCwdRelative}`);
    await log(`Resolved framework: ${frameworkType}`);
    await log(`Runtime hint: ${runtimeKind ?? "ambiguous"}`);
    await log(`Resolved install command: ${installCommand}`);
    await log(`Resolved build command: ${explicitBuildCommand ?? "none"}`);

    await setStatus(deploymentId, "installing");
    await log("State transition: installing");
    await log(`Executing install command: ${installCommand}`);

    try {
      await runInstallCommandWithRetry(
        installCommand,
        resolvedPlan.installCwd,
        deploymentId,
        stepOrderRef,
      );
    } catch (error) {
      failureReason = `Install failed: ${(error as Error).message}`;
      throw error;
    }

    const shouldRunBuild =
      explicitBuildCommand !== null
        ? explicitBuildCommand.trim().length > 0
        : resolvedPlan.hasBuildScript || FRAMEWORKS_REQUIRING_BUILD.includes(frameworkType);

    let buildWasRun = false;
    if (shouldRunBuild) {
      await setStatus(deploymentId, "building");
      await log("State transition: building");

      if (!buildCommand.trim() && FRAMEWORKS_REQUIRING_BUILD.includes(frameworkType)) {
        failureReason = `Build command is required for ${frameworkType}`;
        throw new Error(failureReason);
      }

      await log(`Executing build command: ${buildCommand}`);
      try {
        await runCommand(buildCommand, buildRoot, deploymentId, stepOrderRef, {
          timeoutMs: BUILD_TIMEOUT_MS,
        });
        buildWasRun = true;
      } catch (error) {
        failureReason = `Build failed: ${(error as Error).message}`;
        throw error;
      }
    }

    let artifactSourcePath = buildRoot;
    let outputDirectory: string | null = null;

    if (runtimeKind === "node-api") {
      await log("Runtime kind: node-api");
    } else {
      if (runtimeKind === null) {
        try {
          await detectNodeStartCommand(buildRoot);
          runtimeKind = "node-api";
        } catch {
          runtimeKind = null;
        }
      }

      if (runtimeKind === null) {
        try {
          const resolved = await resolveStaticOutputDir(
            buildRoot,
            frameworkType,
            deployment.outputDirectory,
            buildWasRun,
          );
          artifactSourcePath = resolved.artifactSourcePath;
          outputDirectory = resolved.outputDirectory;
          runtimeKind = "static";
        } catch {
          runtimeKind = null;
        }
      } else if (runtimeKind === "static") {
        try {
          const resolved = await resolveStaticOutputDir(
            buildRoot,
            frameworkType,
            deployment.outputDirectory,
            buildWasRun,
          );
          artifactSourcePath = resolved.artifactSourcePath;
          outputDirectory = resolved.outputDirectory;
        } catch (error) {
          failureReason = `Artifact invalid: ${(error as Error).message}`;
          throw error;
        }
      }
    }

    if (runtimeKind === null) {
      failureReason = "Could not determine whether deployment should run as a Node service or static artifact";
      throw new Error(failureReason);
    }

    await log(`Runtime kind: ${runtimeKind}`);

    await writeBuildMetadata(buildRoot, runtimeKind);

    await setStatus(deploymentId, "packaging");
    await log("State transition: packaging");
    await log(`Packaging artifact from ${relative(workDir, artifactSourcePath) || "."}`);

    const artifactPath = await packageDeploymentArtifact({
      deploymentId,
      sourcePath: artifactSourcePath,
      metadata: {
        runtimeKind,
        buildCommand: buildWasRun ? buildCommand || null : null,
        installCommand,
        outputDirectory,
      },
    });

    await setStatus(deploymentId, "deploying");
    await log("State transition: deploying");
    await setStatus(deploymentId, "verifying");
    await log("State transition: verifying");

    let deploymentUrl: string;
    if (runtimeKind === "node-api") {
      const nodeResult = await activateNodeDeployment({
        deploymentId,
        projectId: project.id,
        environment: deployment.environment,
        branch,
        artifactPath,
        installCommandUsed: installCommand,
        buildCommandUsed: buildWasRun ? buildCommand : null,
        buildRoot: relative(workDir, buildRoot) || ".",
        outputDirectory,
        commitHash: commitHash || null,
        commitMessage: commitMessage || "Deploy via Hostack dashboard",
      });
      deploymentUrl = nodeResult.deploymentUrl;
    } else {
      deploymentUrl = await activateStaticDeployment({
        deploymentId,
        projectId: project.id,
        environment: deployment.environment,
        branch,
        artifactPath,
        installCommandUsed: installCommand,
        buildCommandUsed: buildWasRun ? buildCommand : null,
        buildRoot: relative(workDir, buildRoot) || ".",
        outputDirectory,
        commitHash: commitHash || null,
        commitMessage: commitMessage || "Deploy via Hostack dashboard",
      });
    }
    await log(`Artifact ready at ${artifactPath}`, "success");
    await log(`Deployment available at ${deploymentUrl}`, "success");

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    await db
      .update(projectsTable)
      .set({
        buildCommand: detectedBuildCommand,
        framework: frameworkType,
        installCommand: baseInstallCommand,
        repoBranch: branch,
        rootDirectory: resolvedPlan.rootDirectory,
      })
      .where(eq(projectsTable.id, project.id));

    await db
      .update(deploymentsTable)
      .set({
        status: "ready",
        durationSeconds,
        completedAt: new Date(),
        deploymentUrl,
        artifactPath,
        runtimeKind,
        outputDirectory,
        commitHash: commitHash || null,
        commitMessage: commitMessage
          ? commitMessage.slice(0, 490)
          : "Deploy via Hostack dashboard",
      })
      .where(eq(deploymentsTable.id, deploymentId));

    dispatchDeployNotification(deploymentId, "deploy_succeeded").catch(() => {});
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    const reason = failureReason || err.message;

    await log(`Deployment failed: ${reason}`, "error");
    await db
      .update(deploymentsTable)
      .set({
        status: "failed",
        completedAt: new Date(),
        durationSeconds,
        failureReason: reason,
      })
      .where(eq(deploymentsTable.id, deploymentId));

    dispatchDeployNotification(deploymentId, "deploy_failed").catch(() => {});
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
