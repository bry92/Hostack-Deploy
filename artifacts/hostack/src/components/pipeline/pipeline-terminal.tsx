import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PipelineLog } from "@/lib/pipeline";
import { LOG_TYPE_COLORS } from "@/lib/pipeline/constants";
import { cn } from "@/lib/utils";

interface PipelineTerminalProps {
  logs: PipelineLog[];
  isRunning?: boolean;
}

/**
 * Terminal-style UI component
 * Displays deployment logs with real-time streaming
 * 
 * Features:
 * - Monospace font for authentic terminal feel
 * - Color-coded logs by type (thinking, action, success, error)
 * - Auto-scrolls to latest log
 * - Maintains scroll position when user manually scrolls up
 */
export function PipelineTerminal({ logs, isRunning }: PipelineTerminalProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // Auto-scroll to latest log
  useEffect(() => {
    if (shouldAutoScroll.current && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Handle manual scroll
  const handleScroll = (event: Event) => {
    const target = event.target as HTMLDivElement;
    if (!target) return;

    const { scrollHeight, clientHeight, scrollTop } = target;
    // User scrolled up if they're not at the bottom
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-black/80 backdrop-blur-sm overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-zinc-400 font-medium">Deployment Pipeline</span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        )}
      </div>

      {/* Terminal Content */}
      <ScrollArea
        ref={scrollAreaRef}
        className="h-96 w-full"
        onScroll={handleScroll}
      >
        <div className="p-4 font-mono text-sm space-y-1 text-zinc-300">
          {logs.length === 0 ? (
            <div className="text-zinc-600 py-8 text-center">
              Waiting for pipeline to start...
            </div>
          ) : (
            logs.map((log) => {
              const colorConfig = LOG_TYPE_COLORS[log.type];
              const timestamp = new Date(log.timestamp).toLocaleTimeString();

              return (
                <div
                  key={log.id}
                  className={cn(
                    "pl-3 py-1 rounded transition-colors",
                    colorConfig?.bg || "bg-transparent"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-600 flex-shrink-0">{timestamp}</span>
                    <span className={cn("flex-shrink-0 font-bold", colorConfig?.text)}>
                      [{log.stage}]
                    </span>
                    <span className={cn("break-words", colorConfig?.text)}>
                      {log.message}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </ScrollArea>

      {/* Terminal Footer - Log Stats */}
      {logs.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/50 text-xs text-zinc-400 flex justify-between">
          <span>Total logs: {logs.length}</span>
          <span>
            Errors: {logs.filter((l) => l.type === "error").length} | Success:{" "}
            {logs.filter((l) => l.type === "success").length}
          </span>
        </div>
      )}
    </div>
  );
}
