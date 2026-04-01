import type { ReactNode } from "react";
import { Redirect, Link, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@workspace/auth-web";
import { AppSidebar, mobileNavItems } from "./app-sidebar";

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppSidebar />

      <div className="flex min-h-screen flex-col md:ml-64">
        <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden">
          <div className="flex h-14 items-center px-4">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-white">
              Hostack
            </Link>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
            {mobileNavItems.map((item) => {
              const active = location === item.url || location.startsWith(`${item.url}/`);
              return (
                <Link
                  key={item.url}
                  href={item.url}
                  className={[
                    "whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-zinc-800 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-4 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
