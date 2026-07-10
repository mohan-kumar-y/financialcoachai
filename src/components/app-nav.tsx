import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Map,
  CreditCard,
  Target,
  TrendingUp,
  TrendingDown,
  LineChart,
  ListChecks,
  Briefcase,
  LogOut,
  MessagesSquare,
  Telescope,
  Activity,
  Siren,
  Newspaper,
  Layers,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const PRIMARY: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/research", label: "Research", icon: MessagesSquare },
  { to: "/discover", label: "Discover", icon: Telescope },
  { to: "/health", label: "Health", icon: Activity },
  { to: "/alerts", label: "Alerts", icon: Siren },
];

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Intelligence",
    items: [
      { to: "/brief", label: "Daily Brief", icon: Newspaper },
      { to: "/signals", label: "Sell Signals", icon: TrendingDown },
      { to: "/funds", label: "Fund Analyzer", icon: Layers },
      { to: "/advisor", label: "Advisor", icon: Briefcase },
    ],
  },
  {
    label: "Planning",
    items: [
      { to: "/spending", label: "Spending", icon: CreditCard },
      { to: "/blueprints", label: "Blueprints", icon: Map },
      { to: "/projections", label: "Projections", icon: LineChart },
      { to: "/goals", label: "Goals", icon: Target },
      { to: "/playbook", label: "Playbook", icon: ListChecks },
    ],
  },
];

export function AppNav({ displayName }: { displayName?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 glass">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-foreground">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-gold text-gold-foreground">
            <TrendingUp className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">WealthOS</span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {PRIMARY.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}

          {GROUPS.map((group) => {
            const active = group.items.some((i) => i.to === pathname);
            return (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {group.label}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                  {group.items.map((item) => (
                    <DropdownMenuItem key={item.to} asChild>
                      <Link to={item.to} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {displayName && (
            <span className="hidden max-w-[120px] truncate text-sm text-muted-foreground lg:inline">
              {displayName}
            </span>
          )}
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
