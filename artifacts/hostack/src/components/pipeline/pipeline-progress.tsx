import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface PipelineProgressProps {
  progress: number; // 0-100
  status: "idle" | "running" | "success" | "failed";
}

/**
 * Progress bar and percentage display
 * Shows overall pipeline progress with visual feedback
 */
export function PipelineProgress({ progress, status }: PipelineProgressProps) {
  const getStatusColor = () => {
    switch (status) {
      case "success":
        return "text-emerald-500";
      case "failed":
        return "text-red-500";
      case "running":
        return "text-blue-500";
      default:
        return "text-zinc-400";
    }
  };

  const getProgressBarColor = () => {
    switch (status) {
      case "success":
        return "bg-emerald-500";
      case "failed":
        return "bg-red-500";
      case "running":
        return "bg-blue-500";
      default:
        return "bg-zinc-600";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Pipeline Progress</h3>
        <span className={cn("text-2xl font-bold", getStatusColor())}>
          {Math.min(100, Math.round(progress))}%
        </span>
      </div>

      <div className="relative">
        <Progress 
          value={Math.min(100, progress)} 
          className="h-2 bg-zinc-800"
        />
        {status === "running" && (
          <div className="absolute inset-0 h-2 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full opacity-30 blur-sm animate-pulse",
                getProgressBarColor()
              )}
              style={{
                width: `${Math.min(100, progress)}%`,
              }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          Status:{" "}
          <span className={cn("font-semibold", getStatusColor())}>
            {status === "idle"
              ? "Waiting"
              : status === "running"
                ? "In Progress"
                : status === "success"
                  ? "Complete"
                  : "Failed"}
          </span>
        </span>
        <span>
          {progress > 0 && (
            <>
              {Math.ceil((100 - progress) / (progress / 100))}s remaining
            </>
          )}
        </span>
      </div>
    </div>
  );
}
