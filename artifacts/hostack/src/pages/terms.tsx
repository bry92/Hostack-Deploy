import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TERMS = [
  {
    title: "Beta service",
    body: "Hostack is still evolving. Features, execution paths, and deployment behavior may change as the platform hardens.",
  },
  {
    title: "Your repos and environments",
    body: "You are responsible for the code, configuration, secrets, and external services connected to your Hostack projects.",
  },
  {
    title: "Operational limits",
    body: "Hostack may restrict abusive, unsafe, or clearly destabilizing workloads in order to protect the system and other users.",
  },
  {
    title: "Rollback and deployment history",
    body: "Deployment records and logs are part of the service history. They may be retained as part of platform operation and auditability.",
  },
];

export default function Terms() {
  return (
    <PublicPageShell
      eyebrow="Terms"
      title="Plain-language operating terms for the current product."
      description="These terms describe how the current Hostack service is intended to be used while the platform moves from working prototype to production-grade system."
    >
      <div className="grid gap-6">
        {TERMS.map((term) => (
          <Card key={term.title} className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-white">{term.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {term.body}
            </CardContent>
          </Card>
        ))}
      </div>
    </PublicPageShell>
  );
}
