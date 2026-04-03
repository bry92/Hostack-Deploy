import {
  Auth0Provider,
  type AppState,
} from "@auth0/auth0-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "@workspace/api-client-react";

type RuntimeMode = "full" | "fallback" | null;

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  runtimeMode: RuntimeMode;
  isFallbackMode: boolean;
  login: (returnTo?: string) => void;
  logout: () => void;
}

interface AuthBootstrap {
  runtimeMode: RuntimeMode;
  user: AuthUser | null;
}

interface ViteImportMeta extends ImportMeta {
  readonly env: Record<string, string | undefined>;
}

// Dev-only fallback credentials - should NEVER be used in production
const FALLBACK_AUTH0_DOMAIN = "dev-3koeqweojjm248m1.us.auth0.com";
const FALLBACK_AUTH0_CLIENT_ID = "5efja6URDR5gizWpwRFGuM8mEb7wZiFh";
const viteEnv = (import.meta as ViteImportMeta).env;
const isDevelopment = viteEnv["DEV"] === "true" || viteEnv["MODE"] === "development";
const AUTH0_DOMAIN = viteEnv["VITE_AUTH0_DOMAIN"] || (isDevelopment ? FALLBACK_AUTH0_DOMAIN : throwError("VITE_AUTH0_DOMAIN"));
const AUTH0_CLIENT_ID = viteEnv["VITE_AUTH0_CLIENT_ID"] || (isDevelopment ? FALLBACK_AUTH0_CLIENT_ID : throwError("VITE_AUTH0_CLIENT_ID"));

function throwError(varName: string): never {
  throw new Error(`Critical environment variable not set: ${varName}. This is required for production Auth0 configuration.`);
}

const AuthContext = createContext<AuthState | null>(null);

function getRuntimeMode(value: unknown): RuntimeMode {
  return value === "full" || value === "fallback" ? value : null;
}

function getSafeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function getBrowserOrigin(): string | null {
  return typeof window === "undefined" ? null : window.location.origin;
}

function BasicAuthProvider({
  children,
  state,
}: {
  children: ReactNode;
  state: AuthState;
}) {
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

function Auth0Bridge({
  children,
  runtimeMode,
  login,
  logout,
}: {
  children: ReactNode;
  runtimeMode: RuntimeMode;
  login: (returnTo?: string) => void;
  logout: () => void;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/user", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setUser((data.user ?? null) as AuthUser | null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load current auth user", error);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: loading,
        isAuthenticated: !!user,
        runtimeMode,
        isFallbackMode: false,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [bootstrap, setBootstrap] = useState<AuthBootstrap>({
    runtimeMode: null,
    user: null,
  });
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/user", { credentials: "include" })
      .then(async (res) => {
        const runtimeHeader = getRuntimeMode(res.headers.get("x-hostack-runtime-mode"));
        const body = await res.json().catch(() => ({}));

        return {
          runtimeMode: runtimeHeader ?? getRuntimeMode(body.mode),
          user: (body.user ?? null) as AuthUser | null,
        };
      })
      .then((nextBootstrap) => {
        if (!cancelled) {
          setBootstrap(nextBootstrap);
          setIsBootstrapping(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBootstrap({ runtimeMode: null, user: null });
          setIsBootstrapping(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((returnTo?: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const target = getSafeReturnTo(returnTo || window.location.pathname || "/");
    window.location.href = `/api/login?returnTo=${encodeURIComponent(target)}`;
  }, []);

  const logout = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.location.href = "/api/logout";
  }, []);

  if (isBootstrapping) {
    return (
      <BasicAuthProvider
        state={{
          user: null,
          isLoading: true,
          isAuthenticated: false,
          runtimeMode: null,
          isFallbackMode: false,
          login,
          logout,
        }}
      >
        {children}
      </BasicAuthProvider>
    );
  }

  if (bootstrap.runtimeMode !== "full") {
    return (
      <BasicAuthProvider
        state={{
          user: bootstrap.user,
          isLoading: false,
          isAuthenticated: !!bootstrap.user,
          runtimeMode: bootstrap.runtimeMode,
          isFallbackMode: bootstrap.runtimeMode === "fallback",
          login,
          logout,
        }}
      >
        {children}
      </BasicAuthProvider>
    );
  }

  const browserOrigin = getBrowserOrigin();
  const redirectUri = browserOrigin ? `${browserOrigin}/api/callback` : null;

  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !redirectUri) {
    return (
      <BasicAuthProvider
        state={{
          user: bootstrap.user,
          isLoading: false,
          isAuthenticated: !!bootstrap.user,
          runtimeMode: bootstrap.runtimeMode,
          isFallbackMode: false,
          login,
          logout,
        }}
      >
        {children}
      </BasicAuthProvider>
    );
  }

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: redirectUri }}
      onRedirectCallback={(appState?: AppState) => {
        if (typeof window === "undefined") {
          return;
        }

        const target = getSafeReturnTo(
          typeof appState?.returnTo === "string" ? appState.returnTo : window.location.pathname,
        );

        window.history.replaceState({}, document.title, target);
      }}
    >
      <Auth0Bridge
        runtimeMode={bootstrap.runtimeMode}
        login={login}
        logout={logout}
      >
        {children}
      </Auth0Bridge>
    </Auth0Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
