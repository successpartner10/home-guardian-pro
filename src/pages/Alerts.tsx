import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Check, Trash2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Alert = Tables<"alerts"> & { devices?: { name: string } | null };

const Alerts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*, devices(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setAlerts(data as Alert[]);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel("alerts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts", filter: `user_id=eq.${user.id}` }, (payload) => {
        setAlerts((prev) => [payload.new as Alert, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("alerts").update({ viewed: true }).eq("id", id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, viewed: true } : a)));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("alerts").update({ viewed: true }).eq("user_id", user.id).eq("viewed", false);
    setAlerts((prev) => prev.map((a) => ({ ...a, viewed: true })));
  };

  const deleteAllAlerts = async () => {
    if (!user || alerts.length === 0) return;
    if (!confirm("Are you sure you want to delete all events? This cannot be undone.")) return;

    const { error } = await supabase.from("alerts").delete().eq("user_id", user.id);
    if (!error) {
      setAlerts([]);
      toast({ title: "History Cleared", description: "All events have been deleted." });
    }
  };

  const deleteAlert = async (id: string) => {
    await supabase.from("alerts").delete().eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Events</h1>
            <p className="text-sm text-muted-foreground">Recent motion & sound activity</p>
          </div>
          <div className="flex gap-2">
            {alerts.some((a) => !a.viewed) && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-2 h-9">
                <Check className="h-4 w-4" /> Mark all read
              </Button>
            )}
            {alerts.length > 0 && (
              <Button variant="outline" size="sm" onClick={deleteAllAlerts} className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-2 h-9">
                <Trash2 className="h-4 w-4" /> Clear All
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse bg-card/40 border-border/50">
                <CardContent className="p-0 flex h-24">
                  <div className="w-32 bg-muted h-full" />
                  <div className="flex-1 p-4 space-y-2">
                    <div className="h-4 w-1/2 bg-muted rounded" />
                    <div className="h-3 w-1/4 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted/50 border border-dashed border-border/50 shadow-inner">
              <BellOff className="h-10 w-10 text-muted-foreground opacity-30" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Safe & Sound</h2>
              <p className="text-sm text-muted-foreground max-w-[200px]">No security events have been detected yet.</p>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <Card
                    className={cn(
                      "group overflow-hidden border-border/50 transition-all duration-300 hover:shadow-lg hover:border-primary/20",
                      !alert.viewed ? "bg-primary/5 border-primary/20" : "bg-card/40 backdrop-blur-sm"
                    )}
                  >
                    <CardContent className="p-0 flex flex-col sm:flex-row items-stretch">
                      {/* Thumbnail Container */}
                      <div className="relative w-full sm:w-40 aspect-video sm:aspect-auto bg-muted shrink-0 overflow-hidden">
                        {alert.thumbnail_url ? (
                          <img
                            src={alert.thumbnail_url}
                            alt="Motion Capture"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-muted-foreground/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:hidden" />
                      </div>

                      {/* Info Container */}
                      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              {!alert.viewed && <span className="h-2 w-2 rounded-full bg-primary" />}
                              <p className="text-sm font-bold uppercase tracking-wider text-foreground/80">
                                {alert.type === 'motion' ? 'Motion Detected' : 'Sound Detected'}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium truncate">
                              {(alert as any).devices?.name || "Unknown Device"}
                            </p>
                          </div>
                          <span className="text-[10px] whitespace-nowrap font-bold text-muted-foreground uppercase opacity-60">
                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/10 sm:border-0 sm:mt-0 sm:pt-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                            onClick={() => markAsRead(alert.id)}
                            disabled={alert.viewed}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> {alert.viewed ? 'Read' : 'Mark Read'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAlert(alert.id)}
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Alerts;
