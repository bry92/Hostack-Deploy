import { Badge } from "@/components/ui/badge";

export function EnvironmentBadge({ environment }: { environment?: string | null }) {
  if (!environment) return null;

  if (environment === "production") {
    return (
      <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
        Production
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-violet-500/20 bg-violet-500/10 text-violet-300">
      Preview
    </Badge>
  );
}
