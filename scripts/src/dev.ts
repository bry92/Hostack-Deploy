import http, { type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";

const publicPort = Number(process.env.APP_PORT ?? "3000");
const apiPort = Number(process.env.API_PORT ?? "3001");
const frontendPort = Number(process.env.FRONTEND_PORT ?? "5173");
const basePath = process.env.BASE_PATH ?? "/";
const publicOrigin = process.env.APP_URL ?? `http://localhost:${publicPort}`;

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

function getTargetPort(url: string | undefined) {
  return url?.startsWith("/api") ? apiPort : frontendPort;
}

let shuttingDown = false;
const children: ChildProcess[] = [];

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 250);
}

children.push(
  spawnService("api", "pnpm --filter @workspace/api-server dev", {
    AI_INTEGRATIONS_OPENAI_API_KEY:
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dev-placeholder-key",
    NODE_ENV: "development",
    PORT: String(apiPort),
    APP_URL: publicOrigin,
  }),
);

children.push(
  spawnService(
    "frontend",
    `pnpm --filter @workspace/hostack exec vite --config vite.config.ts --host 0.0.0.0 --port ${frontendPort} --strictPort`,
    {
      NODE_ENV: "development",
      PORT: String(frontendPort),
      BASE_PATH: basePath,
    },
  ),
);

const server = http.createServer((req, res) => {
  proxyHttpRequest(req, res, getTargetPort(req.url));
});

server.on("upgrade", (req, socket, head) => {
  proxyUpgrade(req, socket as net.Socket, head, getTargetPort(req.url));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => shutdown(0));
}

server.listen(publicPort, () => {
  console.log(`[dev] public origin: ${publicOrigin}`);
  console.log(`[dev] frontend upstream: http://127.0.0.1:${frontendPort}`);
  console.log(`[dev] api upstream: http://127.0.0.1:${apiPort}`);
});
