import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Github, Box, Search } from "lucide-react";
import { useListProjects } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { FrameworkIcon } from "@/components/ui/framework-icon";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectsMutations } from "@/hooks/use-projects-mutations";

export default function Projects() {
  const { data, isLoading } = useListProjects();
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const projects = data?.projects || [];
  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <ProtectedLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage your applications and deployments.</p>
          </div>
          <CreateProjectDialog />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search projects..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 max-w-md bg-card/50 border-border/50 focus-visible:ring-primary/20"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted/30 animate-pulse rounded-xl" />)}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border/50 rounded-2xl bg-card/10">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
              <Box className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {search ? "No projects match your search criteria." : "Get started by creating your first project and deploying your code."}
            </p>
            {!search && <CreateProjectDialog />}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map(project => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover-elevate cursor-pointer transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm group h-full flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
                        <FrameworkIcon framework={project.framework} />
                      </div>
                      <StatusBadge status={project.latestDeploymentStatus} />
                    </div>
                    <CardTitle className="mt-4 text-xl group-hover:text-primary transition-colors">{project.name}</CardTitle>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Github className="w-3 h-3 mr-1" />
                      <span className="truncate">{project.repoUrl || 'No repository'}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    <div className="flex justify-between items-center text-xs border-t border-border/50 pt-4 mt-2">
                      <span className="text-muted-foreground">{project.framework}</span>
                      <span className="text-muted-foreground">
                        {project.updatedAt ? formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true }) : 'Never deployed'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}

function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [framework, setFramework] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const { createProject, isCreating } = useProjectsMutations();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !framework) return;
    try {
      const res = await createProject({ data: { name, framework, repoUrl } });
      setOpen(false);
      setLocation(`/projects/${res.id}`);
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-md shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Configure your new project. We'll set up the environment automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="my-awesome-app" required className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="framework">Framework</Label>
            <Select value={framework} onValueChange={setFramework} required>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select a framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Next.js">Next.js</SelectItem>
                <SelectItem value="React">React</SelectItem>
                <SelectItem value="Vue">Vue</SelectItem>
                <SelectItem value="Nuxt">Nuxt</SelectItem>
                <SelectItem value="SvelteKit">SvelteKit</SelectItem>
                <SelectItem value="Node API">Node API</SelectItem>
                <SelectItem value="Static Site">Static Site</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="repo">Repository URL (Optional)</Label>
            <Input id="repo" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/user/repo" className="bg-background" />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isCreating || !name || !framework} className="w-full">
              {isCreating ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
