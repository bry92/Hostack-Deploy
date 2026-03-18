import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { access, cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { db } from "@workspace/db";
import { deploymentLogsTable, deploymentsTable } from "@workspace/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { APP_URL } from "../lib/auth.js";

export type RuntimeKind = "static" | "node-api";
type LogLevel = "info" | "warn" | "error" | "success";

interface WorkerHandle {
  child: ChildProcess;
  deploymentId: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
}

interface RuntimeHandle extends WorkerHandle {
  projectId: string;
  environment: string;
  branch: string | null;
  port: number;
}

interface ArtifactMetadata {
  runtimeKind: RuntimeKind;
  buildCommand: string | null;
  installCommand: string | null;
  outputDirectory: string | null;
}

const runtimeRegistry = new Map<string, RuntimeHandle>();
const portFloor = Number(process.env["DEPLOYMENT_PORT_START"] ?? "4500");
const portSpan = Number(process.env["DEPLOYMENT_PORT_SPAN"] ?? "1000");
const artifactsRoot =
  process.env["HOSTACK_ARTIFACTS_ROOT"] ?? join(process.cwd(), ".hostack-artifacts", "deployments");

async function insertRuntimeLog(
  deploymentId: string,
  message: string,
  level: LogLevel,
) {
  const [last] = await db
    .select({ stepOrder: deploymentLogsTable.stepOrder })
    .from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, deploymentId))
    .orderBy(desc(deploymentLogsTable.stepOrder))
    .limit(1);

  await db.insert(deploymentLogsTable).values({
    deploymentId,
    logLevel: level,
    message: message.replace(/\r/g, "").trimEnd(),
    stepOrder: (last?.stepOrder ?? -1) + 1,
  });
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function allocatePort(deploymentId: string): number {
  const taken = new Set(Array.from(runtimeRegistry.values()).map((entry) => entry.port));
  const start = portFloor + (hashString(deploymentId) % Math.max(portSpan, 1));

  for (let offset = 0; offset < portSpan; offset += 1) {
    const candidate = portFloor + ((start - portFloor + offset) % portSpan);
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error("No free deployment runtime ports available");
}

async function ensureArtifactsRoot() {
  await mkdir(artifactsRoot, { recursive: true });
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function splitCommand(command: string): { cmd: string; args: string[]; shell: boolean } {
  const trimmed = command.trim();
  const shell = /\b(npm|pnpm|yarn)\b/.test(trimmed) || /[&|<>]/.test(trimmed);
  if (shell) {
    return { cmd: trimmed, args: [], shell: true };
  }

  const [cmd, ...args] = trimmed.split(/\s+/);
  return { cmd, args, shell: false };
}

function normalizeWorkerEnv(env: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  );
}

export const workerManager = {
  start(params: {
    deploymentId: string;
    command: string;
    cwd: string;
    env?: Record<string, string | undefined>;
    onStdout?: (message: string) => void;
    onStderr?: (message: string) => void;
    onExit?: (code: number | null) => void;
  }): WorkerHandle {
    const { cmd, args, shell } = splitCommand(params.command);
    const env = normalizeWorkerEnv({
      ...Object.fromEntries(
        Object.entries(process.env).map(([key, value]) => [key, value]),
      ),
      ...params.env,
    });

    const child = shell
      ? spawn(cmd, {
          cwd: params.cwd,
          env,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
        })
      : spawn(cmd, args, {
          cwd: params.cwd,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });

    child.stdout.on("data", (buffer: Buffer) => {
      const message = buffer.toString().trim();
      if (message) params.onStdout?.(message);
    });

    child.stderr.on("data", (buffer: Buffer) => {
      const message = buffer.toString().trim();
      if (message) params.onStderr?.(message);
    });

    child.on("exit", (code) => {
      params.onExit?.(code);
    });

    return {
      child,
      deploymentId: params.deploymentId,
      command: params.command,
      cwd: params.cwd,
      env,
    };
  },

  stop(handle: WorkerHandle) {
    handle.child.kill("SIGTERM");
  },

  streamLogs(
    deploymentId: string,
    handle: WorkerHandle,
    prefix = "",
  ) {
    handle.child.stdout?.on("data", (buffer: Buffer) => {
      const message = buffer.toString().trim();
      if (message) {
        void insertRuntimeLog(deploymentId, `${prefix}${message}`, "info");
      }
    });

    handle.child.stderr?.on("data", (buffer: Buffer) => {
      const message = buffer.toString().trim();
      if (message) {
        void insertRuntimeLog(deploymentId, `${prefix}${message}`, "error");
      }
    });
  },
};

async function detectNodeStartCommand(artifactPath: string): Promise<string> {
  const pkgPath = join(artifactPath, "package.json");
  if (await pathExists(pkgPath)) {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    if (typeof pkg.scripts?.start === "string" && pkg.scripts.start.trim()) {
      return "npm run start";
    }
  }

  const candidates = [
    "dist/index.js",
    "dist/server.js",
    "build/index.js",
    "build/server.js",
    "server.js",
    "index.js",
  ];

  for (const candidate of candidates) {
    if (await pathExists(join(artifactPath, candidate))) {
      return `node ${candidate}`;
    }
  }

  throw new Error("Could not determine how to start the Node deployment");
}

async function verifyRuntimeHealth(port: number): Promise<void> {
  const attempts = 3;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const request = http.request(
          {
            host: "127.0.0.1",
            port,
            path: "/",
            method: "GET",
            timeout: 10_000,
          },
          (response) => {
            response.resume();
            if ((response.statusCode ?? 500) < 500) {
              resolve();
              return;
            }
            reject(new Error(`Health check returned ${response.statusCode}`));
          },
        );
        request.on("timeout", () => request.destroy(new Error("Health check timed out")));
        request.on("error", reject);
        request.end();
      });
      return;
    } catch (error) {
      if (attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function stopRuntimeByDeploymentId(deploymentId: string): Promise<void> {
  const handle = runtimeRegistry.get(deploymentId);
  if (!handle) return;
  workerManager.stop(handle);
  runtimeRegistry.delete(deploymentId);
}

async function getCurrentDeployments(
  projectId: string,
  environment: string,
  branch: string | null,
) {
  const conditions = [
    eq(deploymentsTable.projectId, projectId),
    eq(deploymentsTable.environment, environment),
    eq(deploymentsTable.isCurrent, true),
  ];

  if (environment !== "production") {
    conditions.push(branch === null ? isNull(deploymentsTable.branch) : eq(deploymentsTable.branch, branch));
  }

  return db
    .select()
    .from(deploymentsTable)
    .where(and(...conditions));
}

async function clearCurrentDeployments(
  projectId: string,
  environment: string,
  branch: string | null,
) {
  const previous = await getCurrentDeployments(projectId, environment, branch);
  const conditions = [
    eq(deploymentsTable.projectId, projectId),
    eq(deploymentsTable.environment, environment),
    eq(deploymentsTable.isCurrent, true),
  ];

  if (environment !== "production") {
    conditions.push(branch === null ? isNull(deploymentsTable.branch) : eq(deploymentsTable.branch, branch));
  }

  await db
    .update(deploymentsTable)
    .set({ isCurrent: false, activeEnvironment: null })
    .where(and(...conditions));

  await Promise.all(previous.map((deployment) => stopRuntimeByDeploymentId(deployment.id)));
}

function getDeploymentRoot(deploymentId: string) {
  return join(artifactsRoot, deploymentId);
}

export function getArtifactRoot() {
  return artifactsRoot;
}

export async function packageDeploymentArtifact(params: {
  deploymentId: string;
  sourcePath: string;
  metadata: ArtifactMetadata;
}): Promise<string> {
  await ensureArtifactsRoot();
  const deploymentRoot = getDeploymentRoot(params.deploymentId);
  const artifactPath = join(deploymentRoot, "artifact");

  await mkdir(deploymentRoot, { recursive: true });
  await mkdir(artifactPath, { recursive: true });
  await cp(params.sourcePath, artifactPath, {
    recursive: true,
    force: true,
  });
  await writeFile(
    join(deploymentRoot, "metadata.json"),
    JSON.stringify(params.metadata, null, 2),
    "utf8",
  );

  return artifactPath;
}

function getPublicDeploymentUrl(deploymentId: string, runtimeKind: RuntimeKind, projectId: string, environment: string) {
  if (environment === "production") {
    return `${APP_URL}/api/projects/${projectId}/environments/${environment}/`;
  }

  const suffix = runtimeKind === "node-api" ? "runtime" : "artifact";
  return `${APP_URL}/api/deployments/${deploymentId}/${suffix}/`;
}

export async function activateStaticDeployment(params: {
  deploymentId: string;
  projectId: string;
  environment: string;
  branch: string | null;
  artifactPath: string;
  installCommandUsed: string | null;
  buildCommandUsed: string | null;
  buildRoot: string | null;
  outputDirectory: string | null;
  commitHash: string | null;
  commitMessage: string | null;
}) {
  const deploymentUrl = getPublicDeploymentUrl(params.deploymentId, "static", params.projectId, params.environment);

  await clearCurrentDeployments(params.projectId, params.environment, params.branch);

  await db
    .update(deploymentsTable)
    .set({
      status: "ready",
      isCurrent: true,
      simulated: false,
      executionMode: "real",
      runtimeKind: "static",
      artifactPath: params.artifactPath,
      activeEnvironment: params.environment,
      deploymentUrl,
      installCommandUsed: params.installCommandUsed,
      buildCommandUsed: params.buildCommandUsed,
      buildRoot: params.buildRoot,
      outputDirectory: params.outputDirectory,
      commitHash: params.commitHash,
      commitMessage: params.commitMessage,
      failureReason: null,
      completedAt: new Date(),
    })
    .where(eq(deploymentsTable.id, params.deploymentId));

  return deploymentUrl;
}

export async function activateNodeDeployment(params: {
  deploymentId: string;
  projectId: string;
  environment: string;
  branch: string | null;
  artifactPath: string;
  installCommandUsed: string | null;
  buildCommandUsed: string | null;
  buildRoot: string | null;
  outputDirectory: string | null;
  commitHash: string | null;
  commitMessage: string | null;
}) {
  const runtimeCommand = await detectNodeStartCommand(params.artifactPath);
  const runtimePort = allocatePort(params.deploymentId);

  await insertRuntimeLog(
    params.deploymentId,
    `Starting runtime worker: ${runtimeCommand} on port ${runtimePort}`,
    "info",
  );

  const handle = workerManager.start({
    deploymentId: params.deploymentId,
    command: runtimeCommand,
    cwd: params.artifactPath,
    env: {
      NODE_ENV: "production",
      PORT: String(runtimePort),
    },
    onStdout: (message) => {
      void insertRuntimeLog(params.deploymentId, `[runtime] ${message}`, "info");
    },
    onStderr: (message) => {
      void insertRuntimeLog(params.deploymentId, `[runtime] ${message}`, "error");
    },
    onExit: (code) => {
      runtimeRegistry.delete(params.deploymentId);
      void db
        .update(deploymentsTable)
        .set({
          isCurrent: false,
          activeEnvironment: null,
          status: "failed",
          failureReason: `Runtime exited with code ${code ?? "unknown"}`,
        })
        .where(eq(deploymentsTable.id, params.deploymentId));
    },
  });

  runtimeRegistry.set(params.deploymentId, {
    ...handle,
    projectId: params.projectId,
    environment: params.environment,
    branch: params.branch,
    port: runtimePort,
  });

  try {
    await verifyRuntimeHealth(runtimePort);
  } catch (error) {
    await stopRuntimeByDeploymentId(params.deploymentId);
    throw error;
  }

  const deploymentUrl = getPublicDeploymentUrl(params.deploymentId, "node-api", params.projectId, params.environment);

  await clearCurrentDeployments(params.projectId, params.environment, params.branch);

  runtimeRegistry.set(params.deploymentId, {
    ...handle,
    projectId: params.projectId,
    environment: params.environment,
    branch: params.branch,
    port: runtimePort,
  });

  await db
    .update(deploymentsTable)
    .set({
      status: "ready",
      isCurrent: true,
      simulated: false,
      executionMode: "real",
      runtimeKind: "node-api",
      artifactPath: params.artifactPath,
      activeEnvironment: params.environment,
      deploymentUrl,
      runtimeCommand,
      runtimePort,
      installCommandUsed: params.installCommandUsed,
      buildCommandUsed: params.buildCommandUsed,
      buildRoot: params.buildRoot,
      outputDirectory: params.outputDirectory,
      commitHash: params.commitHash,
      commitMessage: params.commitMessage,
      failureReason: null,
      completedAt: new Date(),
    })
    .where(eq(deploymentsTable.id, params.deploymentId));

  return { deploymentUrl, runtimePort, runtimeCommand };
}

export async function promoteArtifactToDeployment(params: {
  deploymentId: string;
  sourceDeploymentId: string;
  projectId: string;
  environment: string;
  branch: string | null;
}) {
  const [source] = await db
    .select()
    .from(deploymentsTable)
    .where(eq(deploymentsTable.id, params.sourceDeploymentId));

  if (!source?.artifactPath || !source.runtimeKind) {
    throw new Error("Source deployment does not have a reusable artifact");
  }

  await db
    .update(deploymentsTable)
    .set({
      status: "deploying",
      runtimeKind: source.runtimeKind,
      artifactPath: source.artifactPath,
      buildRoot: source.buildRoot,
      outputDirectory: source.outputDirectory,
      installCommandUsed: source.installCommandUsed,
      buildCommandUsed: source.buildCommandUsed,
      sourceDeploymentId: params.sourceDeploymentId,
      executionMode: "real",
      simulated: false,
    })
    .where(eq(deploymentsTable.id, params.deploymentId));

  if (source.runtimeKind === "node-api") {
    await activateNodeDeployment({
      deploymentId: params.deploymentId,
      projectId: params.projectId,
      environment: params.environment,
      branch: params.branch,
      artifactPath: source.artifactPath,
      installCommandUsed: source.installCommandUsed,
      buildCommandUsed: source.buildCommandUsed,
      buildRoot: source.buildRoot,
      outputDirectory: source.outputDirectory,
      commitHash: source.commitHash,
      commitMessage: source.commitMessage,
    });
    return;
  }

  await activateStaticDeployment({
    deploymentId: params.deploymentId,
    projectId: params.projectId,
    environment: params.environment,
    branch: params.branch,
    artifactPath: source.artifactPath,
    installCommandUsed: source.installCommandUsed,
    buildCommandUsed: source.buildCommandUsed,
    buildRoot: source.buildRoot,
    outputDirectory: source.outputDirectory,
    commitHash: source.commitHash,
    commitMessage: source.commitMessage,
  });
}

export async function resumeActiveNodeDeployments() {
  const activeDeployments = await db
    .select()
    .from(deploymentsTable)
    .where(
      and(
        eq(deploymentsTable.isCurrent, true),
        eq(deploymentsTable.runtimeKind, "node-api"),
        eq(deploymentsTable.executionMode, "real"),
        eq(deploymentsTable.status, "ready"),
      ),
    );

  for (const deployment of activeDeployments) {
    if (!deployment.artifactPath || runtimeRegistry.has(deployment.id)) continue;
    const artifactStats = await stat(deployment.artifactPath).catch(() => null);
    if (!artifactStats?.isDirectory()) continue;

    const runtimeCommand =
      deployment.runtimeCommand ?? (await detectNodeStartCommand(deployment.artifactPath));
    const runtimePort = deployment.runtimePort ?? allocatePort(deployment.id);
    const handle = workerManager.start({
      deploymentId: deployment.id,
      command: runtimeCommand,
      cwd: deployment.artifactPath,
      env: {
        NODE_ENV: "production",
        PORT: String(runtimePort),
      },
      onStdout: (message) => {
        void insertRuntimeLog(deployment.id, `[runtime] ${message}`, "info");
      },
      onStderr: (message) => {
        void insertRuntimeLog(deployment.id, `[runtime] ${message}`, "error");
      },
      onExit: (code) => {
        runtimeRegistry.delete(deployment.id);
        void db
          .update(deploymentsTable)
          .set({
            isCurrent: false,
            activeEnvironment: null,
            status: "failed",
            failureReason: `Runtime exited with code ${code ?? "unknown"}`,
          })
          .where(eq(deploymentsTable.id, deployment.id));
      },
    });

    runtimeRegistry.set(deployment.id, {
      ...handle,
      projectId: deployment.projectId,
      environment: deployment.environment,
      branch: deployment.branch,
      port: runtimePort,
    });
  }
}

async function resolveStaticPath(artifactPath: string, requestPath: string, outputDirectory?: string | null) {
  const artifactRoot = outputDirectory ? join(artifactPath, outputDirectory) : artifactPath;
  const requested = requestPath.replace(/^\/+/, "");
  const resolvedPath = resolve(artifactRoot, requested || "index.html");

  if (!resolvedPath.startsWith(resolve(artifactRoot))) {
    return null;
  }

  const fileStats = await stat(resolvedPath).catch(() => null);
  if (fileStats?.isFile()) {
    return resolvedPath;
  }

  const fallback = join(artifactRoot, "index.html");
  const fallbackStats = await stat(fallback).catch(() => null);
  if (fallbackStats?.isFile()) {
    return fallback;
  }

  return null;
}

export async function getStaticArtifactPath(deploymentId: string): Promise<{
  artifactPath: string;
  outputDirectory: string | null;
} | null> {
  const [deployment] = await db
    .select({
      artifactPath: deploymentsTable.artifactPath,
      runtimeKind: deploymentsTable.runtimeKind,
      outputDirectory: deploymentsTable.outputDirectory,
    })
    .from(deploymentsTable)
    .where(eq(deploymentsTable.id, deploymentId));

  if (!deployment?.artifactPath || deployment.runtimeKind !== "static") return null;
  return {
    artifactPath: deployment.artifactPath,
    outputDirectory: deployment.outputDirectory,
  };
}

export async function getRuntimePort(deploymentId: string): Promise<number | null> {
  const [deployment] = await db
    .select({ runtimePort: deploymentsTable.runtimePort, runtimeKind: deploymentsTable.runtimeKind })
    .from(deploymentsTable)
    .where(eq(deploymentsTable.id, deploymentId));

  if (!deployment?.runtimePort || deployment.runtimeKind !== "node-api") return null;
  return deployment.runtimePort;
}

export async function resolveActiveDeployment(projectId: string, environment: string, branch: string | null = null) {
  const conditions = [
    eq(deploymentsTable.projectId, projectId),
    eq(deploymentsTable.environment, environment),
    eq(deploymentsTable.isCurrent, true),
  ];

  if (environment !== "production") {
    conditions.push(branch === null ? isNull(deploymentsTable.branch) : eq(deploymentsTable.branch, branch));
  }

  const [deployment] = await db
    .select()
    .from(deploymentsTable)
    .where(and(...conditions));

  return deployment ?? null;
}

export async function serveStaticArtifact(
  deploymentId: string,
  requestPath: string,
  res: ServerResponse,
) {
  const artifact = await getStaticArtifactPath(deploymentId);
  if (!artifact) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Static artifact not found");
    return;
  }

  const filePath = await resolveStaticPath(artifact.artifactPath, requestPath, artifact.outputDirectory);
  if (!filePath) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Artifact file not found");
    return;
  }

  const fileContent = await readFile(filePath);
  res.writeHead(200);
  res.end(fileContent);
}

export function proxyRuntimeRequest(
  port: number,
  req: IncomingMessage,
  res: ServerResponse,
) {
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${port}`,
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }
    res.end(`Runtime unavailable on port ${port}: ${error.message}`);
  });

  req.pipe(upstream);
}
