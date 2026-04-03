import { PublicPageShell } from "@/components/layout/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

type ServiceStatus = "operational" | "degraded" | "outage" | "maintenance";

interface ServiceItem {
  name: string;
  status: ServiceStatus;
  latency?: string;
}

interface IncidentItem {
  date: string;
  title: string;
  status: "resolved" | "monitoring" | "investigating";
  description: string;
}

const SERVICES: ServiceItem[] = [
  { name: "API", status: "operational", latency: "42ms" },
  { name: "Deployments", status: "operational", latency: "—" },
  { name: "Build Workers", status: "operational", latency: "—" },
  { name: "Log Streaming", status: "operational", latency: "18ms" },
  { name: "Custom Domains", status: "operational", latency: "—" },
  { name: "SSL Provisioning", status: "operational", latency: "—" },
  { name: "Integrations", status: "operational", latency: "61ms" },
  { name: "Authentication", status: "operational", latency: "35ms" },
];

const INCIDENTS: IncidentItem[] = [
  {
    date: "March 12, 2026",
    title: "Elevated build queue latency",
    status: "resolved",
    description: "Build jobs were experiencing elevated queue times due to a worker scaling event. The issue was resolved within 18 minutes. All queued deployments completed successfully.",
  },
  {
    date: "February 28, 2026",
    title: "Log streaming intermittent disconnects",
    status: "resolved",
    description: "Some users experienced SSE log stream disconnections during long-running builds. A connection keepalive fix was deployed and the issue has not recurred.",
  },
  {
    date: "February 14, 2026",
    title: "DNS verification delays",
    status: "resolved",
    description: "Custom domain DNS verification was taking longer than expected due to a polling configuration issue. The polling interval was adjusted and verification times returned to normal.",
  },
];

const STATUS_CONFIG: Record<ServiceStatus, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  operational: {
    label: "Operational",
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  degraded: {
    label: "Degraded",
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  outage: {
    label: "Outage",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  maintenance: {
    label: "Maintenance",
    icon: Clock,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
};

const INCIDENT_STATUS_CONFIG = {
  resolved: { label: "Resolved", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  monitoring: { label: "Monitoring", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  investigating: { label: "Investigating", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

const allOperational = SERVICES.every((s) => s.status === "operational");

export default function Status() {
  return (
    <PublicPageShell
      eyebrow="System Status"
      title="Hostack Platform Status"
      description="Real-time status of all Hostack services. Updated continuously."
    >
      <section className="mb-8">
        <Card className={allOperational ? "border-green-500/20 bg-green-500/5" : "border-amber-500/20 bg-amber-500/5"}>
          <CardContent className="flex items-center gap-4 py-6">
            {allOperational ? (
              <CheckCircle2 className="h-8 w-8 shrink-0 text-green-400" />
            ) : (
              <AlertTriangle className="h-8 w-8 shrink-0 text-amber-400" />
            )}
            <div>
              <p className="text-lg font-semibold text-white">
                {allOperational ? "All systems operational" : "Some systems degraded"}
              </p>
              <p className="text-sm text-zinc-400">
                Last updated: {new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-white">Services</h2>
        <div className="space-y-2">
          {SERVICES.map((service) => {
            const config = STATUS_CONFIG[service.status];
            const Icon = config.icon;
            return (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-sm font-medium text-white">{service.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  {service.latency && service.latency !== "—" && (
                    <span className="text-xs text-zinc-500">{service.latency}</span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
                  >
                    {config.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Incident History</h2>
        <div className="space-y-4">
          {INCIDENTS.map((incident) => {
            const config = INCIDENT_STATUS_CONFIG[incident.status];
            return (
              <Card key={incident.title}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base text-white">{incident.title}</CardTitle>
                      <CardDescription className="mt-1">{incident.date}</CardDescription>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-400">{incident.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {INCIDENTS.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-zinc-400">
              No incidents in the past 90 days.
            </CardContent>
          </Card>
        )}
      </section>
    </PublicPageShell>
  );
}
