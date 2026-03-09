import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Camera, Wifi, WifiOff, Video } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

type Device = Tables<"devices">;

const statusConfig = {
  online: { icon: Wifi, color: "bg-green-500", label: "Online", className: "status-online" },
  offline: { icon: WifiOff, color: "bg-muted-foreground", label: "Offline", className: "" },
  recording: { icon: Video, color: "bg-destructive", label: "Recording", className: "status-recording" },
};

const Dashboard = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [devicesRes, alertsRes] = await Promise.all([
        supabase.from("devices").select("*").order("created_at", { ascending: false }),
        supabase.from("alerts").select("id", { count: "exact" }).eq("viewed", false),
      ]);
      if (devicesRes.data) setDevices(devicesRes.data);
      if (alertsRes.count != null) setUnreadAlerts(alertsRes.count);
      setLoading(false);
    };

    fetchData();

    // Real-time subscription for device status changes
    const channel = supabase
      .channel("devices-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "UPDATE") {
          setDevices((prev) => prev.map((d) => (d.id === (payload.new as Device).id ? (payload.new as Device) : d)));
        } else if (payload.eventType === "INSERT") {
          setDevices((prev) => [payload.new as Device, ...prev]);
        } else if (payload.eventType === "DELETE") {
          setDevices((prev) => prev.filter((d) => d.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <AppLayout>
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cameras</h1>
            {unreadAlerts > 0 && (
              <Link to="/alerts">
                <Badge variant="destructive" className="mt-1">{unreadAlerts} unread alert{unreadAlerts > 1 ? "s" : ""}</Badge>
              </Link>
            )}
          </div>
          <Link to="/pair">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Device
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse bg-card/50">
                <CardContent className="p-4">
                  <div className="aspect-video rounded-lg bg-muted" />
                  <div className="mt-3 h-4 w-24 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : devices.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Camera className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">No cameras yet</h2>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Add a device to start monitoring. You can turn any old phone into a security camera.
            </p>
            <Link to="/pair">
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add Your First Camera</Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence>
              {devices.map((device) => {
                const status = statusConfig[device.status];
                const StatusIcon = status.icon;
                return (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                  >
                    <Link to={device.type === "camera" ? `/camera/${device.id}` : `/live/${device.id}`}>
                      <Card className={`group cursor-pointer border-border/50 bg-card/80 transition-all hover:border-primary/30 ${status.className}`}>
                        <CardContent className="p-4">
                          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted/50">
                            <div className="flex h-full items-center justify-center">
                              <Camera className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                            <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-1 text-xs backdrop-blur-sm">
                              <span className={`h-2 w-2 rounded-full ${status.color} ${device.status === "recording" ? "animate-pulse" : ""}`} />
                              {status.label}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{device.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{device.type}</p>
                            </div>
                            <StatusIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
