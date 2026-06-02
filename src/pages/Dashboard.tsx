// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, deleteDoc, addDoc, getDocs, serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Camera, Wifi, WifiOff, Video, MonitorSmartphone,
  Trash2, Settings, Grid2x2, CheckSquare, X,
  Shield, ShieldCheck, Moon, Brain, Zap, BellRing,
  Activity, Radio, Eye, ChevronRight, RefreshCw
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import LiveCameraStream from "@/components/LiveCameraStream";
import QuotaMeter from "@/components/QuotaMeter";

interface Device {
  id: string;
  user_id: string;
  name: string;
  type: "camera" | "viewer";
  status: "online" | "offline" | "recording";
  last_seen?: any;
  pairing_code?: string;
  created_at?: any;
  settings?: any;
  civic_mesh_enabled?: boolean;
}

const Dashboard = () => {
  const { user, isAdmin, adminViewMode, setAdminViewMode } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [viewers, setViewers] = useState<Device[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [gridSelectMode, setGridSelectMode] = useState(false);
  const [isFleetControlOpen, setIsFleetControlOpen] = useState(false);
  const [selectedCameras, setSelectedCameras] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const devicesQuery = query(collection(db, "devices"), where("user_id", "==", user.uid));
    const alertsQuery = query(collection(db, "alerts"), where("user_id", "==", user.uid));

    const unsubDevices = onSnapshot(devicesQuery, async (snapshot) => {
      const deviceList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Device));
      const allViewers: Device[] = [];
      const camerasByName = new Map<string, Device[]>();
      for (const device of deviceList) {
        if (device.type === "camera") {
          const existing = camerasByName.get(device.name) || [];
          existing.push(device);
          camerasByName.set(device.name, existing);
        } else {
          allViewers.push(device);
        }
      }
      const uniqueCameras: Device[] = [];
      for (const [, cameras] of camerasByName) {
        cameras.sort((a, b) => {
          const tA = a.created_at?.toDate?.()?.getTime() ?? Date.now();
          const tB = b.created_at?.toDate?.()?.getTime() ?? Date.now();
          return tB - tA;
        });
        uniqueCameras.push(cameras[0]);
        for (let i = 1; i < cameras.length; i++) {
          deleteDoc(doc(db, "devices", cameras[i].id)).catch(() => {});
        }
      }
      setDevices(uniqueCameras);
      setViewers(allViewers);
      setLoading(false);
    });

    const unsubAlerts = onSnapshot(alertsQuery, (snapshot) => {
      setUnreadAlerts(snapshot.docs.filter(d => !d.data().viewed).length);
    });

    return () => { unsubDevices(); unsubAlerts(); };
  }, [user]);

  const getOrCreateDeviceId = () => {
    let id = localStorage.getItem("hguard_device_persistent_id");
    if (!id) { id = Math.random().toString(36).substring(2, 12); localStorage.setItem("hguard_device_persistent_id", id); }
    return id;
  };

  const getDeviceModelName = (): string => {
    const ua = navigator.userAgent;
    const samsungMatch = ua.match(/Samsung[- ]([^\s;)]+)/i) || ua.match(/SM-([A-Z0-9]+)/i);
    if (samsungMatch) { const m = samsungMatch[1].toUpperCase(); const known: Record<string,string> = {'G973':'Samsung S10','G991':'Samsung S21','S901':'Samsung S22','S911':'Samsung S23','S921':'Samsung S24','S928':'Samsung S24 Ultra','A536':'Samsung A53','A546':'Samsung A54'}; const p = m.replace(/^SM-/,'').slice(0,4); return known[p] || `Samsung ${m.replace(/^SM-/,'')}`; }
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    const pixel = ua.match(/Pixel[- ]?(\d+[a-zA-Z]*)/i); if (pixel) return `Pixel ${pixel[1]}`;
    const op = ua.match(/OnePlus[- ]?([^\s;)]+)/i); if (op) return `OnePlus ${op[1]}`;
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux Device';
    return 'Device';
  };

  const handleUseAsCamera = async () => {
    if (!user) return;
    const persistentId = getOrCreateDeviceId();
    const deviceName = `${getDeviceModelName()} Camera`;
    const q = query(collection(db, "devices"), where("user_id", "==", user.uid));
    const snap = await getDocs(q);
    const match = snap.docs.find(d => { const data = d.data(); return (data.persistent_id === persistentId || data.name === deviceName) && data.type === "camera"; });
    if (match) {
      await updateDoc(doc(db, "devices", match.id), { status: "online", updated_at: serverTimestamp() });
      localStorage.setItem("hguard_role", "camera"); localStorage.setItem("hguard_saved_camera_id", match.id);
      navigate(`/camera/${match.id}`); return;
    }
    setRegistering(true);
    try {
      const ref = await addDoc(collection(db, "devices"), { user_id: user.uid, persistent_id: persistentId, name: deviceName, type: "camera", status: "online", pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase(), created_at: serverTimestamp(), updated_at: serverTimestamp() });
      localStorage.setItem("hguard_role", "camera"); localStorage.setItem("hguard_saved_camera_id", ref.id);
      navigate(`/camera/${ref.id}`);
    } catch { toast({ title: "Error", description: "Failed to start camera mode.", variant: "destructive" }); setRegistering(false); }
  };

  const handleUseAsViewer = async () => {
    if (!user) return;
    setRegistering(true);
    const persistentId = getOrCreateDeviceId();
    const deviceName = `${getDeviceModelName()} Viewer`;
    const q = query(collection(db, "devices"), where("user_id", "==", user.uid));
    const snap = await getDocs(q);
    const match = snap.docs.find(d => { const data = d.data(); return (data.persistent_id === persistentId || data.name === deviceName) && data.type === "viewer"; });
    if (match) {
      await updateDoc(doc(db, "devices", match.id), { status: "online", updated_at: serverTimestamp() });
      toast({ title: "Viewer Active", description: "You are now monitoring cameras." }); setRegistering(false); return;
    }
    try {
      await addDoc(collection(db, "devices"), { user_id: user.uid, persistent_id: persistentId, name: deviceName, type: "viewer", status: "online", pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase(), created_at: serverTimestamp(), updated_at: serverTimestamp() });
      toast({ title: "Viewer Active", description: "You are now monitoring cameras." });
    } catch { toast({ title: "Error", description: "Failed to start viewer mode.", variant: "destructive" }); }
    setRegistering(false);
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    await deleteDoc(doc(db, "devices", id));
    toast({ title: "Device removed", description: `${name} has been deleted.` });
  };

  const handleGlobalSetting = async (key: string, value: any) => {
    if (!user) return;
    const updates = devices.map(cam => updateDoc(doc(db, "devices", cam.id), { [`settings.${key}`]: value }).catch(() => {}));
    await Promise.all(updates);
    toast({ title: "Applied to all cameras", description: `${key.replace(/_/g," ")} → ${value}` });
  };

  const onlineCameras = devices.filter(d => d.status === "online").length;
  const recordingCameras = devices.filter(d => d.status === "recording").length;
  const meshNodes = devices.filter(d => d.civic_mesh_enabled).length;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-24">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Camera, label: "Cameras", value: devices.length, color: "text-primary", bg: "bg-primary/10" },
            { icon: Wifi, label: "Online", value: onlineCameras, color: "text-green-500", bg: "bg-green-500/10" },
            { icon: Video, label: "Recording", value: recordingCameras, color: "text-red-500", bg: "bg-red-500/10" },
            { icon: Radio, label: "Civic Mesh", value: meshNodes, color: "text-amber-500", bg: "bg-amber-500/10" },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground leading-none">{stat.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Admin View Mode Toggle */}
        {isAdmin && (
          <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-2xl">
            <div className="flex items-center gap-1.5 mr-auto">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-widest text-foreground">Admin View</span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
              <button
                onClick={() => setAdminViewMode("home")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                  adminViewMode === "home"
                    ? "bg-primary text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🏠 Home User
              </button>
              <button
                onClick={() => { setAdminViewMode("civic"); navigate("/sentinel"); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                  adminViewMode === "civic"
                    ? "bg-amber-500 text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🛡️ Civic Command
              </button>
            </div>
          </div>
        )}

        {/* Admin Quota Monitor */}
        <QuotaMeter />

        {/* Action bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-black text-foreground tracking-tight">
            My Cameras
            {unreadAlerts > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-[10px] font-black align-middle animate-pulse">
                {unreadAlerts > 99 ? "99+" : unreadAlerts} alert{unreadAlerts > 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {devices.length >= 2 && (
              gridSelectMode ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => { if (selectedCameras.size >= 2) navigate(`/live/all?ids=${[...selectedCameras].join(",")}`); }}
                    disabled={selectedCameras.size < 2}
                    className="h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold px-3"
                  >
                    <Grid2x2 className="h-3.5 w-3.5 mr-1.5" /> View {selectedCameras.size}
                  </Button>
                  <button onClick={() => { setGridSelectMode(false); setSelectedCameras(new Set()); }} className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Button onClick={() => setGridSelectMode(true)} variant="outline" className="h-9 rounded-xl border-border text-xs font-bold px-3">
                  <Grid2x2 className="h-3.5 w-3.5 mr-1.5" /> Multi View
                </Button>
              )
            )}
            <Button onClick={() => setIsFleetControlOpen(true)} variant="outline" className="h-9 rounded-xl border-border text-xs font-bold px-3">
              <Settings className="h-3.5 w-3.5 mr-1.5" /> Fleet Settings
            </Button>
            <Button onClick={handleUseAsCamera} disabled={registering} className="h-9 rounded-xl bg-primary text-primary-foreground text-xs font-bold px-3">
              <Camera className="h-3.5 w-3.5 mr-1.5" /> Add Camera
            </Button>
            <Button onClick={handleUseAsViewer} disabled={registering} variant="outline" className="h-9 rounded-xl border-border text-xs font-bold px-3">
              <MonitorSmartphone className="h-3.5 w-3.5 mr-1.5" /> Viewer
            </Button>
          </div>
        </div>

        {/* Camera grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground font-medium">Loading your cameras...</p>
          </div>
        ) : devices.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-24 gap-4 border-2 border-dashed border-border rounded-3xl bg-muted/5">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-foreground">No cameras yet</h2>
              <p className="text-xs text-muted-foreground max-w-xs">Open this app on a spare phone or tablet and tap <strong>"Add Camera"</strong> to start monitoring.</p>
            </div>
            <Button onClick={handleUseAsCamera} className="h-10 rounded-xl px-6 text-sm font-bold">
              <Camera className="h-4 w-4 mr-2" /> Set up this device as a camera
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((camera, idx) => {
              const isSelected = selectedCameras.has(camera.id);
              const isOnline = camera.status === "online" || camera.status === "recording";
              return (
                <motion.div
                  key={camera.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className={cn(
                    "group relative rounded-3xl overflow-hidden border bg-card shadow-md transition-all hover:shadow-xl hover:-translate-y-0.5",
                    gridSelectMode && isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                  )}
                >
                  {/* Grid select overlay */}
                  {gridSelectMode && (
                    <button
                      onClick={() => { setSelectedCameras(prev => { const n = new Set(prev); if (n.has(camera.id)) n.delete(camera.id); else n.add(camera.id); return n; }); }}
                      className="absolute inset-0 z-30 flex items-center justify-center bg-background/50 backdrop-blur-sm cursor-pointer"
                    >
                      <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center transition-all shadow-lg", isSelected ? "bg-primary text-primary-foreground scale-110" : "bg-card border border-border text-muted-foreground")}>
                        <CheckSquare className="h-6 w-6" />
                      </div>
                    </button>
                  )}

                  {/* Live stream */}
                  <div
                    className="w-full aspect-video cursor-pointer relative overflow-hidden bg-muted"
                    onClick={() => !gridSelectMode && navigate(`/live/${camera.id}`)}
                  >
                    <LiveCameraStream device={camera} localStream={null} onFullscreen={(id) => navigate(`/live/${id}`)} />

                    {/* Offline overlay */}
                    {!isOnline && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-2">
                        <WifiOff className="h-8 w-8 text-muted-foreground/40" />
                        <span className="text-xs text-muted-foreground font-bold">Offline</span>
                      </div>
                    )}

                    {/* Top-right badges */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5 z-20">
                      {camera.status === "recording" && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black uppercase animate-pulse flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />REC
                        </span>
                      )}
                      {camera.civic_mesh_enabled && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/80 text-white text-[9px] font-black uppercase backdrop-blur-sm">MESH</span>
                      )}
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", isOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40")} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{camera.name}</p>
                        <p className="text-[10px] text-muted-foreground font-medium capitalize">{camera.status}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary"
                        onClick={() => navigate(`/live/${camera.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove camera?</AlertDialogTitle>
                            <AlertDialogDescription>This will remove <strong>{camera.name}</strong> from your account.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteDevice(camera.id, camera.name)} className="bg-red-500 hover:bg-red-600 text-white">Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Viewers section */}
        {viewers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Connected Viewers ({viewers.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {viewers.map(viewer => (
                <motion.div
                  key={viewer.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl shadow-sm hover:border-primary/20 transition-all"
                >
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border", viewer.status === "online" ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-muted border-border text-muted-foreground")}>
                    <MonitorSmartphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{viewer.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={cn("h-1.5 w-1.5 rounded-full", viewer.status === "online" ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40")} />
                      <p className="text-[10px] text-muted-foreground font-medium capitalize">{viewer.status}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteDevice(viewer.id, viewer.name)} className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fleet Settings Modal — 7 settings */}
      <AnimatePresence>
        {isFleetControlOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsFleetControlOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-foreground font-black text-base">Fleet Settings</h2>
                    <p className="text-muted-foreground text-[10px] font-bold">Applied to all {devices.length} camera{devices.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <button onClick={() => setIsFleetControlOpen(false)} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">

                {/* Civic Mesh Info Panel */}
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 mb-1">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-amber-400 shrink-0" />
                    <p className="text-amber-300 font-black text-xs uppercase tracking-widest">Civic Mesh — What it does</p>
                  </div>
                  <div className="space-y-2 text-[10px] text-amber-200/80 leading-relaxed font-medium">
                    <p><span className="text-amber-300 font-black">BOLO (Be On the Lookout):</span> When Civic Mesh is ON, your camera silently compares faces it sees against active BOLO alerts issued by Sentinel Command. These are opt-in community safety alerts — for example, a missing person or a known threat posted by an authorized administrator.</p>
                    <p><span className="text-amber-300 font-black">Privacy:</span> Your camera video never leaves your device. Only anonymous face match scores are transmitted. No raw footage is shared with any third party. You can opt out at any time by toggling Civic Mesh OFF.</p>
                    <p><span className="text-amber-300 font-black">What happens on a match?</span> A silent hit report (confidence score + GPS location if permitted) is sent to Sentinel Command. No notification is sent to the person being scanned. Law enforcement is not automatically contacted.</p>
                  </div>
                </div>

                {[
                  { key: "ai_active", label: "Smart AI Alerts", desc: "Enable live AI scene descriptions on all cameras", icon: Brain, color: "text-primary" },
                  { key: "auto_night_vision", label: "Auto Night Vision", desc: "Automatically switch to night mode in low light", icon: Moon, color: "text-blue-400" },
                  { key: "power_save", label: "Battery Saver", desc: "Dim camera displays to extend battery life", icon: Zap, color: "text-yellow-500" },
                  { key: "cloud_recording", label: "Cloud Recording", desc: "Save clips to Google Drive automatically", icon: Shield, color: "text-green-500" },
                  { key: "motion_alerts", label: "Motion Alerts", desc: "Send push notifications on motion detection", icon: BellRing, color: "text-orange-500" },
                  { key: "high_quality", label: "High Quality Mode", desc: "Stream at maximum resolution (uses more data)", icon: Activity, color: "text-purple-500" },
                  { key: "civic_mesh_enabled", label: "Civic Mesh (AMBER)", desc: "Silent BOLO face scanning — anonymous, opt-in, privacy-first", icon: Radio, color: "text-amber-500" },
                ].map(setting => (
                  <div key={setting.key} className="flex items-center justify-between p-4 bg-background/60 border border-border/60 rounded-2xl gap-3 hover:border-border transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <setting.icon className={cn("h-4 w-4 shrink-0", setting.color)} />
                      <div className="min-w-0">
                        <p className="text-foreground font-bold text-sm leading-tight">{setting.label}</p>
                        <p className="text-muted-foreground text-[10px] mt-0.5 leading-tight">{setting.desc}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" onClick={() => handleGlobalSetting(setting.key, true)} className="h-7 px-2.5 text-[10px] font-black bg-green-500/15 text-green-600 hover:bg-green-500/25 border border-green-500/30 rounded-lg">ON</Button>
                      <Button size="sm" variant="outline" onClick={() => handleGlobalSetting(setting.key, false)} className="h-7 px-2.5 text-[10px] font-black rounded-lg">OFF</Button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default Dashboard;
