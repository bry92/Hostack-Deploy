import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
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

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/user", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const runtimeHeader = res.headers.get("x-hostack-runtime-mode");
        return res.json().then((body) => ({
          runtimeMode: runtimeHeader === "full" || runtimeHeader === "fallback"
            ? runtimeHeader
            : body.mode === "full" || body.mode === "fallback"
            ? body.mode
            : null,
          user: body.user as AuthUser | null,
        }));
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setRuntimeMode(data.runtimeMode);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setRuntimeMode(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((returnTo?: string) => {
    const target = returnTo || window.location.pathname || "/";
    window.location.href = `/api/login?returnTo=${encodeURIComponent(target)}`;
  }, []);

  const logout = useCallback(() => {
    window.location.href = "/api/logout";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        runtimeMode,
        isFallbackMode: runtimeMode === "fallback",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
