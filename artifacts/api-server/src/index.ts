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

async function main() {
  validateHostedConfiguration();
  const { app, runtime } = await createApp();

  let startBackgroundServices:
    | (() => void)
    | undefined;

  if (runtime.mode === "full") {
    const [{ schedulePreviewCleanup }, { resumeActiveNodeDeployments }] = await Promise.all([
      import("./services/previewCleanup.js"),
      import("./services/deploymentRuntime.js"),
    ]);

    startBackgroundServices = () => {
      schedulePreviewCleanup();
      resumeActiveNodeDeployments().catch((error) => {
        console.error("Failed to resume active deployment runtimes", error);
      });
    };
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port} (${runtime.mode} mode)`);
    startBackgroundServices?.();
  });
}

main().catch((error) => {
  console.error(
    `Failed to start API server: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
