import { ExternalLink, CheckCircle2, XCircle, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PipelineResult } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

interface DeploymentResultBlockProps {
  result: PipelineResult;
}

/**
 * Result display block
 * Shows deployment outcome with URL, duration, and actions
 */
export function DeploymentResultBlock({ result }: DeploymentResultBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    if (result.deploymentUrl) {
      navigator.clipboard.writeText(result.deploymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSuccess = result.status === "success";
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <Card
      className={cn(
        "border-2 transition-all",
        isSuccess ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10"
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <span className="text-emerald-500">Deployment Successful</span>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-500" />
                <span className="text-red-500">Deployment Failed</span>
              </>
            )}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-zinc-400">Status</div>
            <div
              className={cn(
                "text-lg font-bold mt-1",
                isSuccess ? "text-emerald-400" : "text-red-400"
              )}
            >
              {isSuccess ? "Live" : "Failed"}
            </div>
          </div>
          <div>
            <div className="text-sm text-zinc-400">Build Time</div>
            <div className="text-lg font-bold text-zinc-200 mt-1">
              {formatTime(result.totalDurationMs)}
            </div>
          </div>
        </div>

        {/* URL Display */}
        {isSuccess && result.deploymentUrl && (
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">Deployment URL</div>
            <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-black/50">
              <span className="flex-1 font-mono text-sm text-emerald-400 break-all">
                {result.deploymentUrl}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyUrl}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="flex-shrink-0"
              >
                <a href={result.deploymentUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {!isSuccess && result.failureReason && (
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">Failure Reason</div>
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5">
              <p className="text-sm text-red-400 font-mono break-words">
                {result.failureReason}
              </p>
            </div>
          </div>
        )}

        {/* Log Count */}
        <div className="pt-2 border-t border-zinc-700 text-xs text-zinc-500">
          Total logs emitted: {result.logs.length}
        </div>
      </CardContent>
    </Card>
  );
}
