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
import { cn } from "@/lib/utils";
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

  const handleUseAsViewer = async () => {
    if (!user) return;
    setRegistering(true);

    const deviceName = `${navigator.platform} Viewer`;

    // Check for existing viewer
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('name', deviceName)
      .eq('type', 'viewer')
      .limit(1)
      .single();

    if (existingDevice) {
      await supabase.from("devices").update({ status: 'online' }).eq('id', existingDevice.id);
      toast({ title: "Viewer Active", description: "You are now monitoring cameras." });
      setRegistering(false);
      return;
    }

    // Register this device as a new viewer
    const { error } = await supabase.from("devices").insert({
      user_id: user.id,
      name: deviceName,
      type: "viewer" as const,
      status: "online" as const,
      pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase()
    });

    if (error) {
      toast({ title: "Error", description: "Failed to initialize viewer mode.", variant: "destructive" });
    } else {
      toast({ title: "Viewer Active", description: "You are now monitoring cameras." });
    }
    setRegistering(false);
  };

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
      await supabase.from("devices").update({ status: 'online' }).eq('id', existingDevice.id);
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

        {/* ZoomOn-Style Mode Selector */}
        <div className="zoomon-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-primary/30 transition-colors duration-700" />

          <div className="flex flex-col xl:flex-row items-center justify-between gap-8 relative z-10">
            <div className="text-center xl:text-left space-y-3">
              <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Setup Mode</h2>
              <p className="text-lg text-muted-foreground max-w-xl font-medium">
                Choose how this device should operate in your secure network.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-5">
              <Button
                size="lg"
                className="zoomon-btn-large flex-1 sm:min-w-[240px] bg-primary/20 hover:bg-primary/30 border-2 border-primary text-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)]"
                onClick={handleUseAsViewer}
                disabled={registering}
              >
                <MonitorSmartphone className="h-7 w-7" />
                <span className="text-xl">USE AS VIEWER</span>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="zoomon-btn-large flex-1 sm:min-w-[240px] bg-muted/30 border-2 border-border/50 hover:bg-muted/50"
                onClick={handleUseAsCamera}
                disabled={registering}
              >
                {registering ? (
                  <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                ) : (
                  <Camera className="h-7 w-7 text-muted-foreground" />
                )}
                <span className="text-xl">USE AS CAMERA</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black tracking-tighter uppercase">My Cameras</h1>
            {unreadAlerts > 0 && (
              <Link to="/alerts">
                <Badge variant="destructive" className="h-10 px-5 text-sm font-black rounded-full shadow-lg shadow-destructive/30">
                  {unreadAlerts} NEW EVENTS
                </Badge>
              </Link>
            )}
          </div>

          {loading ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="zoomon-card animate-pulse h-64 bg-muted/20" />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 py-24 px-4 text-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 glow-primary border-2 border-primary/20">
                <Camera className="h-14 w-14 text-primary" />
              </div>
              <h2 className="text-3xl font-black tracking-tighter uppercase">No Active Cameras</h2>
              <p className="text-xl text-muted-foreground max-w-md font-medium leading-relaxed">
                Connect your first device by selecting <span className="text-primary">"Use as Camera"</span> on another phone.
              </p>
            </motion.div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {devices.map((device) => {
                  const status = statusConfig[device.status];
                  const StatusIcon = status.icon;
                  return (
                    <motion.div
                      key={device.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      layout
                    >
                      <Link to={`/live/${device.id}`}>
                        <Card className={`group relative zoomon-card cursor-pointer overflow-hidden border-2 transition-all duration-300 hover:border-primary px-0 py-0 ${status.className}`}>
                          <div className="relative aspect-video bg-black overflow-hidden rounded-t-[1.8rem]">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />

                            <div className="absolute inset-0 flex items-center justify-center">
                              <Camera className="h-16 w-16 text-white/5 group-hover:text-primary/20 transition-colors duration-500" />
                            </div>

                            <div className="absolute right-4 top-4 z-20">
                              <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black uppercase backdrop-blur-xl border-2 shadow-xl ${device.status === 'online' ? 'bg-green-500/80 border-green-400' : 'bg-black/60 border-white/20'}`}>
                                <span className={`h-3 w-3 rounded-full ${status.color} ${device.status === "recording" ? "animate-pulse" : ""}`} />
                                <span className="text-white">{status.label}</span>
                              </div>
                            </div>
                          </div>

                          <CardContent className="p-6">
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <h3 className="text-2xl font-black tracking-tighter uppercase truncate group-hover:text-primary transition-colors">{device.name}</h3>
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">High Quality Stream</p>
                              </div>
                              <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center border-2 border-border/20 group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                                <StatusIcon className={cn("h-7 w-7 transition-colors", device.status === 'online' ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary-foreground")} />
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
