import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Download, Package, Hammer, Zap, Search, Upload } from "lucide-react";

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground">Unknown</Badge>;

  switch (status.toLowerCase()) {
    case "ready":
    case "deployed":
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
        </Badge>
      );
    case "building":
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium">
          <Hammer className="w-3 h-3 mr-1 animate-pulse" /> Building
        </Badge>
      );
    case "installing":
      return (
        <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20 font-medium">
          <Package className="w-3 h-3 mr-1 animate-pulse" /> Installing
        </Badge>
      );
    case "detecting":
      return (
        <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 font-medium">
          <Search className="w-3 h-3 mr-1 animate-pulse" /> Detecting
        </Badge>
      );
    case "uploading":
      return (
        <Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/20 font-medium">
          <Upload className="w-3 h-3 mr-1 animate-pulse" /> Uploading
        </Badge>
      );
    case "cloning":
      return (
        <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-medium">
          <Download className="w-3 h-3 mr-1 animate-pulse" /> Cloning
        </Badge>
      );
    case "preparing":
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-medium">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Preparing
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 font-medium">
          <Clock className="w-3 h-3 mr-1" /> Queued
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 font-medium">
          <XCircle className="w-3 h-3 mr-1" /> Failed
        </Badge>
      );
    case "active":
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">
          <Zap className="w-3 h-3 mr-1" /> Active
        </Badge>
      );
    default:
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
}
