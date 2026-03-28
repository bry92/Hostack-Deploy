import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Download, Package, Hammer, Zap, Search, Upload, Rocket } from "lucide-react";

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="border-zinc-800 bg-zinc-900 text-zinc-400">
        Unknown
      </Badge>
    );
  }

  switch (status.toLowerCase()) {
    case "ready":
    case "deployed":
      return (
        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
        </Badge>
      );
    case "building":
      return (
        <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-300">
          <Hammer className="w-3 h-3 mr-1 animate-pulse" /> Building
        </Badge>
      );
    case "installing":
      return (
        <Badge variant="outline" className="border-violet-700/20 bg-violet-500/8 font-medium text-violet-700 dark:text-violet-300">
          <Package className="w-3 h-3 mr-1 animate-pulse" /> Installing
        </Badge>
      );
    case "detecting":
      return (
        <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-300">
          <Search className="w-3 h-3 mr-1 animate-pulse" /> Detecting
        </Badge>
      );
    case "uploading":
      return (
        <Badge variant="outline" className="border-cyan-700/20 bg-cyan-500/8 font-medium text-cyan-700 dark:text-cyan-300">
          <Upload className="w-3 h-3 mr-1 animate-pulse" /> Uploading
        </Badge>
      );
    case "packaging":
      return (
        <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-300">
          <Package className="w-3 h-3 mr-1 animate-pulse" /> Packaging
        </Badge>
      );
    case "deploying":
      return (
        <Badge variant="outline" className="border-indigo-700/20 bg-indigo-500/8 font-medium text-indigo-700 dark:text-indigo-300">
          <Rocket className="w-3 h-3 mr-1 animate-pulse" /> Deploying
        </Badge>
      );
    case "verifying":
      return (
        <Badge variant="outline" className="border-emerald-700/20 bg-emerald-500/8 font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3 mr-1 animate-pulse" /> Verifying
        </Badge>
      );
    case "cloning":
      return (
        <Badge variant="outline" className="border-cyan-700/20 bg-cyan-500/8 font-medium text-cyan-700 dark:text-cyan-300">
          <Download className="w-3 h-3 mr-1 animate-pulse" /> Cloning
        </Badge>
      );
    case "preparing":
      return (
        <Badge variant="outline" className="border-zinc-800 bg-zinc-900 text-zinc-400">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Preparing
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="outline" className="border-zinc-800 bg-zinc-900 text-zinc-400">
          <Clock className="w-3 h-3 mr-1" /> Queued
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="border-red-700/20 bg-red-500/8 font-medium text-red-700 dark:text-red-300">
          <XCircle className="w-3 h-3 mr-1" /> Failed
        </Badge>
      );
    case "active":
      return (
        <Badge variant="outline" className="border-emerald-700/20 bg-emerald-500/8 font-medium text-emerald-700 dark:text-emerald-300">
          <Zap className="w-3 h-3 mr-1" /> Active
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="border-zinc-800 bg-zinc-900 capitalize text-zinc-400">
          {status}
        </Badge>
      );
  }
}
