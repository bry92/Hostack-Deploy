import { CheckCircle2, Circle, AlertCircle, Clock } from "lucide-react";
import type { PipelineStage, StageState } from "@/lib/pipeline";
import { PIPELINE_STAGES } from "@/lib/pipeline/constants";
import { cn } from "@/lib/utils";

interface PipelineStageIndicatorProps {
  stages: Record<PipelineStage, StageState>;
}

/**
 * Horizontal stage indicator
 * Shows pipeline stages with status (pending, running, success, error)
 * 
 * Visual flow:
 * [Prepare] → [Install] → [Build] → [Package] → [Deploy] → [Verify]
 */
export function PipelineStageIndicator({ stages }: PipelineStageIndicatorProps) {
  const getStageIcon = (stage: PipelineStage) => {
    const stageState = stages[stage];
    const iconProps = "w-5 h-5";

    switch (stageState.status) {
      case "success":
        return <CheckCircle2 className={cn(iconProps, "text-emerald-500")} />;
      case "running":
        return (
          <Circle className={cn(iconProps, "text-blue-500 animate-pulse")} fill="currentColor" />
        );
      case "error":
        return <AlertCircle className={cn(iconProps, "text-red-500")} />;
      default:
        return <Clock className={cn(iconProps, "text-zinc-600")} />;
    }
  };

  const getStageLabel = (stage: PipelineStage): string => {
    return stage.charAt(0).toUpperCase() + stage.slice(1);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-200">Pipeline Stages</h3>

      {/* Stage Flow */}
      <div className="flex items-center justify-between gap-2 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
        {PIPELINE_STAGES.map((stage, index) => (
          <div key={stage} className="flex items-center flex-1">
            {/* Stage Box */}
            <div
              className={cn(
                "flex flex-col items-center gap-2 flex-1",
                stages[stage].status === "error" && "opacity-60"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-lg border transition-all",
                  stages[stage].status === "success" && "border-emerald-500 bg-emerald-500/10",
                  stages[stage].status === "running" && "border-blue-500 bg-blue-500/10",
                  stages[stage].status === "error" && "border-red-500 bg-red-500/10",
                  stages[stage].status === "pending" && "border-zinc-700 bg-zinc-900"
                )}
              >
                {getStageIcon(stage)}
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-zinc-300">
                  {getStageLabel(stage)}
                </div>
                {stages[stage].durationMs && (
                  <div className="text-xs text-zinc-500">
                    {Math.round(stages[stage].durationMs! / 1000)}s
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            {index < PIPELINE_STAGES.length - 1 && (
              <div className="flex-1 flex items-center justify-center px-2">
                <div className="flex-1 h-0.5 bg-zinc-700" />
                <div className="text-zinc-600 text-xs mx-1">→</div>
                <div className="flex-1 h-0.5 bg-zinc-700" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stage Summary */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 p-2 rounded border border-zinc-800 bg-zinc-900/30">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-zinc-400">
            Completed:{" "}
            <span className="text-zinc-200 font-semibold">
              {Object.values(stages).filter((s) => s.status === "success").length}/6
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded border border-zinc-800 bg-zinc-900/30">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-zinc-400">
            Errors:{" "}
            <span className="text-zinc-200 font-semibold">
              {Object.values(stages).filter((s) => s.status === "error").length}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
