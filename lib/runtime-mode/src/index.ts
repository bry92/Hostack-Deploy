export type RuntimeMode = "full" | "fallback";
export type RequestedRuntimeMode = RuntimeMode | "auto";

const FALLBACK_MARKER = "dev-fallback";

function normalizeRequestedRuntimeMode(
  value: string | undefined,
): RequestedRuntimeMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "full" || normalized === "fallback" || normalized === "auto") {
    return normalized;
  }
  return "auto";
}

function containsFallbackMarker(value: string | undefined) {
  return value?.toLowerCase().includes(FALLBACK_MARKER) ?? false;
}

export function resolveRuntimeMode(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeMode {
  const requestedMode = normalizeRequestedRuntimeMode(env.HOSTACK_RUNTIME_MODE);

  if (requestedMode === "full" || requestedMode === "fallback") {
    return requestedMode;
  }

  if (
    containsFallbackMarker(env.DATABASE_URL) ||
    containsFallbackMarker(env.AUTH0_DOMAIN) ||
    containsFallbackMarker(env.OIDC_ISSUER_URL)
  ) {
    return "fallback";
  }

  return "full";
}

export const RUNTIME_MODE = resolveRuntimeMode();
export const IS_FALLBACK = RUNTIME_MODE === "fallback";
