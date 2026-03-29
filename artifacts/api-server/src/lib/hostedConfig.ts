import { parseEncryptionKey } from "./secrets.js";
import { IS_FALLBACK } from "./runtimeMode.ts";

type EnvRequirement = {
  names: string[];
  label: string;
};

const REQUIRED_HOSTED_ENV: readonly EnvRequirement[] = [
  { label: "APP_URL", names: ["APP_URL"] },
  { label: "SECRET_ENCRYPTION_KEY", names: ["SECRET_ENCRYPTION_KEY"] },
  { label: "AUTH0_DOMAIN", names: ["OIDC_ISSUER_URL", "AUTH0_DOMAIN"] },
  { label: "AUTH0_CLIENT_ID", names: ["OIDC_CLIENT_ID", "AUTH0_CLIENT_ID"] },
  { label: "AUTH0_CLIENT_SECRET", names: ["OIDC_CLIENT_SECRET", "AUTH0_CLIENT_SECRET"] },
  { label: "GITHUB_CLIENT_ID", names: ["GITHUB_CLIENT_ID"] },
  { label: "GITHUB_CLIENT_SECRET", names: ["GITHUB_CLIENT_SECRET"] },
] as const;

function isProductionRuntime(): boolean {
  return (
    process.env["NODE_ENV"] === "production" ||
    Boolean(process.env["RENDER"]) ||
    Boolean(process.env["RENDER_EXTERNAL_URL"])
  );
}

function hasAnyEnvValue(names: readonly string[]): boolean {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

function formatRequirement(requirement: EnvRequirement): string {
  return requirement.names.length === 1
    ? requirement.names[0]
    : `${requirement.names.join(" or ")}`;
}

export function validateHostedConfiguration(): void {
  if (IS_FALLBACK) {
    return;
  }

  const issues: string[] = [];

  for (const requirement of REQUIRED_HOSTED_ENV) {
    if (!hasAnyEnvValue(requirement.names)) {
      issues.push(`Missing ${formatRequirement(requirement)}`);
    }
  }

  const appUrl = process.env["APP_URL"]?.trim();
  if (appUrl) {
    try {
      new URL(appUrl);
    } catch {
      issues.push(`APP_URL must be a valid absolute URL (received "${appUrl}")`);
    }
  }

  const secretKey = process.env["SECRET_ENCRYPTION_KEY"]?.trim();
  if (secretKey) {
    try {
      parseEncryptionKey(secretKey);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (issues.length === 0) {
    return;
  }

  const message = `[config] Hosted configuration issues:\n- ${issues.join("\n- ")}`;
  if (isProductionRuntime()) {
    throw new Error(message);
  }

  console.warn(message);
}
