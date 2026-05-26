import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Camera, Bell, Settings, LogOut, Shield, Users, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const ADMIN_EMAIL = "successpartner10@gmail.com";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/users", icon: Users, label: "Users", adminOnly: true },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/help", icon: HelpCircle, label: "Help" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user } = useAuth();
  const location = useLocation();

  const filteredItems = navItems.filter(item => !item.adminOnly || user?.email === ADMIN_EMAIL);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="glass-panel sticky top-0 z-50 flex h-20 items-center justify-between px-6 border-b border-white/5">
        <Link to="/dashboard" className="flex items-center gap-3">
          <Logo size="sm" className="h-10" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest hidden sm:block">
            { (window as any).hGuard_Version || "v2.5.2" }
          </span>
          <button onClick={signOut} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white transition-all border border-white/5">
            <LogOut className="h-6 w-6" />
          </button>
        </div>
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
            "Settings": "Setup",
            "Help": "Help"
          }[label] || label;

          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all duration-200 px-1 py-1.5 rounded-xl w-full h-full",
                active ? "text-primary bg-primary/10 scale-105" : "text-muted-foreground hover:bg-muted/30"
              )}
            >
              <Icon className={cn("h-6 w-6", active && "glow-primary")} />
              <span className={cn("text-[9px] font-black tracking-tighter uppercase truncate w-full text-center", active ? "opacity-100" : "opacity-90")}>
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
