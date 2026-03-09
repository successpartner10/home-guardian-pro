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

type Alert = Tables<"alerts"> & { devices?: { name: string } | null };

const Alerts = () => {
  const { user } = useAuth();
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

  const deleteAlert = async (id: string) => {
    await supabase.from("alerts").delete().eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Alerts</h1>
          {alerts.some((a) => !a.viewed) && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-2">
              <Check className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse bg-card/50">
                <CardContent className="p-4"><div className="h-12 rounded bg-muted" /></CardContent>
              </Card>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <BellOff className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">No alerts</h2>
            <p className="text-sm text-muted-foreground">Motion alerts will appear here.</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                layout
              >
                <Card className={`border-border/50 transition-colors ${!alert.viewed ? "bg-primary/5 border-primary/20" : "bg-card/80"}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${!alert.viewed ? "bg-primary/10" : "bg-muted"}`}>
                      <AlertTriangle className={`h-5 w-5 ${!alert.viewed ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Motion Detected</p>
                      <p className="text-xs text-muted-foreground">
                        {(alert as any).devices?.name || "Camera"} · {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {!alert.viewed && (
                        <Button variant="ghost" size="icon" onClick={() => markAsRead(alert.id)} className="h-8 w-8">
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => deleteAlert(alert.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </AppLayout>
  );
};

export default Alerts;
