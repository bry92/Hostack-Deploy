import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Rocket, Github, Globe, ExternalLink, Trash2, Eye, EyeOff, GitCommit, Link2, Link2Off, Copy, RefreshCw, GitBranch, Terminal, FolderOpen, Check, BarChart3, Activity, AlertCircle, AlertTriangle, CheckCircle2, XCircle, Zap, Search, Plus, Shield, Loader2, RotateCcw, Bot, Send, Sparkles, User, Bell, Webhook, Play, Pencil } from "lucide-react";
import {
  useGetProject,
  useListProjectDeployments,
  useListEnvVars,
  useGetGitHubConnection,
  useGetWebhookInfo,
  getGetWebhookInfoQueryKey,
  useRegenerateWebhookSecret,
  useUpdateProject,
  useListRuntimeLogs,
  useSimulateRuntimeLogs,
  useClearRuntimeLogs,
  useGetMetricsSummary,
  useSimulateMetrics,
  useGetProjectHealth,
  getListRuntimeLogsQueryKey,
  getGetMetricsSummaryQueryKey,
  useGetProjectSshKey,
  useGenerateProjectSshKey,
  useDeleteProjectSshKey,
  getGetProjectSshKeyQueryKey,
  useListProjectDomains,
  useAddProjectDomain,
  useRemoveProjectDomain,
  useVerifyProjectDomain,
  getListProjectDomainsQueryKey,
  useRollbackDeployment,
  getListProjectDeploymentsQueryKey,
  useGetNotificationSettings,
  useUpdateNotificationSettings,
  useDeleteNotificationSetting,
  useTestNotification,
  getGetNotificationSettingsQueryKey,
  useListIntegrations,
  useListBuildRules,
  useCreateBuildRule,
  useUpdateBuildRule,
  useDeleteBuildRule,
  getListBuildRulesQueryKey,
  useListDeployWebhooks,
  useCreateDeployWebhook,
  useDeleteDeployWebhook,
  getListDeployWebhooksQueryKey,
} from "@workspace/api-client-react";
import type {
  CustomDomain,
  Integration,
  NotificationSetting,
  Project,
  UpdateNotificationSettingsBodyChannelType,
  UpdateNotificationSettingsBodyEventTypesItem,
  TestNotificationResponse,
  VerifyProjectDomainMutationResult,
  BuildRule,
  DeployWebhook,
} from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EnvironmentBadge } from "@/components/ui/environment-badge";
import { formatDistanceToNow, format } from "date-fns";
import { useDeploymentsMutations } from "@/hooks/use-deployments-mutations";
import { useEnvVarsMutations } from "@/hooks/use-env-vars-mutations";
import { useProjectsMutations } from "@/hooks/use-projects-mutations";
import { formatDuration } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id || "";

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { triggerDeployment, isTriggering } = useDeploymentsMutations();
  const [copilotMessages, setCopilotMessages] = useState<ChatMessage[]>([]);
  const [showAutoDeployBanner, setShowAutoDeployBanner] = useState(false);
  const { data: buildRulesData } = useListBuildRules(projectId);

  const projectBranch = project?.repoBranch || "main";
  const hasAutoDeployRule = (buildRulesData?.buildRules ?? []).some(
    r => r.autoDeploy && r.environment === "production" && (
      r.branchPattern === projectBranch ||
      r.branchPattern === "*" ||
      (r.branchPattern.includes("*") && new RegExp("^" + r.branchPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(projectBranch))
    )
  ) || (project?.autoDeploy ?? false);

  const handleManualDeploy = () => {
    triggerDeployment({ projectId, data: { environment: "production" } });
    if (hasAutoDeployRule) {
      setShowAutoDeployBanner(true);
      setTimeout(() => setShowAutoDeployBanner(false), 8000);
    }
  };

  if (projectLoading) return <ProtectedLayout><div className="animate-pulse h-32 bg-card rounded-xl" /></ProtectedLayout>;
  if (!project) return <ProtectedLayout><div>Project not found</div></ProtectedLayout>;

  return (
    <ProtectedLayout>
      <div className="flex flex-col gap-6">
        {showAutoDeployBanner && (
          <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
            <Zap className="w-4 h-4 flex-shrink-0 text-blue-400" />
            <span>
              <strong>Auto-deploy is enabled.</strong> On a real git push to this branch, this deployment would fire automatically — no manual trigger needed.
            </span>
            <button onClick={() => setShowAutoDeployBanner(false)} className="ml-auto text-blue-400 hover:text-blue-300">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border/50">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight text-white">{project.name}</h1>
              <StatusBadge status={project.latestDeploymentStatus} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Github className="w-4 h-4" /> {project.repoUrl || "Unlinked"}</span>
              <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> {project.framework}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleManualDeploy}
              disabled={isTriggering}
              className="shadow-lg shadow-primary/20 hover-elevate active-elevate-2 font-semibold px-6"
            >
              <Rocket className="w-4 h-4 mr-2" />
              {isTriggering ? "Triggering..." : "Deploy to Production"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-card/50 border border-border w-full justify-start rounded-lg p-1 h-12 gap-0.5 overflow-x-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md px-4">Overview</TabsTrigger>
            <TabsTrigger value="deployments" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md px-4">Deployments</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md px-4">Logs</TabsTrigger>
            <TabsTrigger value="metrics" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md px-4">Metrics</TabsTrigger>
            <TabsTrigger value="copilot" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md px-4 gap-1.5"><Sparkles className="w-3.5 h-3.5" />Copilot</TabsTrigger>
            <TabsTrigger value="envvars" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md px-4">Env Vars</TabsTrigger>
            <TabsTrigger value="integrations" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md px-4">Integrations</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md px-4">Settings</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview" className="m-0 focus-visible:outline-none">
              <OverviewTab project={project} projectId={projectId} />
            </TabsContent>
            <TabsContent value="deployments" className="m-0 focus-visible:outline-none">
              <DeploymentsTab projectId={projectId} />
            </TabsContent>
            <TabsContent value="logs" className="m-0 focus-visible:outline-none">
              <ProjectLogsTab projectId={projectId} />
            </TabsContent>
            <TabsContent value="metrics" className="m-0 focus-visible:outline-none">
              <ProjectMetricsTab projectId={projectId} />
            </TabsContent>
            <TabsContent value="copilot" className="m-0 focus-visible:outline-none">
              <CopilotTab projectId={projectId} messages={copilotMessages} setMessages={setCopilotMessages} />
            </TabsContent>
            <TabsContent value="envvars" className="m-0 focus-visible:outline-none">
              <EnvVarsTab projectId={projectId} />
            </TabsContent>
            <TabsContent value="integrations" className="m-0 focus-visible:outline-none">
              <ProjectIntegrationsTab />
            </TabsContent>
            <TabsContent value="settings" className="m-0 focus-visible:outline-none">
              <SettingsTab project={project} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ProtectedLayout>
  );
}

function DeploymentsTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useListProjectDeployments(projectId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deployments = data?.deployments || [];

  const rollbackMutation = useRollbackDeployment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Rollback triggered", description: "A new deployment is being created from the selected version." });
        queryClient.invalidateQueries({ queryKey: getListProjectDeploymentsQueryKey(projectId) });
      },
      onError: (err) => toast({ title: "Rollback failed", description: err.message, variant: "destructive" }),
    },
  });

  const mostRecentDeployedId = deployments.find(d => (d.status === "deployed" || d.status === "ready") && d.environment === "production")?.id;

  if (isLoading) return <div className="h-40 bg-muted/20 animate-pulse rounded-xl" />;

  return (
    <Card className="border-border/50 bg-card/30">
      <CardHeader>
        <CardTitle>Deployment History</CardTitle>
        <CardDescription>View and monitor your project&apos;s deployments.</CardDescription>
      </CardHeader>
      <CardContent>
        {deployments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-lg">
            No deployments yet. Trigger a deployment to get started.
          </div>
        ) : (
          <div className="rounded-md border border-border/50 overflow-hidden">
            <div className="grid grid-cols-12 gap-3 p-4 text-xs font-medium text-muted-foreground bg-white/[0.02] border-b border-border/50">
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Commit / URL</div>
              <div className="col-span-2">Environment</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-1">Duration</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y divide-border/50">
              {deployments.map(dep => {
                const isRollback = dep.triggerType === "rollback";
                const canRollback = (dep.status === "deployed" || dep.status === "ready") && dep.environment === "production" && dep.id !== mostRecentDeployedId;

                return (
                  <div key={dep.id} className="grid grid-cols-12 gap-3 p-4 items-center text-sm hover:bg-white/[0.02] transition-colors">
                    <div className="col-span-2 flex items-center gap-1.5">
                      <StatusBadge status={dep.status} />
                      {isRollback && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0">
                          <RotateCcw className="w-2.5 h-2.5 mr-0.5" />
                          Rollback
                        </Badge>
                      )}
                    </div>
                    <div className="col-span-3 min-w-0">
                      {dep.commitHash ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                            <GitCommit className="w-3 h-3 flex-shrink-0" />
                            {dep.commitHash.slice(0, 8)}
                            {dep.commitMessage && (
                              <span className="text-foreground/70 truncate max-w-[160px]">{dep.commitMessage}</span>
                            )}
                          </span>
                          {dep.deploymentUrl && (
                            <a href={dep.deploymentUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-emerald-400/80 hover:text-emerald-400 font-mono truncate flex items-center gap-1 max-w-[200px]"
                              onClick={e => e.stopPropagation()}>
                              <Globe className="w-3 h-3 flex-shrink-0" />
                              {dep.deploymentUrl.replace("https://", "")}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          {dep.deploymentUrl ? (
                            <a href={dep.deploymentUrl} target="_blank" rel="noopener noreferrer"
                              className="text-emerald-400/80 hover:text-emerald-400 font-mono not-italic flex items-center gap-1"
                              onClick={e => e.stopPropagation()}>
                              <Globe className="w-3 h-3" />
                              {dep.deploymentUrl.replace("https://", "")}
                            </a>
                          ) : (
                            dep.commitMessage || "—"
                          )}
                        </span>
                      )}
                    </div>
                    <div className="col-span-2"><EnvironmentBadge environment={dep.environment} /></div>
                    <div className="col-span-2">
                      <div className="text-xs text-foreground">{format(new Date(dep.createdAt), "MMM d, yyyy")}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(dep.createdAt), "h:mm a")}</div>
                    </div>
                    <div className="col-span-1 text-xs text-muted-foreground">{formatDuration(dep.durationSeconds) || "—"}</div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {canRollback && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => rollbackMutation.mutate({ projectId, deploymentId: dep.id })}
                          disabled={rollbackMutation.isPending}
                          className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Roll back
                        </Button>
                      )}
                      <Link href={`/projects/${projectId}/deployments/${dep.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BASE_PROMPTS = [
  "Why did my last deploy fail?",
  "How can I improve my P95 latency?",
  "Am I missing any env vars?",
  "Is my deployment healthy right now?",
];

function useDynamicPrompts(projectId: string) {
  const { data: health } = useGetProjectHealth(projectId);
  const { data: metrics } = useGetMetricsSummary(projectId);

  const prompts = [...BASE_PROMPTS];

  if (health?.healthStatus === "critical" || health?.healthStatus === "degraded") {
    prompts.unshift("My project health is degraded — what's wrong?");
  }
  if (health?.healthStatus === "warning" && (health?.recentErrorCount ?? 0) > 0) {
    prompts.unshift(`I have ${health.recentErrorCount} recent errors — what's causing them?`);
  }
  if (metrics?.errorRate != null && Number(metrics.errorRate) > 5) {
    prompts.unshift(`My error rate is ${metrics.errorRate}% — how do I reduce it?`);
  }
  if (metrics?.p95LatencyMs != null && Number(metrics.p95LatencyMs) > 300) {
    prompts.unshift(`P95 latency is ${metrics.p95LatencyMs}ms — what should I optimize?`);
  }
  if (!metrics?.hasData) {
    prompts.unshift("How do I generate sample metrics for my project?");
  }

  return prompts.slice(0, 5);
}

function CopilotTab({ projectId, messages, setMessages }: { projectId: string; messages: ChatMessage[]; setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>> }) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestedPrompts = useDynamicPrompts(projectId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const history = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`/api/projects/${projectId}/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text.trim(), history: history.slice(-10) }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from Copilot");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === "assistant") {
                      updated[updated.length - 1] = { ...last, content: last.content + data.content };
                    }
                    return updated;
                  });
                }
                if (data.error) {
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === "assistant") {
                      updated[updated.length - 1] = { ...last, content: `Error: ${data.error}` };
                    }
                    return updated;
                  });
                }
              } catch {
                // Ignore malformed stream chunks while continuing to process the response.
              }
            }
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          updated[updated.length - 1] = { ...last, content: "Sorry, I encountered an error. Please try again." };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }, [isStreaming, messages, projectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Card className="border-border/50 bg-card/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Bot className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-lg">AI Deploy Copilot</CardTitle>
            <CardDescription>Ask questions about your deployments, logs, metrics, and configuration.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col h-[500px]">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                <div className="p-4 rounded-full bg-violet-500/5 border border-violet-500/10">
                  <Sparkles className="w-8 h-8 text-violet-400/60" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ask anything about your project</p>
                  <p className="text-xs text-muted-foreground/60">I have access to your deployments, logs, metrics, and configuration.</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="px-3 py-1.5 text-xs rounded-full border border-border/50 bg-white/[0.02] text-muted-foreground hover:text-foreground hover:bg-white/[0.05] hover:border-violet-500/30 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-7 h-7 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary/10 border border-primary/20 text-foreground"
                        : "bg-white/[0.03] border border-border/50 text-foreground/90"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>pre]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>code]:text-violet-300 [&>code]:bg-violet-500/10 [&>code]:px-1 [&>code]:rounded">
                        <CopilotMarkdown content={msg.content} />
                      </div>
                    ) : (
                      msg.content
                    )}
                    {msg.role === "assistant" && !msg.content && isStreaming && i === messages.length - 1 && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse [animation-delay:0.4s]" />
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border/50 p-4">
            {messages.length > 0 && !isStreaming && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {suggestedPrompts.filter(p => !messages.some(m => m.content === p)).slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="px-2.5 py-1 text-[11px] rounded-full border border-border/50 bg-white/[0.02] text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Ask about your deployments, logs, or metrics..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isStreaming}
                className="flex-1 bg-white/[0.03] border-border/50 focus-visible:ring-violet-500/30"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="bg-violet-600 hover:bg-violet-500 text-white flex-shrink-0"
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CopilotMarkdown({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const codeMatch = trimmed.match(/^```(\w+)?\n([\s\S]*?)```$/);
        if (codeMatch) {
          return (
            <pre key={bi} className="bg-black/30 border border-border/50 rounded-lg p-3 overflow-x-auto text-xs font-mono">
              <code>{codeMatch[2]}</code>
            </pre>
          );
        }

        const lines = trimmed.split("\n");
        const isList = lines.every(l => /^[-*]\s/.test(l) || /^\d+\.\s/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="space-y-0.5 ml-4">
              {lines.map((line, li) => (
                <li key={li} className="list-disc">
                  <InlineMarkdown text={line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        }

        if (/^###\s/.test(trimmed)) return <h3 key={bi} className="font-semibold mt-2"><InlineMarkdown text={trimmed.replace(/^###\s+/, "")} /></h3>;
        if (/^##\s/.test(trimmed)) return <h2 key={bi} className="font-semibold mt-2"><InlineMarkdown text={trimmed.replace(/^##\s+/, "")} /></h2>;
        if (/^#\s/.test(trimmed)) return <h1 key={bi} className="font-bold mt-2"><InlineMarkdown text={trimmed.replace(/^#\s+/, "")} /></h1>;

        return (
          <p key={bi}>
            {lines.map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                <InlineMarkdown text={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`([\s\S]*)$/);
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*([\s\S]*)$/);

    if (codeMatch && (!boldMatch || codeMatch.index! <= boldMatch.index!)) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(<code key={key++} className="text-violet-300 bg-violet-500/10 px-1 rounded text-xs">{codeMatch[2]}</code>);
      remaining = codeMatch[3];
    } else if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(<strong key={key++}>{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      remaining = "";
    }
  }

  return <>{parts}</>;
}

function EnvVarsTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useListEnvVars(projectId);
  const { createEnvVar, deleteEnvVar, isCreating } = useEnvVarsMutations();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newEnv, setNewEnv] = useState<"production" | "preview" | "all">("all");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey || !newValue) return;
    await createEnvVar({ projectId, data: { key: newKey, value: newValue, environment: newEnv } });
    setNewKey("");
    setNewValue("");
  };

  const toggleReveal = (id: string) => {
    setRevealed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const envVars = data?.envVars || [];

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Add Environment Variable</CardTitle>
          <CardDescription>Securely store secrets and configuration for your application.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <Label>Key</Label>
              <Input placeholder="API_KEY" value={newKey} onChange={e => setNewKey(e.target.value)} required />
            </div>
            <div className="space-y-2 flex-1">
              <Label>Value</Label>
              <Input placeholder="secret_value" type="password" value={newValue} onChange={e => setNewValue(e.target.value)} required />
            </div>
            <div className="space-y-2 w-full md:w-48">
              <Label>Environment</Label>
              <Select value={newEnv} onValueChange={(v: "all" | "production" | "preview") => setNewEnv(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Environments</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="preview">Preview</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={isCreating || !newKey || !newValue} className="w-full md:w-auto">
              Add Variable
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/30">
        <CardHeader>
          <CardTitle>Configured Variables</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-20 bg-muted/20 animate-pulse rounded" /> :
            envVars.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border/50 rounded-lg">
                No environment variables defined.
              </div>
            ) : (
              <div className="rounded-md border border-border/50 overflow-hidden divide-y divide-border/50">
                {envVars.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-4 bg-white/[0.01]">
                    <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                      <div className="font-mono text-sm font-semibold">{v.key}</div>
                      <div className="font-mono text-sm text-muted-foreground flex items-center gap-2">
                        {revealed[v.id] ? v.value : "••••••••••••••••"}
                        <button onClick={() => toggleReveal(v.id)} className="text-muted-foreground hover:text-foreground">
                          {revealed[v.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div>
                        <span className="text-xs px-2 py-1 bg-white/5 rounded text-muted-foreground capitalize">{v.environment}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteEnvVar({ projectId, envVarId: v.id })} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" onClick={copy} className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function GitHubSection({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [revealedWebhookSecret, setRevealedWebhookSecret] = useState<string | null>(null);

  const { data: connection, isLoading: isLoadingConn } = useGetGitHubConnection(projectId);
  const { data: webhookInfo, isLoading: isLoadingWebhook } = useGetWebhookInfo(projectId, {
    query: {
      queryKey: getGetWebhookInfoQueryKey(projectId),
      enabled: connection?.connected === true,
    },
  });

  useEffect(() => {
    setRevealedWebhookSecret(null);
    setShowSecret(false);
  }, [projectId]);

  const regenerateMutation = useRegenerateWebhookSecret({
    mutation: {
      onSuccess: (data) => {
        setRevealedWebhookSecret(data.webhookSecret);
        setShowSecret(true);
        toast({ title: "Webhook secret regenerated" });
        queryClient.invalidateQueries({ queryKey: getGetWebhookInfoQueryKey(projectId) });
      },
      onError: (err) => toast({ title: "Failed to regenerate", description: err.message, variant: "destructive" }),
    },
  });

  const currentWebhookSecret = revealedWebhookSecret;
  const hasWebhookSecret = webhookInfo?.hasWebhookSecret ?? false;
  const handleConnectRedirect = () => {
    window.location.href = "/api/integrations/github/connect";
  };

  if (isLoadingConn) {
    return <div className="h-24 bg-muted/10 animate-pulse rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/50">
        <div className="flex items-center gap-3">
          <Github className="w-5 h-5 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              GitHub Integration
              {connection?.connected ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">Connected</Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-500 text-xs">Not connected</Badge>
              )}
            </div>
            {connection?.connected && connection.repoUrl && (
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {connection.repoUrl}
              </p>
            )}
          </div>
        </div>
        {connection?.connected ? (
          <Link href="/integrations">
            <Button
              variant="outline"
              size="sm"
              className="border-border/50 hover:bg-white/5"
            >
              Manage in Integrations
            </Button>
          </Link>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handleConnectRedirect}
            className="gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5" />
            Connect GitHub
          </Button>
        )}
      </div>

      {/* OAuth guidance (only when not connected) */}
      {!connection?.connected && (
        <div className="space-y-4 p-4 bg-card/30 rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground">
            GitHub is connected at the account level now. Start the OAuth flow to authorize repository access, then return here to configure webhooks for this project.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleConnectRedirect} className="gap-2">
              <Link2 className="w-4 h-4" />
              Connect GitHub
            </Button>
            <Link href="/integrations">
              <Button variant="outline">Open Integrations</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Webhook info (only when connected) */}
      {connection?.connected && (
        <div className="p-4 bg-card/30 rounded-lg border border-border/50 space-y-4">
          <h4 className="font-medium text-sm flex items-center gap-2">
            Webhook Configuration
            <Badge variant="outline" className="text-xs text-zinc-400">Auto-deploy on push</Badge>
          </h4>
           <p className="text-xs text-muted-foreground">
             Add this webhook URL to your GitHub repository settings. The secret is only revealed after regeneration and is not guaranteed to be readable later.
           </p>

          {isLoadingWebhook ? (
            <div className="h-16 bg-muted/10 animate-pulse rounded" />
          ) : webhookInfo ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                <div className="flex items-center gap-2 bg-zinc-900 rounded-lg border border-border/50 px-3 py-2">
                  <code className="text-xs text-emerald-400 flex-1 break-all font-mono">{webhookInfo.webhookUrl}</code>
                  <CopyButton value={webhookInfo.webhookUrl} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Webhook Secret</Label>
                <div className="flex items-center gap-2 bg-zinc-900 rounded-lg border border-border/50 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    {currentWebhookSecret ? (
                      <code className="text-xs text-amber-400 font-mono break-all">
                        {showSecret ? currentWebhookSecret : "••••••••••••••••••••••••••••••••"}
                      </code>
                    ) : hasWebhookSecret ? (
                      <div className="space-y-1">
                        <code className="text-xs text-amber-400 font-mono">Secret stored and hidden</code>
                        {webhookInfo?.webhookSecretLastFour ? (
                          <p className="text-[11px] text-muted-foreground font-mono">
                            Last four: {webhookInfo.webhookSecretLastFour}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <code className="text-xs text-amber-400 font-mono">No secret configured yet</code>
                      </div>
                    )}
                  </div>
                  {currentWebhookSecret ? (
                    <>
                      <button
                        onClick={() => setShowSecret(v => !v)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <CopyButton value={currentWebhookSecret} />
                    </>
                  ) : null}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerateMutation.mutate({ projectId })}
                disabled={regenerateMutation.isPending}
                className="text-xs gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                {regenerateMutation.isPending ? "Regenerating..." : "Rotate and Reveal Secret"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Regenerating rotates the secret and reveals the new value once in this session.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BuildRulesSection({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [branchPattern, setBranchPattern] = useState("");
  const [environment, setEnvironment] = useState<"production" | "preview">("production");
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [buildCmd, setBuildCmd] = useState("");
  const [installCmd, setInstallCmd] = useState("");

  const { data, isLoading } = useListBuildRules(projectId);
  const rules = data?.buildRules ?? [];

  const createMutation = useCreateBuildRule({
    mutation: {
      onSuccess: () => {
        toast({ title: "Build rule created" });
        queryClient.invalidateQueries({ queryKey: getListBuildRulesQueryKey(projectId) });
        resetForm();
      },
      onError: (err) => toast({ title: "Failed to create rule", description: err.message, variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateBuildRule({
    mutation: {
      onSuccess: () => {
        toast({ title: "Build rule updated" });
        queryClient.invalidateQueries({ queryKey: getListBuildRulesQueryKey(projectId) });
        resetForm();
      },
      onError: (err) => toast({ title: "Failed to update rule", description: err.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteBuildRule({
    mutation: {
      onSuccess: () => {
        toast({ title: "Build rule deleted" });
        queryClient.invalidateQueries({ queryKey: getListBuildRulesQueryKey(projectId) });
      },
      onError: (err) => toast({ title: "Failed to delete rule", description: err.message, variant: "destructive" }),
    },
  });

  const resetForm = () => {
    setShowAdd(false);
    setEditingId(null);
    setBranchPattern("");
    setEnvironment("production");
    setAutoDeploy(true);
    setBuildCmd("");
    setInstallCmd("");
  };

  const startEdit = (rule: BuildRule) => {
    setEditingId(rule.id);
    setBranchPattern(rule.branchPattern);
    setEnvironment(rule.environment);
    setAutoDeploy(rule.autoDeploy);
    setBuildCmd(rule.buildCommandOverride || "");
    setInstallCmd(rule.installCommandOverride || "");
    setShowAdd(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchPattern.trim()) return;

    const payload = {
      branchPattern: branchPattern.trim(),
      environment,
      autoDeploy,
      buildCommandOverride: buildCmd || undefined,
      installCommandOverride: installCmd || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ projectId, ruleId: editingId, data: payload });
    } else {
      createMutation.mutate({ projectId, data: payload });
    }
  };

  if (isLoading) return <div className="h-20 bg-muted/10 animate-pulse rounded-lg" />;

  return (
    <div className="space-y-4">
      {rules.length > 0 && (
        <div className="rounded-lg border border-border/50 divide-y divide-border/50 overflow-hidden">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-4 bg-card/30 hover:bg-card/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <GitBranch className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium">{rule.branchPattern}</span>
                    <EnvironmentBadge environment={rule.environment} />
                    {rule.autoDeploy ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">Auto-deploy</Badge>
                    ) : (
                      <Badge variant="outline" className="text-zinc-500 text-xs">Manual</Badge>
                    )}
                  </div>
                  {(rule.buildCommandOverride || rule.installCommandOverride) && (
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {rule.installCommandOverride && (
                        <span className="font-mono">install: {rule.installCommandOverride}</span>
                      )}
                      {rule.buildCommandOverride && (
                        <span className="font-mono">build: {rule.buildCommandOverride}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => startEdit(rule)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                  onClick={() => deleteMutation.mutate({ projectId, ruleId: rule.id })}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <form onSubmit={handleSubmit} className="p-4 bg-card/30 rounded-lg border border-border/50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" /> Branch Pattern</Label>
              <Input
                placeholder="main, feature/*, release/*"
                value={branchPattern}
                onChange={e => setBranchPattern(e.target.value)}
                className="font-mono text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">Use * as a wildcard. e.g. feature/* matches all feature branches.</p>
            </div>
            <div className="space-y-2">
              <Label>Target Environment</Label>
              <Select value={environment} onValueChange={(v: string) => setEnvironment(v as "production" | "preview")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="preview">Preview</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> Install Command Override</Label>
              <Input
                placeholder="npm install (leave empty for default)"
                value={installCmd}
                onChange={e => setInstallCmd(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> Build Command Override</Label>
              <Input
                placeholder="npm run build (leave empty for default)"
                value={buildCmd}
                onChange={e => setBuildCmd(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-border/50">
            <div>
              <p className="font-medium text-sm">Auto-deploy</p>
              <p className="text-xs text-muted-foreground mt-0.5">Automatically deploy when matching branches are pushed.</p>
            </div>
            <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!branchPattern.trim() || createMutation.isPending || updateMutation.isPending}>
              {editingId
                ? (updateMutation.isPending ? "Updating..." : "Update Rule")
                : (createMutation.isPending ? "Creating..." : "Add Rule")}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Add Build Rule
        </Button>
      )}

      {rules.length === 0 && !showAdd && (
        <div className="text-center py-6 text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <GitBranch className="w-5 h-5 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No build rules configured yet.</p>
          <p className="text-xs mt-1">Add rules to auto-deploy specific branches with custom build settings.</p>
        </div>
      )}
    </div>
  );
}

function DeployWebhooksSection({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testBranches, setTestBranches] = useState<Record<string, string>>({});

  const { data, isLoading } = useListDeployWebhooks(projectId);
  const webhooks = data?.webhooks ?? [];

  const createMutation = useCreateDeployWebhook({
    mutation: {
      onSuccess: () => {
        toast({ title: "Webhook created" });
        queryClient.invalidateQueries({ queryKey: getListDeployWebhooksQueryKey(projectId) });
        setNewLabel("");
      },
      onError: (err) => toast({ title: "Failed to create webhook", description: err.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteDeployWebhook({
    mutation: {
      onSuccess: () => {
        toast({ title: "Webhook deleted" });
        queryClient.invalidateQueries({ queryKey: getListDeployWebhooksQueryKey(projectId) });
      },
      onError: (err) => toast({ title: "Failed to delete webhook", description: err.message, variant: "destructive" }),
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ projectId, data: { label: newLabel.trim() || "Default" } });
  };

  const getWebhookUrl = (secret: string) => {
    const base = window.location.origin;
    return `${base}/api/webhooks/${projectId}/${secret}`;
  };

  const handleTest = async (webhook: DeployWebhook) => {
    setTestingId(webhook.id);
    const branch = testBranches[webhook.id]?.trim() || "main";
    try {
      const url = getWebhookUrl(webhook.secret);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch }),
      });
      const body = await resp.json();
      if (resp.status === 201) {
        toast({ title: "Webhook triggered", description: `Deployment queued for branch "${branch}".` });
        queryClient.invalidateQueries({ queryKey: getListDeployWebhooksQueryKey(projectId) });
      } else if (resp.status === 200 && body.message) {
        toast({ title: "Deployment skipped", description: body.message });
      } else {
        toast({ title: "Webhook failed", description: `Status: ${resp.status}`, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Webhook failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  if (isLoading) return <div className="h-20 bg-muted/10 animate-pulse rounded-lg" />;

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-3 items-end">
        <div className="flex-1 space-y-2">
          <Label className="text-sm">Label</Label>
          <Input
            placeholder="e.g. CI Pipeline, GitHub Actions"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending} className="gap-1.5">
          <Plus className="w-4 h-4" />
          {createMutation.isPending ? "Generating..." : "Generate Webhook"}
        </Button>
      </form>

      {webhooks.length > 0 ? (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const webhookUrl = getWebhookUrl(wh.secret);
            const curlExample = `curl -X POST "${webhookUrl}" -H "Content-Type: application/json" -d '{"branch":"main"}'`;
            const secretVisible = showSecrets[wh.id];

            return (
              <div key={wh.id} className="p-4 bg-card/30 rounded-lg border border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{wh.label}</span>
                    {wh.lastTriggeredAt && (
                      <span className="text-xs text-muted-foreground">
                        Last triggered {formatDistanceToNow(new Date(wh.lastTriggeredAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      className="w-32 h-8 text-xs"
                      placeholder="Branch (main)"
                      value={testBranches[wh.id] ?? ""}
                      onChange={e => setTestBranches(prev => ({ ...prev, [wh.id]: e.target.value }))}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => handleTest(wh)}
                      disabled={testingId === wh.id}
                    >
                      {testingId === wh.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {testingId === wh.id ? "Triggering..." : "Test"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => deleteMutation.mutate({ projectId, webhookId: wh.id })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                    <div className="flex items-center gap-2 bg-zinc-950 rounded-lg border border-border/50 px-3 py-2">
                      <code className="text-xs text-emerald-400 flex-1 break-all font-mono">{webhookUrl}</code>
                      <CopyButton value={webhookUrl} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Secret</Label>
                    <div className="flex items-center gap-2 bg-zinc-950 rounded-lg border border-border/50 px-3 py-2">
                      <code className="text-xs text-amber-400 flex-1 font-mono">
                        {secretVisible ? wh.secret : `${wh.secret.slice(0, 8)}${"•".repeat(24)}`}
                      </code>
                      <button
                        onClick={() => setShowSecrets(prev => ({ ...prev, [wh.id]: !prev[wh.id] }))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {secretVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <CopyButton value={wh.secret} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">cURL Example</Label>
                  <div className="flex items-center gap-2 bg-zinc-950 rounded-lg border border-border/50 px-3 py-2">
                    <code className="text-xs text-cyan-400 flex-1 break-all font-mono">{curlExample}</code>
                    <CopyButton value={curlExample} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <Webhook className="w-5 h-5 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No deploy webhooks configured yet.</p>
          <p className="text-xs mt-1">Generate a webhook to trigger deployments from external services.</p>
        </div>
      )}
    </div>
  );
}

function BuildSettingsSection({ project }: { project: Project }) {
  const { toast } = useToast();
  const updateMutation = useUpdateProject({
    mutation: {
      onSuccess: () => toast({ title: "Build settings saved" }),
      onError: (err) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
    },
  });

  const [branch, setBranch] = useState(project.repoBranch || "main");
  const [buildCommand, setBuildCommand] = useState(project.buildCommand || "");
  const [installCommand, setInstallCommand] = useState(project.installCommand || "");
  const [rootDirectory, setRootDirectory] = useState(project.rootDirectory || "");
  const [autoDeploy, setAutoDeploy] = useState(project.autoDeploy ?? true);

  const isDirty =
    branch !== (project.repoBranch || "main") ||
    buildCommand !== (project.buildCommand || "") ||
    installCommand !== (project.installCommand || "") ||
    rootDirectory !== (project.rootDirectory || "") ||
    autoDeploy !== (project.autoDeploy ?? true);

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      projectId: project.id,
      data: {
        repoBranch: branch || undefined,
        buildCommand: buildCommand || undefined,
        installCommand: installCommand || undefined,
        rootDirectory: rootDirectory || undefined,
        autoDeploy,
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" /> Production Branch</Label>
          <Input
            placeholder="main"
            value={branch}
            onChange={e => setBranch(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Deploys are triggered from this branch.</p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> Root Directory</Label>
          <Input
            placeholder="./ (project root)"
            value={rootDirectory}
            onChange={e => setRootDirectory(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Directory to run build commands from.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> Install Command</Label>
          <Input
            placeholder="npm install"
            value={installCommand}
            onChange={e => setInstallCommand(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> Build Command</Label>
          <Input
            placeholder="npm run build"
            value={buildCommand}
            onChange={e => setBuildCommand(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/50">
        <div>
          <p className="font-medium text-sm">Auto-deploy on push</p>
          <p className="text-xs text-muted-foreground mt-0.5">Automatically deploy when a push is made to the production branch.</p>
        </div>
        <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
      </div>

      <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
        {updateMutation.isPending ? "Saving..." : "Save Build Settings"}
      </Button>
    </div>
  );
}

function SshKeySection({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useGetProjectSshKey(projectId);
  const sshKey = data?.sshKey ?? null;

  const generateMutation = useGenerateProjectSshKey({
    mutation: {
      onSuccess: () => {
        toast({ title: "SSH key generated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetProjectSshKeyQueryKey(projectId) });
      },
      onError: (err) => toast({ title: "Failed to generate key", description: err.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteProjectSshKey({
    mutation: {
      onSuccess: () => {
        toast({ title: "SSH key removed" });
        queryClient.invalidateQueries({ queryKey: getGetProjectSshKeyQueryKey(projectId) });
      },
      onError: (err) => toast({ title: "Failed to remove key", description: err.message, variant: "destructive" }),
    },
  });

  const handleCopy = async () => {
    if (!sshKey?.publicKey) return;
    await navigator.clipboard.writeText(sshKey.publicKey);
    setCopied(true);
    toast({ title: "Public key copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="h-20 bg-muted/10 animate-pulse rounded-lg" />;

  return (
    <div className="space-y-4">
      {/* Status row */}
      <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              SSH Deploy Key
              {sshKey ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">Key Generated</Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-500 text-xs">Not Connected</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sshKey
                ? `ED25519 key — created ${formatDistanceToNow(new Date(sshKey.createdAt), { addSuffix: true })}`
                : "No SSH key generated yet"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sshKey ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateMutation.mutate({ projectId })}
                disabled={generateMutation.isPending}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {generateMutation.isPending ? "Regenerating..." : "Regenerate"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:bg-red-500/10 hover:text-red-400 text-xs gap-1.5"
                onClick={() => deleteMutation.mutate({ projectId })}
                disabled={deleteMutation.isPending}
              >
                <Link2Off className="w-3.5 h-3.5" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => generateMutation.mutate({ projectId })}
              disabled={generateMutation.isPending}
              className="gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5" />
              {generateMutation.isPending ? "Generating..." : "Generate Key"}
            </Button>
          )}
        </div>
      </div>

      {/* Public key display + instructions */}
      {sshKey && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Public Key</Label>
              <span className="text-xs text-muted-foreground">Safe to share — add this to GitHub</span>
            </div>
            <div className="relative">
              <div className="bg-zinc-950 border border-border/50 rounded-lg p-3 pr-10 font-mono text-xs text-emerald-400 break-all leading-relaxed">
                {sshKey.publicKey}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                title="Copy public key"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          {/* GitHub instructions */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
              <Github className="w-4 h-4" />
              How to add this key to GitHub
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground list-none">
              {[
                "Copy the public key above",
                "Go to your GitHub repository",
                'Navigate to Settings → Deploy Keys → Add Deploy Key',
                "Paste the public key and give it a name (e.g. \"Hostack Deploy\")",
                'Enable "Allow write access" if your deployments need to push',
                "Click Add Key",
              ].map((step, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="pt-2 border-t border-blue-500/20">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Security note:</span> The private key is stored securely and never exposed through the API. Only the deployment worker accesses it during cloning.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomDomainsSection({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState("");

  const { data, isLoading } = useListProjectDomains(projectId);
  const domains: CustomDomain[] = data?.domains ?? [];

  const addMutation = useAddProjectDomain({
    mutation: {
      onSuccess: () => {
        toast({ title: "Domain added" });
        queryClient.invalidateQueries({ queryKey: getListProjectDomainsQueryKey(projectId) });
        setNewDomain("");
      },
      onError: (err: unknown) => {
        const msg = typeof err === "object" && err !== null && "response" in err
          ? (((err as { response?: { data?: { error?: string } } }).response?.data?.error) ?? "Failed to add domain")
          : err instanceof Error
            ? err.message
            : "Failed to add domain";
        toast({ title: "Failed to add domain", description: msg, variant: "destructive" });
      },
    },
  });

  const removeMutation = useRemoveProjectDomain({
    mutation: {
      onSuccess: () => {
        toast({ title: "Domain removed" });
        queryClient.invalidateQueries({ queryKey: getListProjectDomainsQueryKey(projectId) });
      },
      onError: (err) => toast({ title: "Failed to remove domain", description: err.message, variant: "destructive" }),
    },
  });

  const verifyMutation = useVerifyProjectDomain({
    mutation: {
      onSuccess: (data: VerifyProjectDomainMutationResult) => {
        const status = data?.domain?.status;
        if (status === "active") {
          toast({ title: "Domain verified successfully" });
        } else {
          toast({ title: "Verification failed", description: "DNS records not found yet. Please check your configuration and try again.", variant: "destructive" });
        }
        queryClient.invalidateQueries({ queryKey: getListProjectDomainsQueryKey(projectId) });
      },
      onError: (err) => toast({ title: "Verification failed", description: err.message, variant: "destructive" }),
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    addMutation.mutate({ projectId, data: { domain: newDomain.trim() } });
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
    active: { label: "Active", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    failed: { label: "Failed", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  };

  if (isLoading) return <div className="h-20 bg-muted/10 animate-pulse rounded-lg" />;

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-3 items-end">
        <div className="flex-1 space-y-2">
          <Label className="text-sm">Domain</Label>
          <Input
            placeholder="app.example.com"
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            className="font-mono"
          />
        </div>
        <Button type="submit" disabled={!newDomain.trim() || addMutation.isPending} className="gap-1.5">
          <Plus className="w-4 h-4" />
          {addMutation.isPending ? "Adding..." : "Add Domain"}
        </Button>
      </form>

      {domains.length > 0 && (
        <div className="rounded-lg border border-border/50 divide-y divide-border/50 overflow-hidden">
          {domains.map((d) => {
            const sc = statusConfig[d.status] || statusConfig.pending;
            return (
              <div key={d.id} className="flex items-center justify-between p-4 bg-card/30 hover:bg-card/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium truncate">{d.domain}</span>
                      <Badge variant="outline" className={`text-xs ${sc.className}`}>{sc.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Added {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                      {d.verifiedAt && ` · Verified ${formatDistanceToNow(new Date(d.verifiedAt), { addSuffix: true })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.status !== "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => verifyMutation.mutate({ projectId, domainId: d.id })}
                      disabled={verifyMutation.isPending}
                    >
                      {verifyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                      Verify
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-400 h-8 w-8 p-0"
                    onClick={() => removeMutation.mutate({ projectId, domainId: d.id })}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
          <Globe className="w-4 h-4" />
          DNS Configuration
        </div>
        <p className="text-sm text-muted-foreground">
          Point your domain to Hostack by adding a CNAME record:
        </p>
        <div className="bg-zinc-950 border border-border/50 rounded-lg p-3 font-mono text-xs space-y-1">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground w-12">Type</span>
            <span className="text-emerald-400">CNAME</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground w-12">Name</span>
            <span className="text-emerald-400">your-subdomain</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground w-12">Value</span>
            <span className="text-emerald-400">cname.hostack.app</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          For root domains (e.g. <code className="bg-white/5 px-1 rounded">example.com</code>), use an ALIAS or ANAME record pointing to <code className="bg-white/5 px-1 rounded">cname.hostack.app</code>. DNS changes can take up to 48 hours to propagate.
        </p>
      </div>
    </div>
  );
}

function SettingsTab({ project }: { project: Project }) {
  const { updateProject, deleteProject, isUpdating, isDeleting } = useProjectsMutations();
  const [, setLocation] = useLocation();
  const [name, setName] = useState(project.name);
  const [repoUrl, setRepoUrl] = useState(project.repoUrl || "");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleSave = async () => {
    await updateProject({ projectId: project.id, data: { name, repoUrl } });
  };

  const handleDelete = async () => {
    await deleteProject({ projectId: project.id });
    setLocation("/projects");
  };

  return (
    <div className="space-y-6">
      {/* General */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xl">
            <Label>Project Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2 max-w-xl">
            <Label>Repository URL</Label>
            <Input value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={isUpdating || (name === project.name && repoUrl === project.repoUrl)}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Build Settings */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Build & Deploy Settings</CardTitle>
          <CardDescription>Configure how your project is built and deployed.</CardDescription>
        </CardHeader>
        <CardContent>
          <BuildSettingsSection project={project} />
        </CardContent>
      </Card>

      {/* GitHub Integration */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>GitHub Integration</CardTitle>
          <CardDescription>Connect GitHub to enable private repo access and auto-deploy on push.</CardDescription>
        </CardHeader>
        <CardContent>
          <GitHubSection projectId={project.id} />
        </CardContent>
      </Card>

      {/* Build Rules */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Build Rules</CardTitle>
          <CardDescription>Configure branch-specific build rules for automated deployments. Match branch patterns to deploy to different environments with custom build settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <BuildRulesSection projectId={project.id} />
        </CardContent>
      </Card>

      {/* Deploy Webhooks */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Deploy Webhooks</CardTitle>
          <CardDescription>Generate webhook URLs that trigger deployments when called. Use these in your CI/CD pipeline or external tools.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeployWebhooksSection projectId={project.id} />
        </CardContent>
      </Card>

      {/* SSH Key */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>SSH Deploy Key</CardTitle>
          <CardDescription>Generate an ED25519 SSH key to authenticate with private GitHub repositories without a personal access token.</CardDescription>
        </CardHeader>
        <CardContent>
          <SshKeySection projectId={project.id} />
        </CardContent>
      </Card>

      {/* Custom Domains */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Custom Domains</CardTitle>
          <CardDescription>Attach your own domain names to this project. Configure DNS records to point to Hostack.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomDomainsSection projectId={project.id} />
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Notifications</CardTitle>
          <CardDescription>Get alerted when deployments start, succeed, or fail via Slack, Discord, or a custom webhook.</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettingsSection projectId={project.id} />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible and destructive actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-foreground">Delete Project</h4>
              <p className="text-sm text-muted-foreground">Once you delete a project, there is no going back. Please be certain.</p>
            </div>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">Delete Project</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-destructive/20">
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete the <strong>{project.name}</strong> project, its deployments, and environment variables.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? "Deleting..." : "Yes, delete project"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewTab({ project, projectId }: { project: Project; projectId: string }) {
  const { data: deploymentsData } = useListProjectDeployments(projectId);
  const { data: healthData } = useGetProjectHealth(projectId);
  const { data: metricsData } = useGetMetricsSummary(projectId, {});
  const { data: logsData } = useListRuntimeLogs(projectId, { limit: 5, level: "error" });

  const deployments = deploymentsData?.deployments || [];
  const latestDep = deployments[0];
  const health = healthData;
  const metrics = metricsData;
  const recentErrors = logsData?.logs || [];

  const healthDotClass = {
    healthy: "bg-emerald-500",
    warning: "bg-yellow-500",
    degraded: "bg-orange-500",
    critical: "bg-red-500",
    unknown: "bg-zinc-500",
  }[health?.healthStatus || "unknown"] ?? "bg-zinc-500";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <Card className="border-border/50 bg-card/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Health Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${healthDotClass} flex-shrink-0`} />
              <span className="text-lg font-semibold capitalize">{health?.healthStatus ?? "Unknown"}</span>
              {health?.recentErrorCount != null && health.recentErrorCount > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs ml-auto">
                  {health.recentErrorCount} recent errors
                </Badge>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-white/5 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Error Rate</p>
                <p className={`font-semibold ${metrics?.errorRate != null && metrics.errorRate > 5 ? "text-red-400" : "text-emerald-400"}`}>
                  {metrics?.hasData ? `${metrics.errorRate?.toFixed(2) ?? "—"}%` : "No data"}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">P95 Latency</p>
                <p className={`font-semibold ${metrics?.p95LatencyMs != null && metrics.p95LatencyMs > 500 ? "text-orange-400" : "text-cyan-400"}`}>
                  {metrics?.hasData ? `${metrics.p95LatencyMs?.toFixed(0) ?? "—"}ms` : "No data"}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                <p className="font-semibold text-emerald-400">
                  {metrics?.hasData ? `${metrics.uptimePct?.toFixed(2) ?? "—"}%` : "No data"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="w-4 h-4 text-muted-foreground" />
              Latest Deployment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestDep ? (
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <StatusBadge status={latestDep.status} />
                  {latestDep.commitHash && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <GitCommit className="w-3 h-3" />
                      {latestDep.commitHash.slice(0, 8)}
                      {latestDep.commitMessage && <span className="text-foreground/70 ml-1">{latestDep.commitMessage}</span>}
                    </span>
                  )}
                  {latestDep.deploymentUrl && (
                    <a href={latestDep.deploymentUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:underline font-mono">
                      <Globe className="w-3 h-3" /> {latestDep.deploymentUrl.replace("https://", "")}
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {latestDep.createdAt ? formatDistanceToNow(new Date(latestDep.createdAt), { addSuffix: true }) : "—"}
                  </p>
                </div>
                <Link href={`/projects/${projectId}/deployments/${latestDep.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border/50 rounded-lg">
                No deployments yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentErrors.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border/50 rounded-lg flex flex-col items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-60" />
                No recent errors
              </div>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {recentErrors.map(log => (
                  <div key={log.id} className="flex gap-2 p-2 rounded bg-red-500/5 border border-red-500/10">
                    <span className="text-zinc-500 shrink-0">{format(new Date(log.createdAt), "HH:mm:ss")}</span>
                    <span className="text-red-400 truncate">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="border-border/50 bg-card/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Deployments</span>
              <span className="font-semibold">{deployments.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Successful</span>
              <span className="font-semibold text-emerald-400">{deployments.filter(d => d.status === "ready").length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Failed</span>
              <span className="font-semibold text-red-400">{deployments.filter(d => d.status === "failed").length}</span>
            </div>
            <div className="h-px bg-border/50 my-1" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Framework</span>
              <span className="font-mono text-xs">{project.framework || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Req/min</span>
              <span className="font-semibold">{metrics?.hasData ? (metrics.requestsPerMin?.toFixed(0) ?? "—") : "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/logs">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                <Terminal className="w-3.5 h-3.5" /> View Runtime Logs
              </Button>
            </Link>
            <Link href="/metrics">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                <BarChart3 className="w-3.5 h-3.5" /> View Metrics
              </Button>
            </Link>
            <Link href="/integrations">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                <ExternalLink className="w-3.5 h-3.5" /> Manage Integrations
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const LOG_LEVEL_CONFIG = {
  error: { color: "text-red-400" },
  warn: { color: "text-yellow-400" },
  info: { color: "text-blue-400" },
  debug: { color: "text-zinc-400" },
  success: { color: "text-emerald-400" },
};

function ProjectLogsTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [levelFilter, setLevelFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");

  const logsQuery = useListRuntimeLogs(projectId, {
    level: levelFilter === "all" ? undefined : levelFilter,
    search: logSearch || undefined,
    limit: 200,
  }, {
    query: {
      queryKey: getListRuntimeLogsQueryKey(projectId, {
        level: levelFilter === "all" ? undefined : levelFilter,
        search: logSearch || undefined,
        limit: 200,
      }),
      refetchInterval: 10000,
    },
  });

  const simulateMutation = useSimulateRuntimeLogs({
    mutation: {
      onSuccess: (data) => {
        toast({ title: `Generated ${data.created} sample log entries` });
        queryClient.invalidateQueries({ queryKey: getListRuntimeLogsQueryKey(projectId) });
      },
    },
  });

  const clearMutation = useClearRuntimeLogs({
    mutation: {
      onSuccess: () => {
        toast({ title: "Logs cleared" });
        queryClient.invalidateQueries({ queryKey: getListRuntimeLogsQueryKey(projectId) });
      },
    },
  });

  const logs = logsQuery.data?.logs || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-2">
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-36 bg-card/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="success">Success</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={logSearch}
            onChange={e => setLogSearch(e.target.value)}
            className="pl-9 bg-card/50 border-border/50"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => simulateMutation.mutate({ projectId, data: { count: 30 } })}
            disabled={simulateMutation.isPending}
            className="gap-1.5 text-xs"
          >
            <Zap className="w-3.5 h-3.5" />
            {simulateMutation.isPending ? "..." : "Simulate"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => clearMutation.mutate({ projectId })}
            disabled={clearMutation.isPending}
            className="text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: getListRuntimeLogsQueryKey(projectId) })}
          >
            <RefreshCw className={`w-4 h-4 ${logsQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card/20">
        <CardContent className="p-0">
          <div className="bg-zinc-950 font-mono text-xs leading-relaxed h-[480px] overflow-y-auto rounded-xl">
            {logsQuery.isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <Terminal className="w-10 h-10 opacity-20" />
                <p className="text-sm">No logs found. Click Simulate to generate sample entries.</p>
              </div>
            ) : (
              <div className="p-4 space-y-0.5">
                {logs.map(log => {
                  const cfg = LOG_LEVEL_CONFIG[log.level as keyof typeof LOG_LEVEL_CONFIG] || LOG_LEVEL_CONFIG.info;
                  return (
                    <div key={log.id} className="flex gap-3 hover:bg-white/5 rounded px-2 py-0.5 transition-colors">
                      <span className="text-zinc-600 select-none w-20 flex-shrink-0 text-[11px] mt-0.5">
                        {format(new Date(log.createdAt), "HH:mm:ss.SSS")}
                      </span>
                      <span className={`w-14 flex-shrink-0 text-[10px] font-bold uppercase ${cfg.color}`}>
                        {log.level}
                      </span>
                      <span className="text-zinc-500 w-16 flex-shrink-0 text-[11px] truncate">{log.source || "app"}</span>
                      <span className={`flex-1 ${cfg.color} whitespace-pre-wrap break-all`}>{log.message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectMetricsTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const summaryQuery = useGetMetricsSummary(projectId, {}, {
    query: {
      queryKey: getGetMetricsSummaryQueryKey(projectId, {}),
      refetchInterval: 30000,
    },
  });
  const healthQuery = useGetProjectHealth(projectId);

  const simulateMutation = useSimulateMetrics({
    mutation: {
      onSuccess: () => {
        toast({ title: "Sample metrics generated" });
        queryClient.invalidateQueries({ queryKey: getGetMetricsSummaryQueryKey(projectId) });
      },
    },
  });

  const summary = summaryQuery.data;
  const isEmpty = !summary?.hasData;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => simulateMutation.mutate({ projectId, data: {} })}
          disabled={simulateMutation.isPending}
          className="gap-1.5 text-xs"
        >
          <Zap className="w-3.5 h-3.5" />
          {simulateMutation.isPending ? "Generating..." : "Generate Sample Data"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => queryClient.invalidateQueries({ queryKey: getGetMetricsSummaryQueryKey(projectId) })}
        >
          <RefreshCw className={`w-4 h-4 ${summaryQuery.isFetching ? "animate-spin" : ""}`} />
        </Button>
        {healthQuery.data && (
          <Badge variant="outline" className={`ml-auto gap-1.5 capitalize ${
            healthQuery.data.healthStatus === "healthy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            healthQuery.data.healthStatus === "warning" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
            healthQuery.data.healthStatus === "critical" ? "bg-red-500/10 text-red-400 border-red-500/20" :
            "bg-orange-500/10 text-orange-400 border-orange-500/20"
          }`}>
            {healthQuery.data.healthStatus}
          </Badge>
        )}
      </div>

      {isEmpty && !summaryQuery.isLoading && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          No metrics data yet. Click &quot;Generate Sample Data&quot; to simulate traffic metrics.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Requests / min", value: summary?.requestsPerMin, color: "text-blue-400" },
          { label: "Error Rate", value: summary?.errorRate, unit: "%", color: summary?.errorRate != null && summary.errorRate > 5 ? "text-red-400" : "text-emerald-400" },
          { label: "P95 Latency", value: summary?.p95LatencyMs, unit: "ms", color: summary?.p95LatencyMs != null && summary.p95LatencyMs > 500 ? "text-orange-400" : "text-cyan-400" },
          { label: "Active Sessions", value: summary?.activeSessions, color: "text-violet-400" },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="p-4 rounded-xl bg-white/5 border border-border/50">
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>
              {value == null || isEmpty
                ? <span className="text-muted-foreground text-xl">—</span>
                : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit || ""}`}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Uptime", value: summary?.uptimePct, unit: "%", color: "text-emerald-400" },
          { label: "Cold Starts", value: summary?.coldStarts, color: "text-amber-400" },
          { label: "Bandwidth", value: summary?.bandwidthKb, unit: " KB/s", color: "text-indigo-400" },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="p-4 rounded-xl bg-white/5 border border-border/50">
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>
              {value == null || isEmpty
                ? <span className="text-muted-foreground text-xl">—</span>
                : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit || ""}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationChannelCard({
  projectId,
  setting,
  updateMutation,
  deleteMutation,
}: {
  projectId: string;
  setting: NotificationSetting;
  updateMutation: ReturnType<typeof useUpdateNotificationSettings>;
  deleteMutation: ReturnType<typeof useDeleteNotificationSetting>;
}) {
  const events = setting.eventTypes || [];
  const hasStarted = events.includes("deploy_started");
  const hasSucceeded = events.includes("deploy_succeeded");
  const hasFailed = events.includes("deploy_failed");

  const channelLabel = (type: string) => {
    switch (type) {
      case "slack": return "Slack";
      case "discord": return "Discord";
      case "webhook": return "Webhook";
      default: return type;
    }
  };

  const toggleEvent = (event: UpdateNotificationSettingsBodyEventTypesItem, active: boolean) => {
    const current = new Set(events);
    if (active) {
      current.add(event);
    } else {
      current.delete(event);
    }
    updateMutation.mutate({
      projectId,
      data: {
        channelType: setting.channelType as UpdateNotificationSettingsBodyChannelType,
        webhookUrl: setting.webhookUrl || undefined,
        eventTypes: Array.from(current) as UpdateNotificationSettingsBodyEventTypesItem[],
        enabled: setting.enabled,
      },
    });
  };

  const toggleEnabled = (enabled: boolean) => {
    updateMutation.mutate({
      projectId,
      data: {
        channelType: setting.channelType as UpdateNotificationSettingsBodyChannelType,
        webhookUrl: setting.webhookUrl || undefined,
        eventTypes: events as UpdateNotificationSettingsBodyEventTypesItem[],
        enabled,
      },
    });
  };

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-border/50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{channelLabel(setting.channelType)}</Badge>
          {setting.channelType === "webhook" && setting.webhookUrl && (
            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{setting.webhookUrl}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{setting.enabled ? "Active" : "Disabled"}</span>
            <Switch
              checked={setting.enabled}
              onCheckedChange={toggleEnabled}
              disabled={updateMutation.isPending}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteMutation.mutate({ projectId, settingId: setting.id })}
            disabled={deleteMutation.isPending}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1 h-7 w-7 p-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Events:</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch
            checked={hasStarted}
            onCheckedChange={(v) => toggleEvent("deploy_started", v)}
            disabled={updateMutation.isPending}
            className="scale-75"
          />
          <span className="text-xs">Started</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch
            checked={hasSucceeded}
            onCheckedChange={(v) => toggleEvent("deploy_succeeded", v)}
            disabled={updateMutation.isPending}
            className="scale-75"
          />
          <span className="text-xs">Succeeded</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch
            checked={hasFailed}
            onCheckedChange={(v) => toggleEvent("deploy_failed", v)}
            disabled={updateMutation.isPending}
            className="scale-75"
          />
          <span className="text-xs">Failed</span>
        </label>
      </div>
    </div>
  );
}

function NotificationSettingsSection({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settingsData, isLoading } = useGetNotificationSettings(projectId);
  const { data: integrationsData } = useListIntegrations();

  const settings = settingsData?.settings || [];
  const integrations = integrationsData?.integrations || [];

  const slackIntegration = integrations.find((i: Integration) => i.provider === "slack" && i.status === "connected");
  const discordIntegration = integrations.find((i: Integration) => i.provider === "discord" && i.status === "connected");

  const configuredChannels = settings.map(s => s.channelType);
  const availableChannels: { value: UpdateNotificationSettingsBodyChannelType; label: string; disabled: boolean }[] = [
    { value: "slack", label: slackIntegration ? "Slack" : "Slack (not connected)", disabled: !slackIntegration || configuredChannels.includes("slack") },
    { value: "discord", label: discordIntegration ? "Discord" : "Discord (not connected)", disabled: !discordIntegration || configuredChannels.includes("discord") },
    { value: "webhook", label: configuredChannels.includes("webhook") ? "Custom Webhook (already added)" : "Custom Webhook URL", disabled: configuredChannels.includes("webhook") },
  ];

  const [addingChannel, setAddingChannel] = useState(false);
  const [newChannelType, setNewChannelType] = useState<UpdateNotificationSettingsBodyChannelType>("webhook");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newEventStarted, setNewEventStarted] = useState(true);
  const [newEventSucceeded, setNewEventSucceeded] = useState(true);
  const [newEventFailed, setNewEventFailed] = useState(true);

  const updateMutation = useUpdateNotificationSettings({
    mutation: {
      onSuccess: () => {
        toast({ title: "Notification channel saved" });
        queryClient.invalidateQueries({ queryKey: getGetNotificationSettingsQueryKey(projectId) });
        setAddingChannel(false);
        setNewWebhookUrl("");
      },
      onError: (err: Error) => toast({ title: "Failed to save", description: err?.message || "Unknown error", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteNotificationSetting({
    mutation: {
      onSuccess: () => {
        toast({ title: "Notification channel removed" });
        queryClient.invalidateQueries({ queryKey: getGetNotificationSettingsQueryKey(projectId) });
      },
      onError: (err: Error) => toast({ title: "Failed to remove", description: err?.message || "Unknown error", variant: "destructive" }),
    },
  });

  const testMutation = useTestNotification({
    mutation: {
      onSuccess: (data: TestNotificationResponse) => {
        if (data.success) {
          toast({ title: "Test notification sent!" });
        } else {
          toast({ title: "Test failed", description: data.error || "Could not deliver", variant: "destructive" });
        }
      },
      onError: (err: Error) => toast({ title: "Test failed", description: err?.message || "Unknown error", variant: "destructive" }),
    },
  });

  const handleAddChannel = () => {
    const eventTypes: UpdateNotificationSettingsBodyEventTypesItem[] = [];
    if (newEventStarted) eventTypes.push("deploy_started");
    if (newEventSucceeded) eventTypes.push("deploy_succeeded");
    if (newEventFailed) eventTypes.push("deploy_failed");

    updateMutation.mutate({
      projectId,
      data: {
        channelType: newChannelType,
        webhookUrl: newChannelType === "webhook" ? newWebhookUrl : undefined,
        eventTypes,
        enabled: true,
      },
    });
  };

  if (isLoading) {
    return <div className="h-20 bg-muted/20 animate-pulse rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      {settings.length > 0 && (
        <div className="space-y-4">
          {settings.map(setting => (
            <NotificationChannelCard
              key={setting.id}
              projectId={projectId}
              setting={setting}
              updateMutation={updateMutation}
              deleteMutation={deleteMutation}
            />
          ))}

          <Button
            variant="outline"
            onClick={() => testMutation.mutate({ projectId })}
            disabled={testMutation.isPending}
            className="gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {testMutation.isPending ? "Sending..." : "Send Test Notification"}
          </Button>
        </div>
      )}

      {settings.length === 0 && !addingChannel && (
        <div className="text-center py-8 text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No notification channels configured.</p>
          <p className="text-xs mt-1">Add a channel to get alerted on deploy events.</p>
        </div>
      )}

      {!addingChannel && availableChannels.some(c => !c.disabled) && (
        <Button variant="outline" onClick={() => setAddingChannel(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Channel
        </Button>
      )}

      {addingChannel && (
        <div className="space-y-4 max-w-xl p-4 rounded-lg border border-border/50 bg-white/[0.02]">
          <div className="space-y-2">
            <Label>Delivery Channel</Label>
            <Select value={newChannelType} onValueChange={(v) => setNewChannelType(v as UpdateNotificationSettingsBodyChannelType)}>
              <SelectTrigger className="bg-card/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableChannels.map(ch => (
                  <SelectItem key={ch.value} value={ch.value} disabled={ch.disabled}>
                    {ch.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newChannelType === "webhook" && (
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                placeholder="https://hooks.example.com/deploy"
                value={newWebhookUrl}
                onChange={e => setNewWebhookUrl(e.target.value)}
                className="bg-card/50 border-border/50"
              />
            </div>
          )}

          <div className="space-y-3">
            <Label>Event Types</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-border/50">
                <div>
                  <p className="text-sm font-medium">Deploy Started</p>
                  <p className="text-xs text-muted-foreground">Notify when a deployment begins</p>
                </div>
                <Switch checked={newEventStarted} onCheckedChange={setNewEventStarted} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-border/50">
                <div>
                  <p className="text-sm font-medium">Deploy Succeeded</p>
                  <p className="text-xs text-muted-foreground">Notify when a deployment completes successfully</p>
                </div>
                <Switch checked={newEventSucceeded} onCheckedChange={setNewEventSucceeded} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-border/50">
                <div>
                  <p className="text-sm font-medium">Deploy Failed</p>
                  <p className="text-xs text-muted-foreground">Notify when a deployment fails</p>
                </div>
                <Switch checked={newEventFailed} onCheckedChange={setNewEventFailed} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleAddChannel}
              disabled={updateMutation.isPending || (newChannelType === "webhook" && !newWebhookUrl)}
            >
              {updateMutation.isPending ? "Saving..." : "Save Channel"}
            </Button>
            <Button variant="ghost" onClick={() => setAddingChannel(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectIntegrationsTab() {
  const INTEGRATION_PROVIDERS = [
    { provider: "github", label: "GitHub", description: "Repository hosting and CI/CD" },
    { provider: "cloudflare", label: "Cloudflare", description: "CDN, DNS, and edge network" },
    { provider: "slack", label: "Slack", description: "Team notifications and alerts" },
    { provider: "sentry", label: "Sentry", description: "Error tracking and monitoring" },
    { provider: "supabase", label: "Supabase", description: "Postgres database and auth" },
    { provider: "s3", label: "S3 / R2", description: "Object storage for assets" },
    { provider: "discord", label: "Discord", description: "Community and deployment alerts" },
    { provider: "posthog", label: "PostHog", description: "Product analytics and feature flags" },
  ];

  return (
    <Card className="border-border/50 bg-card/30">
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Connect third-party services to extend your project. Integrations are configured at the account level and apply to all projects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {INTEGRATION_PROVIDERS.map(p => (
            <div key={p.provider} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-border/50">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold uppercase text-muted-foreground">
                {p.provider.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-xs text-muted-foreground truncate">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
        <Link href="/integrations">
          <Button className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Manage Integrations
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
