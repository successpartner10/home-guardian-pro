import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Check, Trash2, AlertTriangle, X, Maximize2, Share2 } from "lucide-react";
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
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

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

  const shareAlert = async (alert: Alert) => {
    const shareData: ShareData = {
      title: `hGuard Security Alert`,
      text: `Alert from ${alert.devices?.name || "Camera"}: ${alert.type.includes('motion') ? 'Motion' : 'Sound'} detected at ${new Date(alert.created_at).toLocaleString()}.`,
      url: alert.thumbnail_url || window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url!);
        toast({ title: "Link Copied", description: "Alert link copied to clipboard." });
      }
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Events</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest opacity-60">Security Timeline</p>
          </div>
          <div className="flex gap-2">
            {alerts.some((a) => !a.viewed) && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-2 h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                <Check className="h-4 w-4" /> All Read
              </Button>
            )}
            {alerts.length > 0 && (
              <Button variant="outline" size="sm" onClick={deleteAllAlerts} className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-2 h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse bg-card/40 border-border/50 rounded-3xl h-24" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted/50 border border-dashed border-border/50 shadow-inner">
              <BellOff className="h-10 w-10 text-muted-foreground opacity-30" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold uppercase tracking-tight">Safe & Sound</h2>
              <p className="text-sm text-muted-foreground max-w-[200px] uppercase font-bold text-[10px] tracking-widest opacity-40">No activity detected.</p>
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
                      "group overflow-hidden border-2 transition-all duration-300 rounded-[2rem]",
                      !alert.viewed ? "bg-primary/5 border-primary/20 shadow-lg shadow-primary/10" : "bg-card/40 border-border/40 backdrop-blur-sm"
                    )}
                  >
                    <CardContent className="p-0 flex flex-col sm:flex-row items-stretch">
                      {/* Thumbnail Container */}
                      <div
                        className="relative w-full sm:w-40 aspect-video sm:aspect-auto bg-black shrink-0 overflow-hidden cursor-pointer group/thumb"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        {alert.thumbnail_url ? (
                          <img
                            src={alert.thumbnail_url}
                            alt="Motion Capture"
                            className="h-full w-full object-cover transition-transform duration-700 group-hover/thumb:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-muted-foreground/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="text-white w-8 h-8" />
                        </div>
                      </div>

                      {/* Info Container */}
                      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              {!alert.viewed && <span className="h-2 w-2 rounded-full bg-primary" />}
                              <p className="text-sm font-black uppercase tracking-tight text-foreground/80">
                                {alert.type.includes('motion') ? 'Motion Detected' : 'Sound Detected'}
                              </p>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60 truncate">
                              {(alert as any).devices?.name || "Unknown Device"}
                            </p>
                          </div>
                          <span className="text-[9px] whitespace-nowrap font-black text-muted-foreground uppercase opacity-40 tracking-widest">
                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/10 sm:border-0 sm:mt-0 sm:pt-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary transition-colors border-2 border-transparent hover:border-primary/20"
                            onClick={() => shareAlert(alert)}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors border-2 border-transparent hover:border-primary/20"
                            onClick={() => markAsRead(alert.id)}
                            disabled={alert.viewed}
                          >
                            <Check className="h-3.5 w-3.5 mr-1.5" /> {alert.viewed ? 'Read' : 'Mark Read'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAlert(alert.id)}
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all border-2 border-transparent hover:border-destructive/30"
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

      {/* Alert Detail Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 bg-black/95 backdrop-blur-xl"
            onClick={() => setSelectedAlert(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-5xl w-full aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border-2 border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedAlert.thumbnail_url ? (
                <img
                  src={selectedAlert.thumbnail_url}
                  alt="Full Alert"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white/20">
                  <AlertTriangle className="w-20 h-20" />
                  <p className="text-xl font-black uppercase tracking-widest">Image missing</p>
                </div>
              )}

              <div className="absolute top-6 right-6 flex gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-2xl bg-black/40 border-2 border-white/20 hover:bg-white/10 hover:border-white/40 text-white backdrop-blur-md"
                  onClick={() => setSelectedAlert(null)}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black via-black/60 to-transparent">
                <div className="flex items-end justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-2">Security Event Log</p>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                      {selectedAlert.type.includes('motion') ? 'Motion' : 'Sound'} Detected
                    </h2>
                    <p className="text-lg font-bold text-white/60 tracking-tight">
                      {(selectedAlert as any).devices?.name || "Unknown Camera"} · {new Date(selectedAlert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="h-14 px-6 rounded-2xl font-black uppercase tracking-widest bg-white/5 border-2 border-white/10 hover:bg-white/10 text-white"
                      onClick={() => shareAlert(selectedAlert)}
                    >
                      <Share2 className="h-5 w-5" />
                    </Button>
                    <Button
                      className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest bg-white text-black hover:bg-white/80"
                      onClick={() => {
                        if (selectedAlert.thumbnail_url) {
                          const link = document.createElement('a');
                          link.href = selectedAlert.thumbnail_url;
                          link.download = `alert-${selectedAlert.id}.jpg`;
                          link.click();
                        }
                      }}
                    >
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default Alerts;
