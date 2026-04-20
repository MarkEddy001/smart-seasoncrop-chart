import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Sprout, LogOut, Leaf } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { signOut, role, fullName, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/fields", label: "Fields", icon: Sprout },
  ] as const;

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
          <Leaf className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold tracking-tight">SmartSeason</div>
          <div className="text-xs text-muted-foreground capitalize">
            {role?.replace("_", " ") ?? "Field Monitoring"}
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const active = location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 space-y-3">
        <div className="text-sm">
          <div className="font-medium truncate">{fullName || user?.email}</div>
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
