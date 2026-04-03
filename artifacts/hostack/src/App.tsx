import { type ComponentType, useEffect, useRef } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@workspace/auth-web";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import About from "@/pages/about";
import Blog from "@/pages/blog";
import Careers from "@/pages/careers";
import Pricing from "@/pages/pricing";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Deployments from "@/pages/deployments";
import DeploymentDetail from "@/pages/deployment-detail";
import Settings from "@/pages/settings";
import Integrations from "@/pages/integrations";
import Logs from "@/pages/logs";
import Metrics from "@/pages/metrics";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Product from "@/pages/product";
import Features from "@/pages/features";
import Compare from "@/pages/compare";
import Pricing from "@/pages/pricing";
import Changelog from "@/pages/changelog";
import Resources from "@/pages/resources";
import Docs, {
  DocsGettingStarted,
  DocsGitHub,
  DocsDeployments,
  DocsDomains,
  DocsSshKeys,
  DocsEnvVars,
  DocsPreview,
  DocsRollback,
  DocsIntegrations,
} from "@/pages/docs";
import GitHubPage from "@/pages/github";
import Status from "@/pages/status";
import Company from "@/pages/company";
import BlogPost from "@/pages/blog-post";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/blog" component={Blog} />
      <Route path="/careers" component={Careers} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/product" component={Product} />
      <Route path="/features" component={Features} />
      <Route path="/compare" component={Compare} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/changelog" component={Changelog} />
      <Route path="/resources" component={Resources} />
      <Route path="/docs" component={Docs} />
      <Route path="/docs/getting-started" component={DocsGettingStarted} />
      <Route path="/docs/github" component={DocsGitHub} />
      <Route path="/docs/deployments" component={DocsDeployments} />
      <Route path="/docs/domains" component={DocsDomains} />
      <Route path="/docs/ssh-keys" component={DocsSshKeys} />
      <Route path="/docs/env-vars" component={DocsEnvVars} />
      <Route path="/docs/preview" component={DocsPreview} />
      <Route path="/docs/rollback" component={DocsRollback} />
      <Route path="/docs/integrations" component={DocsIntegrations} />
      <Route path="/github" component={GitHubPage} />
      <Route path="/status" component={Status} />
      <Route path="/company" component={Company} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/projects">{() => <ProtectedRoute component={Projects} />}</Route>
      <Route path="/projects/:id">{() => <ProtectedRoute component={ProjectDetail} />}</Route>
      <Route path="/projects/:projectId/deployments/:id">
        {() => <ProtectedRoute component={DeploymentDetail} />}
      </Route>
      <Route path="/deployments">{() => <ProtectedRoute component={Deployments} />}</Route>
      <Route path="/integrations">{() => <ProtectedRoute component={Integrations} />}</Route>
      <Route path="/logs">{() => <ProtectedRoute component={Logs} />}</Route>
      <Route path="/metrics">{() => <ProtectedRoute component={Metrics} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthQueryReset() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading, user } = useAuth();
  const previousIdentityRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const nextIdentity = isAuthenticated ? (user?.id ?? "__authenticated__") : null;

    if (previousIdentityRef.current === undefined) {
      previousIdentityRef.current = nextIdentity;
      return;
    }

    if (previousIdentityRef.current !== nextIdentity) {
      queryClient.clear();
      previousIdentityRef.current = nextIdentity;
    }
  }, [isAuthenticated, isLoading, queryClient, user?.id]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthQueryReset />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
