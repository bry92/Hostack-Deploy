import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@workspace/auth-web";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Deployments from "@/pages/deployments";
import DeploymentDetail from "@/pages/deployment-detail";
import Settings from "@/pages/settings";
import Integrations from "@/pages/integrations";
import Logs from "@/pages/logs";
import Metrics from "@/pages/metrics";
import AuthCallback from "@/pages/auth-callback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/projects/:projectId/deployments/:id" component={DeploymentDetail} />
      <Route path="/deployments" component={Deployments} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/logs" component={Logs} />
      <Route path="/metrics" component={Metrics} />
      <Route path="/settings" component={Settings} />
      <Route path="/callback" component={AuthCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
