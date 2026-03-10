import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Camera, Bell, Settings, LogOut, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "successpartner10@gmail.com";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/camera", icon: Camera, label: "Camera" },
  { to: "/alerts", icon: Bell, label: "Events" },
  { to: "/users", icon: Users, label: "Users", adminOnly: true },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user } = useAuth();
  const location = useLocation();

  const filteredItems = navItems.filter(item => !item.adminOnly || user?.email === ADMIN_EMAIL);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="glass-panel sticky top-0 z-50 flex h-14 items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/logo.png" alt="hGuard Logo" className="h-8 w-8 object-contain rounded-lg" />
          <span className="text-xl font-black text-foreground tracking-tighter uppercase">hGuard</span>
        </Link>
        <button onClick={signOut} className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-24">{children}</main>

      {/* Bottom navigation */}
      <nav className={cn(
        "glass-panel fixed bottom-0 left-0 right-0 z-50 grid h-20 items-center px-1 safe-area-pb",
        filteredItems.length === 5 ? "grid-cols-5" : "grid-cols-4"
      )}>
        {filteredItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          const shortLabel = {
            "Dashboard": "Home",
            "Camera": "Live",
            "Events": "Alerts",
            "Users": "Admin",
            "Settings": "Setup"
          }[label] || label;

          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 px-1 py-1.5 rounded-xl",
                active ? "text-primary bg-primary/10 scale-105" : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-6 w-6", active && "glow-primary")} />
              <span className={cn("text-[9px] font-black tracking-tighter uppercase truncate w-full text-center", active ? "opacity-100" : "opacity-60")}>
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default AppLayout;
