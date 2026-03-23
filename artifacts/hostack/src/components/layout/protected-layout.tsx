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
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500 dark:text-zinc-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <AppSidebar />

      <div className="flex min-h-screen flex-col md:ml-64">
        <header className="sticky top-0 z-20 border-b border-zinc-300/70 bg-zinc-100/94 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/92">
          <div className="flex h-14 items-center px-4">
            <Link href="/dashboard" className="font-semibold tracking-tight">
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
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-zinc-800 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                      : "bg-zinc-200/60 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-8 md:py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
