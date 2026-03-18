import app from "./app";
import { schedulePreviewCleanup } from "./services/previewCleanup.js";
import { resumeActiveNodeDeployments } from "./services/deploymentRuntime.js";

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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  schedulePreviewCleanup();
  resumeActiveNodeDeployments().catch((error) => {
    console.error("Failed to resume active deployment runtimes", error);
  });
});
