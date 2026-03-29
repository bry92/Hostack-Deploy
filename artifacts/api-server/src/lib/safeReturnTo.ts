export const ALLOWED_PATHS = new Set([
  "/",
  "/dashboard",
  "/settings",
  "/projects",
]);

function warnBlockedReturnTo(reason: string, input: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`Blocked returnTo (${reason}):`, input);
  }
}

export function createSafeReturnToResolver(canonicalAppUrl: string) {
  const normalizedCanonicalAppUrl = canonicalAppUrl.replace(/\/+$/, "");
  const canonicalAppOrigin = new URL(normalizedCanonicalAppUrl).origin;

  return function getSafeReturnTo(input?: string): string {
    if (!input) {
      return normalizedCanonicalAppUrl;
    }

    try {
      const url = new URL(input, normalizedCanonicalAppUrl);

      if (url.origin !== canonicalAppOrigin) {
        warnBlockedReturnTo("off-origin", input);
        return normalizedCanonicalAppUrl;
      }

      if (!ALLOWED_PATHS.has(url.pathname)) {
        warnBlockedReturnTo("invalid path", input);
        return normalizedCanonicalAppUrl;
      }

      return url.toString();
    } catch {
      warnBlockedReturnTo("invalid URL", input);
      return normalizedCanonicalAppUrl;
    }
  };
}
