import { createApp } from "./app.ts";
import { validateHostedConfiguration } from "./lib/hostedConfig.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]?.trim().toLowerCase();
  if (!rawValue) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(rawValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(rawValue)) {
    return false;
  }

  console.warn(`[config] Invalid ${name} value "${rawValue}", using ${fallback}`);
  return fallback;
}

function shouldRunEmbeddedWorker(): boolean {
  return readBooleanEnv("HOSTACK_RUN_EMBEDDED_WORKER", false);
}

async function main() {
  validateHostedConfiguration();
  const { app, runtime } = await createApp();

  let startBackgroundServices:
    | (() => void)
    | undefined;

  if (runtime.mode === "full") {
    const [{ schedulePreviewCleanup }, { resumeActiveNodeDeployments }, workerModule] = await Promise.all([
      import("./services/previewCleanup.js"),
      import("./services/deploymentRuntime.js"),
      shouldRunEmbeddedWorker()
        ? import("../../worker/src/index.ts")
        : Promise.resolve(null),
    ]);

    startBackgroundServices = () => {
      schedulePreviewCleanup();
      resumeActiveNodeDeployments().catch((error) => {
        console.error("Failed to resume active deployment runtimes", error);
      });

      if (workerModule) {
        const workerId = `embedded-api-worker:${process.pid}`;
        console.log(`[worker] starting embedded worker ${workerId}`);
        workerModule.runWorkerLoop(workerId).catch((error) => {
          console.error("Embedded worker loop stopped unexpectedly", error);
        });
      } else {
        console.warn(
          "[worker] embedded worker disabled; real deployments must execute on the same host that serves deployment artifacts and runtimes.",
        );
      }
    };
  }

  app.listen(port, () => {
    console.log(`[startup] Server listening on port ${port} (${runtime.mode} mode)`);
    if (runtime.mode === "full") {
      console.log("[startup] Full mode: Database-backed features enabled");
      if (!process.env.DATABASE_URL) {
        console.warn("[startup] ⚠️  DATABASE_URL not set - features requiring database will be unavailable");
      }
      if (!process.env.SECRET_ENCRYPTION_KEY) {
        console.warn("[startup] ⚠️  SECRET_ENCRYPTION_KEY not set - secure features will fail");
      }
    } else {
      console.log("[startup] Fallback mode: Limited functionality (development/testing only)");
    }
    startBackgroundServices?.();
  });
}

main().catch((error) => {
  console.error(
    `Failed to start API server: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
