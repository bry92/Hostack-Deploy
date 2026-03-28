import { useState, useEffect, useRef } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { AppPage, AppPageHeader, AppPageSection } from "@/components/layout/app-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListProjects,
  useListRuntimeLogs,
  useSimulateRuntimeLogs,
  useClearRuntimeLogs,
  getListRuntimeLogsQueryKey,
  type RuntimeLog,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Search, Terminal, RefreshCw, Radio, Trash2, Zap, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const LEVEL_CONFIG = {
  error: { color: "text-red-400", bg: "bg-red-500/10", icon: AlertCircle, label: "Error" },
  warn: { color: "text-yellow-400", bg: "bg-yellow-500/10", icon: AlertTriangle, label: "Warn" },
  info: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Info, label: "Info" },
  debug: { color: "text-zinc-400", bg: "bg-zinc-500/10", icon: Bug, label: "Debug" },
  success: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Zap, label: "Success" },
};

function LiveTailBadge() {
  return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-400 animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping absolute" />
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      Live
    </span>
  );
}

export default function LogsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [isLiveTail, setIsLiveTail] = useState(false);
  const [streamLogs, setStreamLogs] = useState<RuntimeLog[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: projectsData } = useListProjects();
  const projects = projectsData?.projects || [];

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].id);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const logsQuery = useListRuntimeLogs(selectedProject, {
    level: levelFilter === "all" ? undefined : levelFilter,
    search: debouncedSearch || undefined,
    limit: 200,
  }, {
    query: {
      queryKey: getListRuntimeLogsQueryKey(selectedProject, {
        level: levelFilter === "all" ? undefined : levelFilter,
        search: debouncedSearch || undefined,
        limit: 200,
      }),
      enabled: !!selectedProject && !isLiveTail,
      refetchInterval: 5000,
    },
  });

  const simulateMutation = useSimulateRuntimeLogs({
    mutation: {
      onSuccess: (data) => {
        toast({ title: `Generated ${data.created} sample log entries` });
        queryClient.invalidateQueries({ queryKey: getListRuntimeLogsQueryKey(selectedProject) });
      },
      onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
    },
  });

  const clearMutation = useClearRuntimeLogs({
    mutation: {
      onSuccess: () => {
        toast({ title: "Logs cleared" });
        setStreamLogs([]);
        queryClient.invalidateQueries({ queryKey: getListRuntimeLogsQueryKey(selectedProject) });
      },
      onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
    },
  });

  useEffect(() => {
    if (!isLiveTail || !selectedProject) return;

    const es = new EventSource(`/api/projects/${selectedProject}/runtime-logs/stream`, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "log" && msg.data) {
          setStreamLogs(prev => [...prev.slice(-500), msg.data]);
        }
      } catch {
        // Ignore malformed stream payloads from the demo event source.
      }
    };

    es.onerror = () => {
      setIsLiveTail(false);
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [isLiveTail, selectedProject]);

  useEffect(() => {
    if (isLiveTail && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamLogs, isLiveTail]);

  useEffect(() => {
    if (!isLiveTail && esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, [isLiveTail]);

  useEffect(() => {
    setStreamLogs([]);
  }, [selectedProject]);

  const displayLogs = isLiveTail ? streamLogs : (logsQuery.data?.logs || []);
  const filteredLogs = isLiveTail && levelFilter !== "all"
    ? displayLogs.filter(l => l.level === levelFilter)
    : displayLogs;

  const errorCount = displayLogs.filter(l => l.level === "error").length;
  const warnCount = displayLogs.filter(l => l.level === "warn").length;

  return (
    <ProtectedLayout>
      <AppPage>
        <AppPageHeader
          eyebrow="Observability"
          icon={<Terminal className="h-5 w-5" />}
          title="Runtime Logs"
          description="Tail live application output, filter noisy history, and isolate runtime failures without leaving the control plane."
          actions={
            <div className="flex items-center gap-2">
              {errorCount > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
                  {errorCount} errors
                </Badge>
              )}
              {warnCount > 0 && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                  {warnCount} warnings
                </Badge>
              )}
            </div>
          }
        />

        <AppPageSection className="gap-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setStreamLogs([]); setIsLiveTail(false); }}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-full md:w-36">
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
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isLiveTail ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsLiveTail(v => !v)}
              disabled={!selectedProject}
              className={isLiveTail ? "gap-2 border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15" : "gap-2"}
            >
              <Radio className="w-4 h-4" />
              {isLiveTail ? <LiveTailBadge /> : "Live Tail"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: getListRuntimeLogsQueryKey(selectedProject) })}
              disabled={!selectedProject || isLiveTail}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => simulateMutation.mutate({ projectId: selectedProject, data: { count: 30 } })}
              disabled={!selectedProject || simulateMutation.isPending}
              className="gap-1.5 text-xs"
              title="Generate sample logs"
            >
              <Zap className="w-3.5 h-3.5" />
              {simulateMutation.isPending ? "..." : "Simulate"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => clearMutation.mutate({ projectId: selectedProject })}
              disabled={!selectedProject || clearMutation.isPending}
              className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                {isLiveTail ? "Live Stream" : "Log History"}
                {selectedProject && (
                  <span className="text-xs font-normal text-zinc-400">
                    — {projects.find(p => p.id === selectedProject)?.name}
                  </span>
                )}
              </span>
              {isLiveTail && (
                <span className="relative flex items-center gap-1.5 text-xs text-violet-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
                  Streaming live
                </span>
              )}
              {!isLiveTail && !logsQuery.isLoading && (
                <span className="text-xs font-normal text-zinc-400">{filteredLogs.length} entries</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[580px] overflow-y-auto rounded-b-xl bg-black font-mono text-sm leading-relaxed text-green-400">
              {!selectedProject ? (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  Select a project to view logs
                </div>
              ) : logsQuery.isLoading && !isLiveTail ? (
                <div className="flex h-full items-center justify-center gap-2 text-zinc-500">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading logs...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
                  <Terminal className="w-10 h-10 opacity-20" />
                  <div className="text-center">
                    <p className="font-medium mb-1">{isLiveTail ? "Waiting for log entries..." : "No logs found"}</p>
                    <p className="text-xs opacity-70">
                      {isLiveTail
                        ? "New entries will appear here as they arrive"
                        : "Click Simulate to generate sample runtime logs"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-0.5">
                  {filteredLogs.map((log) => {
                    const cfg = LEVEL_CONFIG[log.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.info;
                    return (
                      <div key={log.id} className="group flex gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-zinc-900">
                        <span className="mt-0.5 w-20 flex-shrink-0 select-none text-[11px] text-zinc-600">
                          {format(new Date(log.createdAt), "HH:mm:ss.SSS")}
                        </span>
                        <span className={`flex w-14 flex-shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
                          {log.level}
                        </span>
                        <span className="mt-0.5 w-16 flex-shrink-0 truncate text-[11px] text-zinc-500">
                          {log.source || "app"}
                        </span>
                        <span className={`flex-1 ${cfg.color} whitespace-pre-wrap break-all`}>
                          {log.message}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </AppPageSection>
      </AppPage>
    </ProtectedLayout>
  );
}
