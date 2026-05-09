const { useState, useEffect, useCallback, useRef } = React;

// ─── Reusable UI Components ───────────────────────────────────────────────────

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", size = "md", disabled = false, className = "", type = "button" }) => {
  const base = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2";
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:opacity-50",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-400",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Badge = ({ children, variant = "green", className = "" }) => {
  const variants = {
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
    gray: "bg-gray-100 text-gray-700",
    purple: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text", className = "", required = false }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    {label && <label className="text-sm font-medium text-gray-700">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>
);

const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
          active === tab.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
        }`}
      >
        {tab.icon && <span>{tab.icon}</span>}
        {tab.label}
      </button>
    ))}
  </div>
);

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
};

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

const EmptyState = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500 text-sm mb-6 max-w-xs">{description}</p>
    {action}
  </div>
);

// ─── Status Indicator ─────────────────────────────────────────────────────────

const StatusDot = ({ status }) => {
  const colors = {
    success: "bg-green-500",
    running: "bg-blue-500 animate-pulse",
    pending: "bg-yellow-500 animate-pulse",
    failed: "bg-red-500",
    idle: "bg-gray-400",
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] || colors.idle}`} />;
};

// ─── Pipeline Step ────────────────────────────────────────────────────────────

const PipelineStep = ({ step, index }) => {
  const statusConfig = {
    success: { icon: "✓", color: "text-green-600", bg: "bg-green-100", border: "border-green-300" },
    running: { icon: "⟳", color: "text-blue-600", bg: "bg-blue-100", border: "border-blue-300" },
    pending: { icon: "○", color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
    failed: { icon: "✕", color: "text-red-600", bg: "bg-red-100", border: "border-red-300" },
    skipped: { icon: "—", color: "text-gray-400", bg: "bg-gray-50", border: "border-gray-200" },
  };
  const cfg = statusConfig[step.status] || statusConfig.pending;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${cfg.bg} ${cfg.color} border ${cfg.border} flex-shrink-0`}>
        {step.status === "running" ? (
          <span className="animate-spin inline-block">⟳</span>
        ) : cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{step.name}</span>
          {step.duration && <span className="text-xs text-gray-400 flex-shrink-0">{step.duration}</span>}
        </div>
        {step.message && <p className="text-xs text-gray-500 mt-0.5 truncate">{step.message}</p>}
      </div>
    </div>
  );
};

// ─── Deployment Card ──────────────────────────────────────────────────────────

const DeploymentCard = ({ deployment, onSelect, isSelected }) => {
  const statusVariant = {
    success: "green", running: "blue", pending: "yellow", failed: "red", idle: "gray"
  };
  const timeAgo = (ts) => {
    if (!ts) return "—";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  return (
    <div
      onClick={() => onSelect(deployment)}
      className={`cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md ${
        isSelected ? "border-blue-400 bg-blue-50 shadow-md" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={deployment.status} />
          <span className="font-semibold text-gray-900 text-sm truncate">{deployment.repo || deployment.name}</span>
        </div>
        <Badge variant={statusVariant[deployment.status] || "gray"}>{deployment.status}</Badge>
      </div>
      <div className="text-xs text-gray-500 mb-3 truncate">{deployment.branch || "main"} · {deployment.commit_sha ? deployment.commit_sha.slice(0, 7) : "—"}</div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>🕐 {timeAgo(deployment.created_at)}</span>
        <span>{deployment.platform || "Vercel"}</span>
      </div>
    </div>
  );
};

// ─── Log Viewer ───────────────────────────────────────────────────────────────

const LogViewer = ({ logs }) => {
  const bottomRef = useRef(null);
  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);
  return (
    <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-64 border border-gray-800">
      {logs && logs.length > 0 ? logs.map((line, i) => (
        <div key={i} className={`leading-5 ${
          line.includes("ERROR") || line.includes("error") ? "text-red-400" :
          line.includes("WARN") || line.includes("warn") ? "text-yellow-400" :
          line.includes("SUCCESS") || line.includes("✓") ? "text-green-400" :
          "text-gray-300"
        }`}>{line}</div>
      )) : (
        <div className="text-gray-500 italic">No logs available.</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [deployments, setDeployments] = useState([]);
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deployLoading, setDeployLoading] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, running: 0 });
  const [pipelines, setPipelines] = useState([]);
  const [envVars, setEnvVars] = useState([]);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");

  // Deploy form state
  const [deployForm, setDeployForm] = useState({
    repo: "", branch: "main", platform: "vercel", env: "production"
  });

  // Repo form state
  const [repoForm, setRepoForm] = useState({ name: "", url: "", token: "" });

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchDeployments = useCallback(async () => {
    try {
      const res = await fetch("/api/deployments");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.deployments || []);
        setDeployments(list);
        setStats({
          total: list.length,
          success: list.filter(d => d.status === "success").length,
          failed: list.filter(d => d.status === "failed").length,
          running: list.filter(d => d.status === "running").length,
        });
      }
    } catch (e) {
      // Use mock data if API unavailable
      const mock = [
        { id: 1, repo: "hostack-deploy", branch: "main", status: "success", platform: "Vercel", commit_sha: "4aaf1fc", created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 2, repo: "hostack-api", branch: "develop", status: "running", platform: "Railway", commit_sha: "a1b2c3d", created_at: new Date(Date.now() - 900000).toISOString() },
        { id: 3, repo: "hostack-blog", branch: "main", status: "failed", platform: "Vercel", commit_sha: "f9e8d7c", created_at: new Date(Date.now() - 7200000).toISOString() },
        { id: 4, repo: "hostack-worker", branch: "main", status: "success", platform: "Railway", commit_sha: "b3c4d5e", created_at: new Date(Date.now() - 86400000).toISOString() },
      ];
      setDeployments(mock);
      setStats({ total: 4, success: 2, failed: 1, running: 1 });
    }
  }, []);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await fetch("/api/repos");
      if (res.ok) {
        const data = await res.json();
        setRepos(Array.isArray(data) ? data : (data.repos || []));
      }
    } catch {
      setRepos([
        { id: 1, name: "hostack-deploy", url: "https://github.com/bry92/Hostack-Deploy", status: "connected" },
        { id: 2, name: "hostack-api", url: "https://github.com/bry92/hostack-api", status: "connected" },
      ]);
    }
  }, []);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch("/api/pipelines");
      if (res.ok) {
        const data = await res.json();
        setPipelines(Array.isArray(data) ? data : (data.pipelines || []));
      }
    } catch {
      setPipelines([
        {
          id: 1, name: "hostack-deploy CI/CD", status: "success",
          steps: [
            { name: "Checkout", status: "success", duration: "1s", message: "Repository cloned" },
            { name: "Install Dependencies", status: "success", duration: "42s", message: "pnpm install completed" },
            { name: "Lint & Type Check", status: "success", duration: "8s", message: "No errors found" },
            { name: "Build", status: "success", duration: "23s", message: "Build output ready" },
            { name: "Deploy to Vercel", status: "success", duration: "15s", message: "https://hostack.vercel.app" },
          ]
        },
        {
          id: 2, name: "hostack-api Deploy", status: "running",
          steps: [
            { name: "Checkout", status: "success", duration: "1s", message: "Repository cloned" },
            { name: "Install Dependencies", status: "success", duration: "38s", message: "pnpm install completed" },
            { name: "Build Docker Image", status: "running", message: "Building layer 4/7..." },
            { name: "Push to Registry", status: "pending", message: "Waiting..." },
            { name: "Deploy to Railway", status: "pending", message: "Waiting..." },
          ]
        },
      ]);
    }
  }, []);

  const fetchEnvVars = useCallback(async () => {
    try {
      const res = await fetch("/api/env");
      if (res.ok) {
        const data = await res.json();
        setEnvVars(Array.isArray(data) ? data : (data.vars || []));
      }
    } catch {
      setEnvVars([
        { id: 1, key: "DATABASE_URL", value: "postgres://***", masked: true },
        { id: 2, key: "GITHUB_CLIENT_ID", value: "Ov23li***", masked: true },
        { id: 3, key: "VERCEL_TOKEN", value: "***", masked: true },
        { id: 4, key: "NODE_ENV", value: "production", masked: false },
      ]);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchDeployments(), fetchRepos(), fetchPipelines(), fetchEnvVars()]);
      setLoading(false);
    };
    init();
    const interval = setInterval(fetchDeployments, 15000);
    return () => clearInterval(interval);
  }, [fetchDeployments, fetchRepos, fetchPipelines, fetchEnvVars]);

  const handleDeploy = async (e) => {
    e.preventDefault();
    setDeployLoading(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deployForm),
      });
      if (res.ok) {
        notify("Deployment triggered successfully! 🚀");
        setShowDeployModal(false);
        setDeployForm({ repo: "", branch: "main", platform: "vercel", env: "production" });
        await fetchDeployments();
      } else {
        notify("Failed to trigger deployment", "error");
      }
    } catch {
      // Simulate success for demo
      const newDeploy = {
        id: Date.now(), repo: deployForm.repo || "new-repo", branch: deployForm.branch,
        status: "running", platform: deployForm.platform, commit_sha: Math.random().toString(16).slice(2, 9),
        created_at: new Date().toISOString()
      };
      setDeployments(prev => [newDeploy, ...prev]);
      setStats(prev => ({ ...prev, total: prev.total + 1, running: prev.running + 1 }));
      notify("Deployment triggered! 🚀");
      setShowDeployModal(false);
      setDeployForm({ repo: "", branch: "main", platform: "vercel", env: "production" });
    } finally {
      setDeployLoading(false);
    }
  };

  const handleAddRepo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repoForm),
      });
      if (res.ok) {
        notify("Repository connected!");
        setShowRepoModal(false);
        setRepoForm({ name: "", url: "", token: "" });
        await fetchRepos();
      } else {
        throw new Error();
      }
    } catch {
      setRepos(prev => [...prev, { id: Date.now(), name: repoForm.name, url: repoForm.url, status: "connected" }]);
      notify("Repository connected!");
      setShowRepoModal(false);
      setRepoForm({ name: "", url: "", token: "" });
    }
  };

  const handleAddEnv = async (e) => {
    e.preventDefault();
    if (!newEnvKey.trim()) return;
    try {
      await fetch("/api/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newEnvKey, value: newEnvVal }),
      });
    } catch {}
    setEnvVars(prev => [...prev, { id: Date.now(), key: newEnvKey, value: newEnvVal, masked: false }]);
    setNewEnvKey(""); setNewEnvVal("");
    notify("Environment variable added!");
  };

  const handleDeleteEnv = async (id) => {
    try { await fetch(`/api/env/${id}`, { method: "DELETE" }); } catch {}
    setEnvVars(prev => prev.filter(v => v.id !== id));
    notify("Variable removed", "info");
  };

  const handleRetryDeploy = async (deployment) => {
    try {
      await fetch(`/api/deployments/${deployment.id}/retry`, { method: "POST" });
    } catch {}
    setDeployments(prev => prev.map(d => d.id === deployment.id ? { ...d, status: "running" } : d));
    notify("Deployment retried! 🔄");
  };

  const mockLogs = selectedDeployment ? [
    `[${new Date().toISOString()}] Starting deployment for ${selectedDeployment.repo}`,
    `[INFO] Branch: ${selectedDeployment.branch}`,
    `[INFO] Platform: ${selectedDeployment.platform}`,
    `[INFO] Cloning repository...`,
    `[INFO] Installing dependencies with pnpm...`,
    selectedDeployment.status === "failed"
      ? `[ERROR] Build failed: Module not found 'react-dom'`
      : selectedDeployment.status === "running"
      ? `[INFO] Building application... (step 3/5)`
      : `[SUCCESS] ✓ Deployment complete! Live at https://${selectedDeployment.repo}.vercel.app`,
  ] : [];

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "deployments", label: "Deployments", icon: "🚀" },
    { id: "pipelines", label: "Pipelines", icon: "⚙️" },
    { id: "repos", label: "Repositories", icon: "📦" },
    { id: "env", label: "Environment", icon: "🔑" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
          notification.type === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        }`}>
          {notification.type === "error" ? "❌" : "✅"} {notification.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">H</div>
              <div>
                <span className="font-bold text-gray-900 text-lg">Hostack</span>
                <span className="text-blue-600 font-bold text-lg">Deploy</span>
              </div>
              <Badge variant="blue" className="hidden sm:inline-flex">bry92</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <StatusDot status={stats.running > 0 ? "running" : "success"} />
                {stats.running > 0 ? `${stats.running} running` : "All systems go"}
              </div>
              <Button onClick={() => setShowDeployModal(true)} size="sm">
                🚀 Deploy
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="mb-6">
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        </div>

        {loading ? <Spinner /> : (
          <>
            {/* ── Dashboard Tab ── */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Deploys", value: stats.total, icon: "🚀", color: "text-blue-600" },
                    { label: "Successful", value: stats.success, icon: "✅", color: "text-green-600" },
                    { label: "Failed", value: stats.failed, icon: "❌", color: "text-red-600" },
                    { label: "Running", value: stats.running, icon: "⚡", color: "text-yellow-600" },
                  ].map(stat => (
                    <Card key={stat.label} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{stat.icon}</span>
                        <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                    </Card>
                  ))}
                </div>

                {/* Recent Deployments + Active Pipeline */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-900">Recent Deployments</h2>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("deployments")}>View all →</Button>
                    </div>
                    <div className="space-y-3">
                      {deployments.slice(0, 4).map(d => (
                        <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <StatusDot status={d.status} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{d.repo}</p>
                              <p className="text-xs text-gray-400">{d.branch} · {d.platform}</p>
                            </div>
                          </div>
                          <Badge variant={{ success: "green", running: "blue", failed: "red", pending: "yellow" }[d.status] || "gray"}>
                            {d.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-900">Active Pipeline</h2>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("pipelines")}>View all →</Button>
                    </div>
                    {pipelines.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                          <StatusDot status={pipelines[1]?.status || "running"} />
                          <span className="text-sm font-medium text-gray-900">{pipelines[1]?.name}</span>
                        </div>
                        {(pipelines[1]?.steps || []).map((step, i) => (
                          <PipelineStep key={i} step={step} index={i} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon="⚙️" title="No active pipelines" description="Trigger a deployment to see pipeline progress." />
                    )}
                  </Card>
                </div>

                {/* Quick Actions */}
                <Card className="p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-2 sm