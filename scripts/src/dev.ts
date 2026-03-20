import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { resolveRuntimeMode } from "../../lib/runtime-mode/src/index.ts";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const FALLBACK_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://dev-fallback:dev-fallback@127.0.0.1:5432/hostack",
  SECRET_ENCRYPTION_KEY: "dev-fallback-secret-key",
  AUTH0_DOMAIN: "dev-fallback.auth0.local",
  AUTH0_CLIENT_ID: "dev-fallback-client-id",
  AUTH0_CLIENT_SECRET: "dev-fallback-client-secret",
  AUTH0_AUDIENCE: "https://api.hostack.local",
  AUTH0_SCOPE: "openid profile email offline_access",
  AUTH0_PROMPT: "login",
};

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

function parsePort(name: string, fallback: string) {
  const rawValue = process.env[name] ?? fallback;
  const port = Number(rawValue);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid ${name} value: "${rawValue}"`);
  }
  return port;
}

function hasValue(name: string) {
  return Boolean(process.env[name]?.trim());
}

function setEnvIfMissing(name: string, value: string) {
  if (!hasValue(name)) {
    process.env[name] = value;
  }
}

function ensureFallbackDefaults() {
  const requestedMode = process.env.HOSTACK_RUNTIME_MODE?.trim().toLowerCase() ?? "auto";
  if (requestedMode === "full") return;

  if (!hasValue("DATABASE_URL")) {
    process.env.DATABASE_URL = FALLBACK_ENV.DATABASE_URL;
  }

  if (!hasValue("AUTH0_DOMAIN") && !hasValue("OIDC_ISSUER_URL")) {
    process.env.AUTH0_DOMAIN = FALLBACK_ENV.AUTH0_DOMAIN;
  }

  if (!hasValue("AUTH0_CLIENT_ID") && !hasValue("OIDC_CLIENT_ID")) {
    process.env.AUTH0_CLIENT_ID = FALLBACK_ENV.AUTH0_CLIENT_ID;
  }

  if (!hasValue("AUTH0_CLIENT_SECRET") && !hasValue("OIDC_CLIENT_SECRET")) {
    process.env.AUTH0_CLIENT_SECRET = FALLBACK_ENV.AUTH0_CLIENT_SECRET;
  }

  setEnvIfMissing("SECRET_ENCRYPTION_KEY", FALLBACK_ENV.SECRET_ENCRYPTION_KEY);
  setEnvIfMissing("AUTH0_SCOPE", FALLBACK_ENV.AUTH0_SCOPE);
  setEnvIfMissing("AUTH0_PROMPT", FALLBACK_ENV.AUTH0_PROMPT);
}

function applyFallbackEnv(publicOrigin: string) {
  process.env.HOSTACK_RUNTIME_MODE = "fallback";
  process.env.APP_URL = publicOrigin;
  setEnvIfMissing("CORS_ALLOWED_ORIGINS", publicOrigin);

  for (const [name, value] of Object.entries(FALLBACK_ENV)) {
    setEnvIfMissing(name, value);
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", () => {
      resolve(false);
    });
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, "127.0.0.1");
  });
}

async function resolvePort(name: string, preferredPort: number) {
  if (await isPortAvailable(preferredPort)) return preferredPort;

  for (let candidate = preferredPort + 1; candidate < preferredPort + 50; candidate += 1) {
    if (await isPortAvailable(candidate)) {
      console.warn(
        `[dev] ${name} port ${preferredPort} is in use, using ${candidate} instead`,
      );
      return candidate;
    }
  }

  throw new Error(
    `Unable to find a free port for ${name} starting from ${preferredPort}.`,
  );
}

function spawnService(
  name: string,
  command: string,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  const child = process.platform === "win32"
    ? spawn("cmd.exe", ["/c", command], {
        stdio: "inherit",
        env: {
          ...process.env,
          ...env,
        },
      })
    : spawn(command, {
        stdio: "inherit",
        env: {
          ...process.env,
          ...env,
        },
        shell: true,
      });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev:${name}] exited with ${signal ?? code ?? "unknown status"}`);
    shutdown(code ?? 1);
  });

  return child;
}

function proxyHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  targetPort: number,
) {
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${targetPort}`,
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
    res.end(`Upstream unavailable on port ${targetPort}: ${error.message}`);
  });

  req.pipe(upstream);
}

function serveFallbackFrontendShell(
  res: ServerResponse,
  publicOrigin: string,
) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hostack Local Fallback</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        font-family: "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #1f2937, #0f172a 55%);
        color: #e5e7eb;
      }
      .banner {
        max-width: 56rem;
        margin: 3rem auto 0;
        padding: 1rem 1.25rem;
        border: 1px solid rgba(251, 191, 36, 0.25);
        border-radius: 0.75rem;
        background: rgba(251, 191, 36, 0.1);
      }
      .banner code {
        color: #fde68a;
      }
    </style>
  </head>
  <body>
    <div class="banner">
      <strong>Hostack fallback mode is active.</strong>
      API routes are available at <code>${publicOrigin}/api</code>, and the full React frontend will resume automatically once real config and the frontend toolchain are available.
    </div>
    <div id="root"></div>
  </body>
</html>`);
}

function proxyUpgrade(
  req: IncomingMessage,
  socket: net.Socket,
  head: Buffer,
  targetPort: number,
) {
  const upstream = net.connect(targetPort, "127.0.0.1", () => {
    socket.write(
      [
        `GET ${req.url} HTTP/1.1`,
        ...Object.entries(req.headers).map(([key, value]) => {
          const normalized = Array.isArray(value) ? value.join(", ") : value ?? "";
          const headerValue =
            key.toLowerCase() === "host" ? `127.0.0.1:${targetPort}` : normalized;
          return `${key}: ${headerValue}`;
        }),
        "",
        "",
      ].join("\r\n"),
    );

    if (head.length > 0) {
      upstream.write(head);
    }

    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on("error", () => {
    socket.destroy();
  });

  socket.on("error", () => {
    upstream.destroy();
  });
}

function getTargetPort(url: string | undefined, apiPort: number, frontendPort: number) {
  return url?.startsWith("/api") ? apiPort : frontendPort;
}

let shuttingDown = false;
const children: ChildProcess[] = [];
let server: http.Server | null = null;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  server?.close();
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 250);
}

async function main() {
  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(repoRoot, ".env.local"), true);
  ensureFallbackDefaults();
  const requestedPublicPort = parsePort("APP_PORT", "3000");
  const requestedApiPort = parsePort("API_PORT", "3001");
  const requestedFrontendPort = parsePort("FRONTEND_PORT", "5173");
  const basePath = process.env.BASE_PATH ?? "/";
  const requestedMode = process.env.HOSTACK_RUNTIME_MODE?.trim().toLowerCase() ?? "auto";
  const runtimeMode = resolveRuntimeMode(process.env);

  const publicPort = await resolvePort("public", requestedPublicPort);
  const frontendPort = runtimeMode === "fallback"
    ? null
    : await resolvePort("frontend", requestedFrontendPort);
  const publicOrigin = `http://localhost:${publicPort}`;

  process.env.APP_URL = publicOrigin;
  process.env.CORS_ALLOWED_ORIGINS ??= publicOrigin;
  process.env.HOSTACK_RUNTIME_MODE = runtimeMode;

  if (runtimeMode === "fallback") {
    applyFallbackEnv(publicOrigin);
  }

  const apiPort = await resolvePort("api", requestedApiPort);

  process.env.APP_PORT = String(publicPort);
  process.env.API_PORT = String(apiPort);
  if (frontendPort != null) {
    process.env.FRONTEND_PORT = String(frontendPort);
  }

  console.log(`[dev] runtime mode: ${runtimeMode} (requested: ${requestedMode})`);

  const apiCommand = runtimeMode === "fallback"
    ? "pnpm --filter @workspace/api-server fallback-dev"
    : "pnpm --filter @workspace/api-server dev";

  children.push(
    spawnService("api", apiCommand, {
      AI_INTEGRATIONS_OPENAI_API_KEY:
        process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dev-placeholder-key",
      NODE_ENV: "development",
      PORT: String(apiPort),
      APP_URL: publicOrigin,
    }),
  );

  if (runtimeMode !== "fallback") {
    children.push(
      spawnService("worker", "pnpm --filter @workspace/worker dev", {
        NODE_ENV: "development",
      }),
    );
  }

  if (frontendPort != null) {
    children.push(
      spawnService(
        "frontend",
        `pnpm --filter @workspace/hostack dev -- --port ${frontendPort} --strictPort`,
        {
          NODE_ENV: "development",
          PORT: String(frontendPort),
          BASE_PATH: basePath,
        },
      ),
    );
  }

  server = http.createServer((req, res) => {
    if (runtimeMode === "fallback" && !req.url?.startsWith("/api")) {
      serveFallbackFrontendShell(res, publicOrigin);
      return;
    }

    proxyHttpRequest(req, res, getTargetPort(req.url, apiPort, frontendPort!));
  });

  server.on("upgrade", (req, socket, head) => {
    if (runtimeMode === "fallback" && !req.url?.startsWith("/api")) {
      socket.destroy();
      return;
    }

    proxyUpgrade(
      req,
      socket as net.Socket,
      head,
      getTargetPort(req.url, apiPort, frontendPort!),
    );
  });

  server.listen(publicPort, () => {
    console.log(`[dev] public origin: ${publicOrigin}`);
    console.log(
      `[dev] frontend upstream: ${frontendPort == null ? "fallback shell" : `http://127.0.0.1:${frontendPort}`}`,
    );
    console.log(`[dev] api upstream: http://127.0.0.1:${apiPort}`);
    console.log(
      `[dev] worker: ${runtimeMode === "fallback" ? "disabled in fallback mode" : "queue consumer running"}`,
    );
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => shutdown(0));
}

main().catch((error) => {
  console.error(
    `[dev] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  shutdown(1);
});
