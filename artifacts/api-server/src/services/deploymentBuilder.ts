import { spawn } from "child_process";
import { mkdtemp, rm, readFile, access, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, relative } from "path";
import { db } from "@workspace/db";
import { deploymentsTable, deploymentLogsTable, projectsTable, buildRulesTable, integrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { dispatchDeployNotification } from "./notificationDispatcher.js";
import {
  activateNodeDeployment,
  activateStaticDeployment,
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

const BUILD_TIMEOUT_MS = 5 * 60 * 1000;
const CANDIDATE_DIRS = [".", "app", "web", "frontend", "client", "src"];
const FRAMEWORKS_REQUIRING_BUILD: FrameworkType[] = ["next.js", "nuxt", "sveltekit", "vue", "react"];

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

function runCommand(
  command: string,
  cwd: string,
  deploymentId: string,
  stepOrderRef: { value: number },
): Promise<void> {
  const { cmd, args } = parseCommand(command);

  return new Promise((resolve, reject) => {
    const baseEnv = { ...process.env };
    delete baseEnv.GIT_ASKPASS;
    delete baseEnv.SSH_ASKPASS;
    delete baseEnv.GIT_SSH_COMMAND;
    delete baseEnv.GIT_CREDENTIAL_HELPER;

    const proc = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: /\b(npm|pnpm|yarn)\b/.test(command),
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

    const flush = (line: string, level: LogLevel) => {
      const sanitized = sanitizeMessage(line);
      if (!sanitized) return;
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

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Command timed out after ${BUILD_TIMEOUT_MS / 1000}s`));
    }, BUILD_TIMEOUT_MS);

    proc.on("close", async (code) => {
      clearTimeout(timeout);
      if (stdoutBuf.trimEnd()) flush(stdoutBuf, "info");
      if (stderrBuf.trimEnd()) flush(stderrBuf, "error");
      await Promise.allSettled(pendingLogs);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command '${command}' exited with code ${code}`));
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start '${command}': ${err.message}`));
    });
  });
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
  score: number;
  framework: FrameworkType;
}

async function scoreCandidate(baseDir: string, candidateRelative: string): Promise<ProjectRootCandidate | null> {
  const candidatePath = candidateRelative === "." ? baseDir : join(baseDir, candidateRelative);
  const pkgPath = join(candidatePath, "package.json");

  if (!(await fileExists(pkgPath))) return null;

  let score = 1;
  let framework: FrameworkType = "unknown";

  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scripts: Record<string, string> = pkg.scripts ?? {};

    if (typeof scripts.build === "string") score += 2;

    if (allDeps["next"]) {
      framework = "next.js";
      score += 3;
    } else if (allDeps["nuxt"] || allDeps["nuxt3"]) {
      framework = "nuxt";
      score += 3;
    } else if (allDeps["@sveltejs/kit"]) {
      framework = "sveltekit";
      score += 3;
    } else if (allDeps["vue"]) {
      framework = "vue";
      score += 2;
    } else if (allDeps["react"]) {
      framework = "react";
      score += 2;
    } else if (Object.keys(allDeps).length > 0) {
      framework = "node-api";
      score += 1;
    }
  } catch {
    return null;
  }

  return { dir: candidatePath, score, framework };
}

async function findProjectRoot(repoDir: string): Promise<{ dir: string; framework: FrameworkType } | null> {
  const candidates: ProjectRootCandidate[] = [];

  for (const candidate of CANDIDATE_DIRS) {
    const result = await scoreCandidate(repoDir, candidate);
    if (result) candidates.push(result);
  }

  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.score - left.score);
  return { dir: candidates[0].dir, framework: candidates[0].framework };
}

async function detectFramework(workDir: string): Promise<{
  framework: FrameworkType;
  hasBuildScript: boolean;
}> {
  const pkgPath = join(workDir, "package.json");
  if (!(await fileExists(pkgPath))) {
    return { framework: "static", hasBuildScript: false };
  }

  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scripts: Record<string, string> = pkg.scripts ?? {};
    const hasBuildScript = typeof scripts.build === "string";

    if (allDeps["next"]) return { framework: "next.js", hasBuildScript };
    if (allDeps["nuxt"] || allDeps["nuxt3"]) return { framework: "nuxt", hasBuildScript };
    if (allDeps["@sveltejs/kit"]) return { framework: "sveltekit", hasBuildScript };
    if (allDeps["vue"]) return { framework: "vue", hasBuildScript };
    if (allDeps["react"]) return { framework: "react", hasBuildScript };
    if (Object.keys(allDeps).length > 0) return { framework: "node-api", hasBuildScript };
    return { framework: "static", hasBuildScript: false };
  } catch {
    return { framework: "static", hasBuildScript: false };
  }
}

function normalizeFrameworkName(framework: string): FrameworkType {
  const lower = framework.toLowerCase();
  if (lower.includes("next")) return "next.js";
  if (lower.includes("nuxt")) return "nuxt";
  if (lower.includes("svelte")) return "sveltekit";
  if (lower.includes("vue")) return "vue";
  if (lower.includes("react")) return "react";
  if (lower.includes("node")) return "node-api";
  if (lower.includes("static")) return "static";
  return "unknown";
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
  deploymentId: string,
  stepOrderRef: { value: number },
  token?: string | null,
): Promise<boolean> {
  const tarPath = `${destDir}/../_archive_${deploymentId.slice(0, 8)}.tar.gz`;
  const curlArgs = ["-sSL", "--fail", "--max-time", "120"];
  if (token) {
    curlArgs.push("-H", `Authorization: Bearer ${token}`);
    curlArgs.push("-H", "Accept: application/vnd.github+json");
  }
  curlArgs.push("-o", tarPath, url);

  try {
    await runCommand(`curl ${curlArgs.join(" ")}`, destDir, deploymentId, stepOrderRef);
    await runCommand(`tar -xzf ${tarPath} --strip-components=1 -C ${destDir}`, destDir, deploymentId, stepOrderRef);
    return true;
  } finally {
    await rm(tarPath, { force: true }).catch(() => {});
  }
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
    if (commitHash) {
      const tarUrl = githubToken
        ? `https://api.github.com/repos/${gh.owner}/${gh.repo}/tarball/${commitHash}`
        : `https://codeload.github.com/${gh.owner}/${gh.repo}/tar.gz/${commitHash}`;
      try {
        await downloadAndExtract(tarUrl, workDir, deploymentId, stepOrderRef, githubToken);
        return;
      } catch {
        // Fall through to branch fetch.
      }
    }

    const branchesToTry = branch ? [branch] : ["main", "master"];
    for (const candidateBranch of branchesToTry) {
      const tarUrl = githubToken
        ? `https://api.github.com/repos/${gh.owner}/${gh.repo}/tarball/${candidateBranch}`
        : `https://codeload.github.com/${gh.owner}/${gh.repo}/tar.gz/refs/heads/${candidateBranch}`;
      try {
        await downloadAndExtract(tarUrl, workDir, deploymentId, stepOrderRef, githubToken);
        return;
      } catch {
        // Try next branch.
      }
    }

    throw new Error(`Could not download repository '${repoUrl}'`);
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

  return { artifactSourcePath: buildRoot, outputDirectory: null };
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

  const installCommand =
    matchingRule?.installCommandOverride ||
    project.installCommand ||
    "npm install --prefer-offline --no-audit --no-fund";
  const explicitBuildCommand =
    matchingRule?.buildCommandOverride ??
    project.buildCommand ??
    null;
  const buildCommand = explicitBuildCommand || "npm run build";
  const configuredRoot = project.rootDirectory || "";

  const stepOrderRef = { value: 0 };
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

    let buildRoot = configuredRoot ? join(workDir, configuredRoot) : workDir;
    if (configuredRoot && !(await fileExists(join(buildRoot, "package.json")))) {
      failureReason = `package.json not found in configured root directory '${configuredRoot}'`;
      throw new Error(failureReason);
    }

    if (!configuredRoot) {
      const detected = await findProjectRoot(workDir);
      if (!detected) {
        failureReason = "No package.json found in repository root or known app directories";
        throw new Error(failureReason);
      }
      buildRoot = detected.dir;
      await log(`Detected project root: ${relative(workDir, buildRoot) || "."}`);
    }

    if (!(await fileExists(join(buildRoot, "package.json")))) {
      failureReason = "package.json not found in the selected project root";
      throw new Error(failureReason);
    }

    const detected = await detectFramework(buildRoot);
    const configuredFramework = normalizeFrameworkName(project.framework);
    const frameworkType = configuredFramework !== "unknown" ? configuredFramework : detected.framework;
    const runtimeKind: RuntimeKind = frameworkType === "node-api" ? "node-api" : "static";

    await log(`Resolved framework: ${frameworkType}`);
    await log(`Runtime kind: ${runtimeKind}`);

    await setStatus(deploymentId, "installing");
    await log("State transition: installing");
    await log(`Executing install command: ${installCommand}`);

    try {
      await runCommand(installCommand, buildRoot, deploymentId, stepOrderRef);
    } catch (error) {
      failureReason = `Install failed: ${(error as Error).message}`;
      throw error;
    }

    const shouldRunBuild =
      explicitBuildCommand !== null
        ? explicitBuildCommand.trim().length > 0
        : detected.hasBuildScript || FRAMEWORKS_REQUIRING_BUILD.includes(frameworkType);

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
        await runCommand(buildCommand, buildRoot, deploymentId, stepOrderRef);
        buildWasRun = true;
      } catch (error) {
        failureReason = `Build failed: ${(error as Error).message}`;
        throw error;
      }
    }

    let artifactSourcePath = buildRoot;
    let outputDirectory: string | null = null;

    if (runtimeKind === "static") {
      try {
        const resolved = await resolveStaticOutputDir(buildRoot, frameworkType, deployment.outputDirectory);
        artifactSourcePath = resolved.artifactSourcePath;
        outputDirectory = resolved.outputDirectory;
      } catch (error) {
        failureReason = `Artifact invalid: ${(error as Error).message}`;
        throw error;
      }
    }

    await writeBuildMetadata(buildRoot, runtimeKind);

    await setStatus(deploymentId, "packaging");
    await log("State transition: packaging");
    await log(`Packaging artifact from ${relative(workDir, artifactSourcePath) || "."}`);

    const artifactPath = await packageDeploymentArtifact({
      deploymentId,
      sourcePath: artifactSourcePath,
      metadata: {
        runtimeKind,
        buildCommand: buildCommand || null,
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
