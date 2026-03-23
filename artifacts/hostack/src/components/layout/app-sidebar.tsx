import { Link, useLocation } from "wouter";
import {
  Activity,
  BarChart3,
  FileText,
  FolderGit2,
  Gauge,
  Globe,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
} from "lucide-react";
import { useAuth } from "@workspace/auth-web";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type NavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  url?: string;
};

const coreItems: NavItem[] = [
  { label: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", url: "/projects", icon: FolderGit2 },
  { label: "Deployments", url: "/deployments", icon: Activity },
  { label: "Logs", url: "/logs", icon: FileText },
  { label: "Observability", url: "/metrics", icon: BarChart3 },
];

const futureItems: NavItem[] = [
  { label: "Analytics", icon: BarChart3 },
  { label: "Speed Insights", icon: Gauge },
];

const infrastructureItems: NavItem[] = [
  { label: "Integrations", url: "/integrations", icon: Globe },
  { label: "Domains", icon: Globe },
  { label: "Firewall", icon: Shield },
];

const footerItems: NavItem[] = [{ label: "Settings", url: "/settings", icon: Settings }];

function isActivePath(location: string, url?: string): boolean {
  if (!url) return false;
  return location === url || location.startsWith(`${url}/`);
}

function NavItemRow({
  active = false,
  disabled = false,
  icon: Icon,
  label,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <div
      className={[
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "border border-zinc-700/70 bg-zinc-900/80 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100",
        disabled
          ? "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-zinc-500"
          : "",
      ].join(" ")}
    >
      <Icon size={16} />
      <span className="truncate">{label}</span>
      {disabled ? <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-500">Soon</span> : null}
    </div>
  );
}

function SidebarSection({
  items,
  location,
  title,
}: {
  items: NavItem[];
  location: string;
  title: string;
}) {
  return (
    <div>
      <p className="mb-2 px-3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = isActivePath(location, item.url);
          const disabled = !item.url;

          if (!item.url) {
            return (
              <NavItemRow
                key={item.label}
                disabled={disabled}
                icon={item.icon}
                label={item.label}
              />
            );
          }

          return (
            <Link key={item.label} href={item.url}>
              <NavItemRow active={active} icon={item.icon} label={item.label} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  const displayName =
    user?.firstName && user?.firstName.trim()
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
      : user?.email?.split("@")[0] || "Operator";

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/98 text-white md:flex">
      <div className="flex h-14 items-center border-b border-zinc-800 px-4">
        <Link href="/dashboard" className="font-semibold tracking-tight text-white">
          Hostack
        </Link>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
        <SidebarSection items={coreItems} location={location} title="Core" />
        <SidebarSection items={futureItems} location={location} title="Insights" />
        <SidebarSection items={infrastructureItems} location={location} title="Infrastructure" />
      </div>

      <div className="border-t border-zinc-800 p-2">
        <nav className="space-y-1">
          {footerItems.map((item) => (
            <Link key={item.label} href={item.url!}>
              <NavItemRow active={isActivePath(location, item.url)} icon={item.icon} label={item.label} />
            </Link>
          ))}
        </nav>

        <div className="mt-3 flex items-center gap-3 rounded-md border border-zinc-800/80 bg-zinc-900/40 px-3 py-3">
          <Avatar className="h-9 w-9 border border-zinc-800">
            <AvatarImage src={user?.profileImage ?? undefined} />
            <AvatarFallback className="bg-zinc-800 text-zinc-100">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-100">{displayName}</p>
            <p className="truncate text-xs text-zinc-500">{user?.email || "hostack operator"}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

export const mobileNavItems = [
  { label: "Overview", url: "/dashboard" },
  { label: "Projects", url: "/projects" },
  { label: "Deployments", url: "/deployments" },
  { label: "Logs", url: "/logs" },
  { label: "Observability", url: "/metrics" },
];
