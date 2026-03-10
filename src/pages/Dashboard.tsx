import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Wifi, WifiOff, Video, MonitorSmartphone, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Device = Tables<"devices">;

const statusConfig = {
  online: { icon: Wifi, color: "bg-green-500", label: "Online", className: "status-online" },
  offline: { icon: WifiOff, color: "bg-muted-foreground", label: "Offline", className: "" },
  recording: { icon: Video, color: "bg-destructive", label: "Recording", className: "status-recording" },
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [devicesRes, alertsRes] = await Promise.all([
        supabase.from("devices").select("*").order("created_at", { ascending: false }),
        supabase.from("alerts").select("id", { count: "exact" }).eq("viewed", false),
      ]);

      // Auto-cleanup stale pairing codes from the DB query results since we no longer use them
      // In a real app we would drop the column, but for now we just don't display/use them.
      if (devicesRes.data) {
        // Only show cameras in the dashboard list, not viewers
        setDevices(devicesRes.data.filter(d => d.type === 'camera'));
      }
      if (alertsRes.count != null) setUnreadAlerts(alertsRes.count);
      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel("devices-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "UPDATE") {
          setDevices((prev) => prev.map((d) => (d.id === (payload.new as Device).id ? (payload.new as Device) : d)).filter(d => d.type === 'camera'));
        } else if (payload.eventType === "INSERT") {
          const newDevice = payload.new as Device;
          if (newDevice.type === 'camera') {
            setDevices((prev) => [newDevice, ...prev]);
          }
        } else if (payload.eventType === "DELETE") {
          setDevices((prev) => prev.filter((d) => d.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleUseAsCamera = async () => {
    if (!user) return;
    setRegistering(true);

    // Check if we already have a camera registered for this specific session/browser to avoid duplicates
    const deviceName = `${navigator.platform} Camera`;

    // In a real device, we'd use a unique hardware ID. For web, we'll just create a new one every time 
    // or try to find an existing offline one with the same name.

    const { data: existingDevice } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('name', deviceName)
      .eq('type', 'camera')
      .limit(1)
      .single();

    if (existingDevice) {
      navigate(`/camera/${existingDevice.id}`);
      return;
    }

    // Register this device as a new camera
    const { data, error } = await supabase.from("devices").insert({
      user_id: user.id,
      name: deviceName,
      type: "camera" as const,
      status: "online" as const,
      // pairing_code is required by DB schema currently but ignored in UI
      pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase()
    }).select().single();

    if (error) {
      toast({ title: "Error", description: "Failed to initialize camera mode.", variant: "destructive" });
      setRegistering(false);
    } else if (data) {
      navigate(`/camera/${data.id}`);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-8 max-w-7xl mx-auto">

        {/* Alfred-Style Mode Selector */}
        <div className="bg-card/40 border border-border/40 backdrop-blur-xl rounded-2xl p-6 glass-panel relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">How do you want to use this device?</h2>
              <p className="text-muted-foreground max-w-lg">
                You are securely logged in. Choose whether this device acts as the Viewer monitor, or if it should become a security Camera.
              </p>
            </div>

            <div className="flex w-full md:w-auto gap-4">
              <Button
                variant="outline"
                className="flex-1 md:flex-none h-14 px-6 gap-3 bg-background/50 backdrop-blur-md border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all text-base"
                disabled={true} // Already in Viewer mode technically by being on Dashboard
              >
                <MonitorSmartphone className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">Viewer Mode</span>
              </Button>

              <Button
                className="flex-1 md:flex-none h-14 px-6 gap-3 shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)] transition-all text-base"
                onClick={handleUseAsCamera}
                disabled={registering}
              >
                {registering ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <Smartphone className="h-5 w-5" />
                )}
                <span className="font-semibold">Use as Camera</span>
              </Button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Your Cameras</h1>
            {unreadAlerts > 0 && (
              <Link to="/alerts">
                <Badge variant="destructive" className="mt-1 shadow-[0_0_15px_hsl(var(--destructive)/0.3)] px-3 py-1">
                  {unreadAlerts} unread alert{unreadAlerts > 1 ? "s" : ""}
                </Badge>
              </Link>
            )}
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse bg-card/40 border-border/30 glass-panel">
                  <CardContent className="p-0">
                    <div className="aspect-video bg-muted/30" />
                    <div className="p-4">
                      <div className="h-4 w-24 rounded bg-muted/50" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : devices.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-20 px-4 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 glow-primary border border-primary/20">
                <Camera className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">No cameras connected</h2>
              <p className="text-muted-foreground max-w-sm">
                Log in with the same account on an old phone or tablet, and select <strong className="text-foreground">"Use as Camera"</strong> to see it here automatically.
              </p>
            </motion.div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {devices.map((device) => {
                  const status = statusConfig[device.status];
                  const StatusIcon = status.icon;
                  return (
                    <motion.div
                      key={device.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.3 }}
                      layout
                    >
                      <Link to={`/live/${device.id}`}>
                        <Card className={`group cursor-pointer overflow-hidden border-border/40 glass-panel transition-all duration-300 hover:border-primary/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:glow-primary ${status.className}`}>
                          <div className="relative aspect-video bg-black/40 overflow-hidden">
                            {/* Simulated premium gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

                            <div className="absolute inset-0 flex items-center justify-center">
                              <Camera className="h-12 w-12 text-white/10 group-hover:scale-110 transition-transform duration-500" />
                            </div>

                            <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-2.5 py-1 text-xs backdrop-blur-md shadow-sm">
                              <span className={`h-2 w-2 rounded-full ${status.color} ${device.status === "recording" ? "animate-pulse" : ""}`} />
                              <span className="text-white font-medium tracking-wide">{status.label}</span>
                            </div>

                            <div className="absolute left-3 top-3 z-20">
                              <Badge variant="outline" className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 backdrop-blur-md transition-colors font-semibold tracking-wide shadow-[0_0_10px_hsl(var(--primary)/0.2)]">
                                PREMIUM FREE
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-4 bg-card/40 backdrop-blur-sm border-t border-border/30">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-lg tracking-tight group-hover:text-primary transition-colors">{device.name}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-0.5">{device.type}</p>
                              </div>
                              <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                                <StatusIcon className={`h-4 w-4 ${device.status === 'online' ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>
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
      </div>
    </AppLayout>
  );
};

export default Dashboard;
