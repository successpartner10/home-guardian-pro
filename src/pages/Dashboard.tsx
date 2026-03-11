import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Wifi, WifiOff, Video, MonitorSmartphone, LayoutGrid, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
      console.log("[Dashboard] Fetching devices and alerts...");
      const [devicesRes, alertsRes] = await Promise.all([
        supabase.from("devices").select("*").order("created_at", { ascending: false }),
        supabase.from("alerts").select("id", { count: "exact" }).eq("viewed", false),
      ]);

      if (devicesRes.error) {
        console.error("[Dashboard] Device fetch error:", devicesRes.error);
        toast({ title: "Sync Error", description: "Failed to load devices.", variant: "destructive" });
      }

      console.log(`[Dashboard] Found ${devicesRes.data?.length || 0} total devices raw.`);
      if (devicesRes.data) {
        const cameras = devicesRes.data.filter(d => d.type === 'camera');
        console.log(`[Dashboard] Filters to ${cameras.length} cameras.`, cameras);
        setDevices(cameras);
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

  const getOrCreateDeviceId = () => {
    let id = localStorage.getItem("hguard_device_persistent_id");
    if (!id) {
      id = Math.random().toString(36).substring(2, 12);
      localStorage.setItem("hguard_device_persistent_id", id);
    }
    return id;
  };

  const handleUseAsViewer = async () => {
    if (!user) return;
    setRegistering(true);

    const persistentId = getOrCreateDeviceId();
    const deviceName = `${navigator.platform} Viewer (${persistentId.slice(0, 4)})`;

    // Check for existing viewer by persistent metadata or specific name
    const { data: existingDevice } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('name', deviceName)
      .eq('type', 'viewer')
      .maybeSingle();

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

    const persistentId = getOrCreateDeviceId();
    const deviceName = `${navigator.platform} Camera (${persistentId.slice(0, 4)})`;

    const { data: existingDevice } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('name', deviceName)
      .eq('type', 'camera')
      .maybeSingle();

    if (existingDevice) {
      supabase.from("devices").update({ status: 'online' }).eq('id', existingDevice.id);
      navigate(`/camera/${existingDevice.id}`);
      return;
    }

    setRegistering(true);
    const { data, error } = await supabase.from("devices").insert({
      user_id: user.id,
      name: deviceName,
      type: "camera" as const,
      status: "online" as const,
      pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase()
    }).select().single();

    if (error) {
      toast({ title: "Error", description: "Failed to initialize camera mode.", variant: "destructive" });
      setRegistering(false);
    } else if (data) {
      navigate(`/camera/${data.id}`);
    }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("devices").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Device Removed", description: `${name} has been deleted.` });
      setDevices(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error("Error deleting device:", error);
      toast({ title: "Error", description: "Failed to delete device.", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-3 space-y-4 max-w-7xl mx-auto">

        {/* ZoomOn-Style Mode Selector */}
        <div className="zoomon-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-primary/30 transition-colors duration-700" />

          <div className="flex flex-col xl:flex-row items-center justify-between gap-4 relative z-10">
            <div className="text-center xl:text-left space-y-1">
              <h2 className="text-xl font-black tracking-tighter uppercase leading-none">Setup Mode</h2>
              <p className="text-sm text-muted-foreground max-w-xl font-medium">
                Choose how this device should operate.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-5">
              <Button
                size="sm"
                className="zoomon-btn-large flex-1 sm:min-w-[200px] bg-primary/20 hover:bg-primary/30 border-2 border-primary text-primary shadow-lg instant-hover"
                onClick={handleUseAsViewer}
                disabled={registering}
              >
                <MonitorSmartphone className="h-5 w-5" />
                <span className="text-base uppercase">Viewer Mode</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="zoomon-btn-large flex-1 sm:min-w-[200px] bg-muted/30 border-2 border-border/50 hover:bg-muted/50 instant-hover"
                onClick={handleUseAsCamera}
                disabled={registering}
              >
                {registering ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-base uppercase">Camera Mode</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black tracking-tighter uppercase">My Cameras</h1>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setLoading(true);
                  // Trigger effect again or just call fetchData manually if it was closure-scoped
                  // Actually easier to just refresh the page or recall logic.
                  window.location.reload();
                }}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary transition-colors"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              {devices.length > 1 && (
                <Link to="/live/all">
                  <Button variant="outline" size="sm" className="hidden sm:flex gap-2 h-8 rounded-full font-bold uppercase text-[10px] tracking-widest border-primary/50 text-primary hover:bg-primary/10 transition-colors">
                    <LayoutGrid className="h-4 w-4" /> Watch All Live
                  </Button>
                  <Button variant="outline" size="icon" className="sm:hidden h-8 w-8 rounded-full border-primary/50 text-primary hover:bg-primary/10 transition-colors">
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              {unreadAlerts > 0 && (
                <Link to="/alerts">
                  <Badge variant="destructive" className="h-8 px-3 text-[10px] font-black rounded-full shadow-lg">
                    {unreadAlerts} NEW
                  </Badge>
                </Link>
              )}
            </div>
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
                      <div className="relative group/device">
                        <Link to={`/live/${device.id}`}>
                          <Card className={`group relative zoomon-card cursor-pointer overflow-hidden border-2 transition-all duration-300 hover:border-primary px-0 py-0 ${status.className}`}>
                            <div className="relative aspect-video bg-black overflow-hidden rounded-t-[1.8rem]">
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />

                              <div className="absolute inset-0 flex items-center justify-center">
                                <Camera className="h-16 w-16 text-white/5 group-hover:text-primary/20 transition-colors duration-500" />
                              </div>

                              <div className="absolute right-4 top-4 z-20 flex gap-2">
                                <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black uppercase backdrop-blur-xl border-2 shadow-xl ${device.status === 'online' ? 'bg-green-500/80 border-green-400' : 'bg-black/60 border-white/20'}`}>
                                  <span className={`h-3 w-3 rounded-full ${status.color} ${device.status === "recording" ? "animate-pulse" : ""}`} />
                                  <span className="text-white">{status.label}</span>
                                </div>
                              </div>
                            </div>

                            <CardContent className="p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <h3 className="text-lg font-black tracking-tighter uppercase truncate group-hover:text-primary transition-colors">{device.name}</h3>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Stream</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center border-2 border-border/20 group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                                  <StatusIcon className={cn("h-5 w-5 transition-colors", device.status === 'online' ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary-foreground")} />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>

                        <div className="absolute left-4 top-4 z-50 opacity-0 group-hover/device:opacity-100 transition-opacity">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-9 w-9 rounded-full shadow-2xl border-2 border-white/10 hover:scale-110 active:scale-95 transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-3xl max-w-[340px]">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Remove Camera?</AlertDialogTitle>
                                <AlertDialogDescription className="text-zinc-400 font-medium">
                                  This will permanently remove <b>{device.name}</b> from your dashboard.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-4 gap-2">
                                <AlertDialogCancel className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDevice(device.id, device.name)}
                                  className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-[0_5px_15px_rgba(255,0,0,0.3)]"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
          {/* Danger Zone: Cache Clearing */}
          <div className="mt-12 pt-8 border-t border-destructive/20">
            <h2 className="text-sm font-bold text-destructive uppercase tracking-widest mb-4">Diagnostic Tools</h2>
            <Button
              variant="outline"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors uppercase font-black text-[10px] tracking-[0.2em] h-12 rounded-2xl"
              onClick={() => {
                if (confirm("This will reset your device's unique identity. Do this if cameras are not appearing. The app will reload. Continue?")) {
                  localStorage.removeItem("hguard_device_persistent_id");
                  localStorage.removeItem("pending_cam_alerts");
                  window.location.reload();
                }
              }}
            >
              Reset Device Identity & Cache
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
