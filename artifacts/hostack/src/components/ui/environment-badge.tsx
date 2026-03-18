import { Badge } from "@/components/ui/badge";

export function EnvironmentBadge({ environment }: { environment?: string | null }) {
  if (!environment) return null;

  if (environment === "production") {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium text-xs">
        Production
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium text-xs">
      Preview
    </Badge>
  );
}
