import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  {
    title: "Account and auth data",
    body: "Hostack stores the minimum account information required to identify authenticated users and associate projects, deployments, and integrations with the right owner.",
  },
  {
    title: "Repository and integration data",
    body: "When you connect GitHub, Hostack stores integration metadata and tokens needed to read repository information and perform deployment-related actions.",
  },
  {
    title: "Deployment logs and operational records",
    body: "Build logs, deployment states, queued jobs, and runtime metadata are kept so the platform can execute, debug, and audit deployments.",
  },
  {
    title: "No claim of final legal completeness",
    body: "This page reflects the current product behavior and operating intent. It is a product-facing privacy page, not a finished legal policy drafted by counsel.",
  },
];

export default function Privacy() {
  return (
    <PublicPageShell
      eyebrow="Privacy"
      title="What Hostack stores, and why."
      description="Hostack is built around deployment operations, so the data model is mostly about identities, repos, builds, logs, and environment-level configuration."
    >
      <div className="grid gap-6">
        {SECTIONS.map((section) => (
          <Card key={section.title} className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-white">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {section.body}
            </CardContent>
          </Card>
        ))}
      </div>
    </PublicPageShell>
  );
}
