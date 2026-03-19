import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { resolveRuntimeMode } from "../../lib/runtime-mode/src/index.ts";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const defaultAppUrl = "http://localhost:3000";

function loadEnvFile(filePath: string, override = false) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key) continue;
    if (!override && process.env[key] != null) continue;

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function getConfiguredAppUrl() {
  return (process.env.APP_URL ?? defaultAppUrl).replace(/\/+$/, "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canReach(url: string) {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json, text/html;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function assertOk(
  name: string,
  url: string,
  validate?: (body: string, res: Response) => void,
) {
  const res = await fetch(url, {
    headers: { accept: "application/json, text/html;q=0.9,*/*;q=0.8" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`${name} failed: ${res.status} ${res.statusText}`);
  }

  const body = await res.text();
  validate?.(body, res);
  console.log(`[smoke] ${name}: ok`);
}

interface ManagedDev {
  child: ChildProcess;
  getAppUrl: () => string;
  getExitMessage: () => string | null;
}

function startManagedDev(): ManagedDev {
  let resolvedAppUrl = getConfiguredAppUrl();
  let exitMessage: string | null = null;
  let stdoutBuffer = "";
  let stderrBuffer = "";

  const child = process.platform === "win32"
    ? spawn("cmd.exe", ["/c", "pnpm dev"], {
        cwd: repoRoot,
        env: {
          ...process.env,
          HOSTACK_RUNTIME_MODE: process.env.HOSTACK_RUNTIME_MODE ?? "auto",
        },
      })
    : spawn("pnpm dev", {
        cwd: repoRoot,
        env: {
          ...process.env,
          HOSTACK_RUNTIME_MODE: process.env.HOSTACK_RUNTIME_MODE ?? "auto",
        },
        shell: true,
      });

  const drainOutput = (chunk: string, fromError = false) => {
    const buffer = `${fromError ? stderrBuffer : stdoutBuffer}${chunk}`;
    const lines = buffer.split(/\r?\n/u);
    const remainder = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      console.log(`[smoke:dev] ${line}`);

      const match = line.match(/^\[dev\] public origin: (.+)$/u);
      if (match?.[1]) {
        resolvedAppUrl = match[1].trim().replace(/\/+$/, "");
      }
    }

    if (fromError) {
      stderrBuffer = remainder;
    } else {
      stdoutBuffer = remainder;
    }
  };

  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => drainOutput(chunk));
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => drainOutput(chunk, true));
  child.on("exit", (code, signal) => {
    exitMessage = `dev exited with ${signal ?? code ?? "unknown status"}`;
  });

  return {
    child,
    getAppUrl: () => resolvedAppUrl,
    getExitMessage: () => exitMessage,
  };
}

async function waitForManagedDev(managedDev: ManagedDev, timeoutMs: number) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const currentAppUrl = managedDev.getAppUrl();
    if (
      await canReach(currentAppUrl) &&
      await canReach(`${currentAppUrl}/api/auth/user`) &&
      await canReach(`${currentAppUrl}/api/health`)
    ) {
      return currentAppUrl;
    }

    const exitMessage = managedDev.getExitMessage();
    if (exitMessage) {
      throw new Error(exitMessage);
    }

    await sleep(1000);
  }

  throw new Error("Timed out waiting for pnpm dev to become ready");
}

async function main() {
  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(repoRoot, ".env.local"), true);
  const configuredRuntimeMode = resolveRuntimeMode(process.env);

  let appUrl = getConfiguredAppUrl();
  let managedDev: ManagedDev | null = null;

  try {
    console.log(`[smoke] probing ${appUrl}`);
    console.log(`[smoke] configured runtime mode: ${configuredRuntimeMode}`);

    if (!(await canReach(`${appUrl}/api/auth/user`))) {
      console.log("[smoke] app not running, starting pnpm dev");
      managedDev = startManagedDev();
      appUrl = await waitForManagedDev(managedDev, 90000);
      console.log(`[smoke] using managed dev server at ${appUrl}`);
    }

    await assertOk("health", `${appUrl}/api/health`, (_body, res) => {
      const runtimeMode = res.headers.get("x-hostack-runtime-mode");
      if (runtimeMode) {
        console.log(`[smoke] runtime mode: ${runtimeMode}`);
      }
    });

    await assertOk("frontend", appUrl, (body) => {
      if (!body.includes("id=\"root\"")) {
        throw new Error("frontend response did not contain the root app shell");
      }
    });

    await assertOk("auth user", `${appUrl}/api/auth/user`, (body, res) => {
      const parsed = JSON.parse(body) as { isAuthenticated?: boolean; mode?: string };
      if (typeof parsed.isAuthenticated !== "boolean") {
        throw new Error("/api/auth/user response did not contain isAuthenticated");
      }

      const runtimeMode = res.headers.get("x-hostack-runtime-mode") ?? parsed.mode;
      if (runtimeMode === "fallback") {
        console.log("[smoke] fallback mode detected");
      }
    });
  } finally {
    managedDev?.child.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(`[smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
