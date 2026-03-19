import { useState } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useListIntegrations, useConnectIntegration, useDisconnectIntegration, getListIntegrationsQueryKey, type Integration } from "@workspace/api-client-react";
import { CheckCircle2, Link2Off, AlertCircle, ExternalLink } from "lucide-react";

type ProviderField = {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
  required: boolean;
  hint?: string;
};

type ProviderConfig = {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  accentColor: string;
  badgeColor: string;
  docs?: string;
  fields: readonly ProviderField[];
  labelKey: string;
  stats: (metadata: Record<string, unknown>) => Array<string | null>;
};

const PROVIDERS: readonly ProviderConfig[] = [
  {
    id: "github",
    name: "GitHub",
    category: "Deployment",
    description: "Connect repositories, trigger auto-deploys on push, and view commit metadata in deployment history.",
    icon: "🐙",
    accentColor: "from-zinc-800 to-zinc-900",
    badgeColor: "bg-zinc-700/50 text-zinc-300",
    docs: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps",
    fields: [],
    labelKey: "accountLogin",
    stats: (m: Record<string, unknown>) => [
      m.accountLogin ? `Account: ${m.accountLogin}` : null,
      m.repoCount ? `${m.repoCount} repos` : null,
    ].filter(Boolean),
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "Domains + DNS",
    description: "Connect custom domains, manage DNS records automatically, and enable SSL certificates and CDN caching.",
    icon: "🌐",
    accentColor: "from-orange-900/40 to-zinc-900",
    badgeColor: "bg-orange-700/30 text-orange-300",
    docs: "https://developers.cloudflare.com/fundamentals/api/",
    fields: [
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Cloudflare API Token", required: true, hint: "Zone: Edit, DNS: Edit permissions" },
      { key: "accountId", label: "Account ID", type: "text", placeholder: "Your Cloudflare Account ID", required: false },
    ],
    labelKey: "accountId",
    stats: (m: Record<string, unknown>) => [
      m.accountId ? `Account: ${String(m.accountId).slice(0, 12)}...` : null,
      m.zoneCount ? `${m.zoneCount} zones` : null,
    ].filter(Boolean),
  },
  {
    id: "slack",
    name: "Slack",
    category: "Notifications",
    description: "Send deployment alerts, success/failure notifications, and preview URLs directly to your team channels.",
    icon: "💬",
    accentColor: "from-purple-900/40 to-zinc-900",
    badgeColor: "bg-purple-700/30 text-purple-300",
    docs: "https://api.slack.com/messaging/webhooks",
    fields: [
      { key: "webhookUrl", label: "Incoming Webhook URL", type: "password", placeholder: "https://hooks.slack.com/services/...", required: true, hint: "Create an Incoming Webhook in Slack App settings" },
      { key: "channelName", label: "Channel Name", type: "text", placeholder: "#deployments", required: false },
    ],
    labelKey: "channelName",
    stats: (m: Record<string, unknown>) => [
      m.channelName ? `Channel: ${m.channelName}` : null,
    ].filter(Boolean),
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "Error Tracking",
    description: "Track production errors, associate them with deployment versions, and detect error spikes after releases.",
    icon: "🪲",
    accentColor: "from-violet-900/40 to-zinc-900",
    badgeColor: "bg-violet-700/30 text-violet-300",
    docs: "https://docs.sentry.io/product/sentry-basics/integrate-frontend/create-new-project/",
    fields: [
      { key: "authToken", label: "Auth Token", type: "password", placeholder: "sntrys_...", required: true, hint: "From Settings > Auth Tokens in your Sentry org" },
      { key: "orgSlug", label: "Organization Slug", type: "text", placeholder: "my-company", required: true },
      { key: "dsn", label: "DSN (optional)", type: "text", placeholder: "https://...@sentry.io/...", required: false },
    ],
    labelKey: "orgSlug",
    stats: (m: Record<string, unknown>) => [
      m.orgSlug ? `Org: ${m.orgSlug}` : null,
    ].filter(Boolean),
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "Backend + Database",
    description: "Connect your database, storage, and auth — inject Supabase environment variables into your deployments automatically.",
    icon: "⚡",
    accentColor: "from-emerald-900/40 to-zinc-900",
    badgeColor: "bg-emerald-700/30 text-emerald-300",
    docs: "https://supabase.com/docs/guides/api",
    fields: [
      { key: "projectUrl", label: "Project URL", type: "text", placeholder: "https://xxxxxxxxxxxx.supabase.co", required: true },
      { key: "anonKey", label: "Anon Key", type: "password", placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", required: true },
      { key: "serviceRoleKey", label: "Service Role Key (optional)", type: "password", placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", required: false },
    ],
    labelKey: "projectUrl",
    stats: (m: Record<string, unknown>) => [
      m.projectUrl ? new URL(m.projectUrl as string).hostname.split(".")[0] : null,
    ].filter(Boolean),
  },
  {
    id: "s3",
    name: "S3 / R2",
    category: "Artifact Storage",
    description: "Store build artifacts and static outputs. Enables instant rollback and versioned deployment storage.",
    icon: "🗄️",
    accentColor: "from-amber-900/40 to-zinc-900",
    badgeColor: "bg-amber-700/30 text-amber-300",
    docs: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
    fields: [
      { key: "bucket", label: "Bucket Name", type: "text", placeholder: "my-hostack-artifacts", required: true },
      { key: "region", label: "Region", type: "text", placeholder: "us-east-1", required: true },
      { key: "accessKeyId", label: "Access Key ID", type: "text", placeholder: "AKIAIOSFODNN7EXAMPLE", required: true },
      { key: "secretAccessKey", label: "Secret Access Key", type: "password", placeholder: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", required: true },
      { key: "endpoint", label: "Endpoint (R2 / custom)", type: "text", placeholder: "https://account.r2.cloudflarestorage.com", required: false, hint: "Leave blank for AWS S3" },
    ],
    labelKey: "bucket",
    stats: (m: Record<string, unknown>) => [
      m.bucket ? `Bucket: ${m.bucket}` : null,
      m.region ? `Region: ${m.region}` : null,
    ].filter(Boolean),
  },
  {
    id: "discord",
    name: "Discord",
    category: "Notifications",
    description: "Post deployment events, share preview URLs, and notify your developer community via Discord webhooks.",
    icon: "🎮",
    accentColor: "from-indigo-900/40 to-zinc-900",
    badgeColor: "bg-indigo-700/30 text-indigo-300",
    docs: "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks",
    fields: [
      { key: "webhookUrl", label: "Webhook URL", type: "password", placeholder: "https://discord.com/api/webhooks/...", required: true, hint: "Server Settings > Integrations > Webhooks" },
      { key: "serverName", label: "Server Name (optional)", type: "text", placeholder: "My Dev Server", required: false },
    ],
    labelKey: "serverName",
    stats: (m: Record<string, unknown>) => [
      m.serverName ? `Server: ${m.serverName}` : null,
    ].filter(Boolean),
  },
  {
    id: "posthog",
    name: "PostHog",
    category: "Analytics",
    description: "Tag deployments with release IDs, measure traffic changes, and track feature usage across deployment versions.",
    icon: "📊",
    accentColor: "from-rose-900/40 to-zinc-900",
    badgeColor: "bg-rose-700/30 text-rose-300",
    docs: "https://posthog.com/docs/api",
    fields: [
      { key: "apiKey", label: "Project API Key", type: "password", placeholder: "phc_xxxxxxxxxxxxxxxxxxxx", required: true },
      { key: "host", label: "Host (optional)", type: "text", placeholder: "https://app.posthog.com", required: false, hint: "Leave blank for PostHog Cloud" },
    ],
    labelKey: "apiKey",
    stats: (m: Record<string, unknown>) => [
      m.host ? `Host: ${m.host}` : "PostHog Cloud",
    ].filter(Boolean),
  },
];

function ConnectModal({
  provider,
  existing,
  onClose,
}: {
  provider: ProviderConfig;
  existing?: Integration;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(provider.fields.map(f => [f.key, ""]))
  );

  const connectMutation = useConnectIntegration({
    mutation: {
      onSuccess: () => {
        toast({ title: `${provider.name} connected` });
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
        onClose();
      },
      onError: (err) => toast({ title: "Failed to connect", description: err.message, variant: "destructive" }),
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const metadata: Record<string, string> = {};
    for (const f of provider.fields) {
      if (values[f.key]) metadata[f.key] = values[f.key];
    }
    const labelKey = provider.labelKey as string;
    const labelVal = values[labelKey] || provider.name;
    await connectMutation.mutateAsync({
      data: {
        provider: provider.id,
        accountLabel: labelVal,
        metadata,
      },
    });
  };

  const isValid = provider.fields.filter(f => f.required).every(f => values[f.key]?.trim());

  return (
    <DialogContent className="bg-card border-border/50 max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 text-xl">
          <span className="text-2xl">{provider.icon}</span>
          {existing ? `Update ${provider.name}` : `Connect ${provider.name}`}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {provider.description}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {provider.fields.map(field => (
          <div key={field.key} className="space-y-2">
            <Label className="text-sm">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            <Input
              type={field.type as "text" | "password"}
              placeholder={field.placeholder}
              value={values[field.key] || ""}
              onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
              className="font-mono text-sm"
            />
            {"hint" in field && field.hint && (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            )}
          </div>
        ))}

        {provider.docs && (
          <a
            href={provider.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 mt-1"
          >
            <ExternalLink className="w-3 h-3" /> View documentation
          </a>
        )}

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!isValid || connectMutation.isPending}>
            {connectMutation.isPending ? "Connecting..." : existing ? "Update" : "Connect"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function IntegrationCard({
  provider,
  connected,
}: {
  provider: ProviderConfig;
  connected?: Integration;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const disconnectMutation = useDisconnectIntegration({
    mutation: {
      onSuccess: () => {
        toast({ title: `${provider.name} disconnected` });
        queryClient.invalidateQueries({ queryKey: getListIntegrationsQueryKey() });
        setShowDisconnect(false);
      },
      onError: (err) => toast({ title: "Failed to disconnect", description: err.message, variant: "destructive" }),
    },
  });

  const isGitHub = provider.id === "github";
  const stats = connected ? provider.stats(connected.metadata as Record<string, unknown>) : [];
  const handlePrimaryAction = () => {
    if (isGitHub) {
      window.location.href = "/api/integrations/github/connect";
      return;
    }

    setShowModal(true);
  };

  return (
    <>
      <Card className={`border-border/50 bg-gradient-to-br ${provider.accentColor} hover:border-border/80 transition-all duration-200 relative overflow-hidden group`}>
        {connected && (
          <div className="absolute top-3 right-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.4)]" />
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none mt-0.5">{provider.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold">{provider.name}</CardTitle>
                <Badge variant="outline" className={`text-xs px-2 py-0 ${provider.badgeColor} border-0`}>
                  {provider.category}
                </Badge>
              </div>
              {connected ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-emerald-500 font-medium">Connected</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground mt-1 block">Not connected</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">{provider.description}</p>

          {connected && stats.length > 0 && (
            <div className="space-y-1 bg-white/5 rounded-lg px-3 py-2.5 border border-white/10">
              {stats.map((s, i) => (
                <p key={i} className="text-xs font-mono text-foreground/70">{s}</p>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant={connected ? "outline" : "default"}
              onClick={handlePrimaryAction}
              disabled={isGitHub && !!connected}
              className={`flex-1 text-xs ${connected ? "border-border/50 hover:bg-white/5" : ""}`}
            >
              {isGitHub ? (connected ? "Connected" : "Connect GitHub") : connected ? "Manage" : "Connect"}
            </Button>
            {connected && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDisconnect(true)}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-400 px-2"
                title="Disconnect"
              >
                <Link2Off className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!isGitHub && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <ConnectModal provider={provider} existing={connected} onClose={() => setShowModal(false)} />
        </Dialog>
      )}

      <Dialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <DialogContent className="bg-card border-destructive/20 max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect {provider.name}?</DialogTitle>
            <DialogDescription>
              This will remove the {provider.name} integration from your account. Project links will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDisconnect(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={disconnectMutation.isPending || !connected}
              onClick={() => connected && disconnectMutation.mutate({ id: connected.id })}
            >
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Integrations() {
  const { data, isLoading } = useListIntegrations();
  const integrations = data?.integrations || [];

  const connectedMap = new Map(integrations.map(i => [i.provider, i]));

  const connected = PROVIDERS.filter(p => connectedMap.has(p.id));
  const available = PROVIDERS.filter(p => !connectedMap.has(p.id));

  return (
    <ProtectedLayout>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="pb-4 border-b border-border/50">
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1.5">
            Connect your tools and services to power the full developer workflow.
          </p>
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{integrations.length} connected</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <AlertCircle className="w-4 h-4 text-zinc-500" />
              <span>{PROVIDERS.length - integrations.length} available</span>
            </div>
          </div>
        </div>

        {/* Workflow pipeline visual */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto pb-2 scrollbar-none">
          {[
            { label: "Code", color: "text-blue-400" },
            { label: "→" },
            { label: "Deploy", color: "text-cyan-400" },
            { label: "→" },
            { label: "Domain", color: "text-green-400" },
            { label: "→" },
            { label: "Alerts", color: "text-yellow-400" },
            { label: "→" },
            { label: "Errors", color: "text-violet-400" },
            { label: "→" },
            { label: "Backend", color: "text-emerald-400" },
            { label: "→" },
            { label: "Storage", color: "text-amber-400" },
            { label: "→" },
            { label: "Analytics", color: "text-rose-400" },
          ].map((step, i) => (
            <span key={i} className={`whitespace-nowrap font-medium ${step.color || "text-zinc-600"}`}>
              {step.label}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 bg-card/50 animate-pulse rounded-xl border border-border/50" />
            ))}
          </div>
        ) : (
          <>
            {/* Connected section */}
            {connected.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Connected
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {connected.map(p => (
                    <IntegrationCard key={p.id} provider={p} connected={connectedMap.get(p.id)} />
                  ))}
                </div>
              </section>
            )}

            {/* Available section */}
            {available.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-zinc-500" />
                  Available
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {available.map(p => (
                    <IntegrationCard key={p.id} provider={p} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
