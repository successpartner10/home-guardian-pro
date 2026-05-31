import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Camera, Bell, Settings, LogOut, Shield, Users, HelpCircle, Brain, Menu, X, ChevronRight, Archive, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { motion, AnimatePresence } from "framer-motion";

const ADMIN_EMAIL = "successpartner10@gmail.com";

// Bottom-nav primary items (always visible)
const bottomNavItems = [
  { to: "/dashboard", icon: Camera, label: "Cameras" },
  { to: "/archive", icon: Bell, label: "Events" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/help", icon: HelpCircle, label: "Help" },
];

// Collapsible side-menu extra items
const menuItems = [
  { to: "/users", icon: Users, label: "Users & Access", adminOnly: true },
  { to: "/ai-lab", icon: Brain, label: "AI Lab", adminOnly: true },
  { to: "/archive", icon: Archive, label: "Recording Archive" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isDashboard = location.pathname === "/" || location.pathname === "/dashboard";
  const isAdmin = user?.email === ADMIN_EMAIL;

  const filteredMenu = menuItems.filter(item => !item.adminOnly || isAdmin);
  const filteredBottom = bottomNavItems;

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── HEADER ── */}
      {isDashboard ? (
        // Dashboard: big centered logo
        <header className="glass-panel sticky top-0 z-50 flex h-20 items-center justify-center px-6 border-b border-white/5 relative">
          <Link to="/dashboard" className="flex items-center justify-center gap-3">
            <Logo size="lg" className="h-12 w-12" />
            <span className="text-2xl font-black tracking-tight text-white">
              HGUARD <span className="text-primary">Elite</span>
            </span>
          </Link>
          {/* Sign out */}
          <button
            onClick={signOut}
            className="absolute right-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white transition-all"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>
      ) : (
        // Other pages: compact top-left logo + hamburger menu
        <header className="glass-panel sticky top-0 z-50 flex h-14 items-center px-4 border-b border-white/5 gap-3">
          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white transition-all"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <Logo size="sm" className="h-7 w-7" />
            <span className="text-base font-black tracking-tight text-white">
              HGUARD <span className="text-primary">Elite</span>
            </span>
          </Link>

          {/* Page title pill */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[9px] font-bold text-white/20 tracking-widest hidden sm:block">
              {(window as any).hGuard_Version || "v2.6.0"}
            </span>
            <button
              onClick={signOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}

      {/* ── SLIDE-OUT MENU ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-zinc-950 border-r border-white/8 flex flex-col p-6 safe-area-pt"
            >
              {/* Menu header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2.5">
                  <Logo size="sm" className="h-8 w-8" />
                  <div>
                    <p className="text-sm font-black text-white leading-none">HGUARD Elite</p>
                    <p className="text-[9px] text-primary font-bold mt-0.5">{isAdmin ? "Administrator" : "Viewer"}</p>
                  </div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Menu items */}
              <div className="space-y-1.5 flex-1">
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest px-2 mb-3">Navigation</p>
                {filteredMenu.map(({ to, icon: Icon, label }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group",
                      location.pathname === to
                        ? "bg-primary/10 text-primary"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-semibold">{label}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 opacity-30 group-hover:opacity-60" />
                  </Link>
                ))}

                {/* AI Lab promo pill for admins */}
                {isAdmin && (
                  <div className="mt-4 p-3 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wide">AI Lab Active</span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-snug">Thermal vision & mesh tracking are live. View proposals for upcoming features.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-white/5">
                <button
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-semibold">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 pb-24">{children}</main>

      {/* ── BOTTOM NAVIGATION ── */}
      <nav 
        className="glass-panel fixed bottom-0 left-0 right-0 z-40 grid h-18 items-center px-2 safe-area-pb border-t border-white/5"
        style={{ gridTemplateColumns: `repeat(${filteredBottom.length}, minmax(0, 1fr))` }}
      >
        {filteredBottom.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to || (to === "/dashboard" && location.pathname === "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all",
                active ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-white/5"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "glow-primary")} />
              <span className={cn("text-[9px] font-bold tracking-tight uppercase", active ? "opacity-100" : "opacity-70")}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default AppLayout;
