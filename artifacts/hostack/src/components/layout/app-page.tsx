import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-8", className)}>{children}</div>;
}

export function AppPageHeader({
  actions,
  description,
  eyebrow,
  icon,
  title,
}: {
  actions?: ReactNode;
  description: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 dark:border-zinc-800">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            {icon ? (
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm md:flex dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {title}
              </h1>
              <div className="mt-1.5 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {description}
              </div>
            </div>
          </div>
        </div>

        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function AppPageSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("flex flex-col gap-4", className)}>{children}</section>;
}
