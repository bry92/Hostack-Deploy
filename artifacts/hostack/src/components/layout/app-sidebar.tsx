import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FolderGit2, 
  Activity, 
  Settings, 
  LogOut,
  ChevronRight,
  Boxes,
  Plug,
  Terminal,
  BarChart3
} from "lucide-react";
import { useAuth } from "@workspace/auth-web";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderGit2 },
  { title: "Deployments", url: "/deployments", icon: Activity },
  { title: "Logs", url: "/logs", icon: Terminal },
  { title: "Metrics", url: "/metrics", icon: BarChart3 },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="h-16 flex items-center px-4 border-b border-border/50">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Boxes className="w-5 h-5" />
          </div>
          Hostack
        </div>
      </SidebarHeader>

      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || location.startsWith(`${item.url}/`);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className="font-medium hover-elevate active-elevate-2 transition-all duration-200"
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon className="w-4 h-4 opacity-70" />
                        <span>{item.title}</span>
                        {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={user?.profileImage ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate">{user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : user?.email?.split('@')[0] || 'User'}</span>
            <span className="text-xs text-muted-foreground truncate">{user?.email || 'Developer'}</span>
          </div>
        </div>
        <button 
          onClick={() => logout()}
          className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors hover:bg-white/5"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
