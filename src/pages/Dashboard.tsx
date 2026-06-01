import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Camera, Wifi, WifiOff, Video, MonitorSmartphone, LayoutGrid, Trash2, RefreshCcw, Sparkles, Brain, Target, HelpCircle, Settings, Shield, Grid2x2, CheckSquare, X } from "lucide-react";
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
import { Logo } from "@/components/Logo";

interface Device {
  id: string;
  user_id: string;
  name: string;
  type: 'camera' | 'viewer';
  status: 'online' | 'offline' | 'recording';
  last_seen?: any;
  pairing_code?: string;
  created_at?: any;
  settings?: {
    ai_mode?: 'security' | 'pet' | 'elder';
  };
}

const statusConfig = {
  online: { icon: Wifi, color: "bg-green-500", label: "Online", className: "status-online" },
  offline: { icon: WifiOff, color: "bg-muted-foreground", label: "Offline", className: "" },
  recording: { icon: Video, color: "bg-destructive", label: "Recording", className: "status-recording" },
};

import LiveCameraStream from "@/components/LiveCameraStream";

const Dashboard = () => {
  const { user, relinkGoogle } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [viewers, setViewers] = useState<Device[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [isMeshTracking, setIsMeshTracking] = useState(false);
  const [gridSelectMode, setGridSelectMode] = useState(false);
  const [isFleetControlOpen, setIsFleetControlOpen] = useState(false);
  const [selectedCameras, setSelectedCameras] = useState<Set<string>>(new Set());
  const [customName, setCustomName] = useState(
    localStorage.getItem("hguard_preferred_name") || 
    sessionStorage.getItem("hguard_preferred_name") || 
    ""
  );

  useEffect(() => {
    if (!user) return;

    const devicesQuery = query(
      collection(db, "devices"),
      where("user_id", "==", user.uid)
    );

    const alertsQuery = query(
      collection(db, "alerts"),
      where("user_id", "==", user.uid)
    );

    const unsubscribeDevices = onSnapshot(devicesQuery, async (snapshot) => {
      const deviceList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Device));

      // Separate cameras from viewers
      const allViewers: typeof deviceList = [];
      const camerasByName = new Map<string, typeof deviceList>();

      for (const device of deviceList) {
        if (device.type === 'camera') {
          const existing = camerasByName.get(device.name) || [];
          existing.push(device);
          camerasByName.set(device.name, existing);
        } else {
          allViewers.push(device);
        }
      }

      // Delete duplicate cameras (keep newest per name)
      const uniqueCameras: Device[] = [];
      for (const [name, cameras] of camerasByName) {
        cameras.sort((a, b) => {
          const timeA = a.created_at?.toDate ? a.created_at.toDate().getTime() : Date.now();
          const timeB = b.created_at?.toDate ? b.created_at.toDate().getTime() : Date.now();
          return timeB - timeA;
        });
        uniqueCameras.push(cameras[0]);
        for (let i = 1; i < cameras.length; i++) {
          deleteDoc(doc(db, "devices", cameras[i].id)).catch(() => { });
        }
      }

      setDevices(uniqueCameras);
      setViewers(allViewers);
      setLoading(false);
    }, (err) => {
      console.error("Dashboard devices error:", err);
      setLoading(false);
    });

    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const alertList = snapshot.docs.map(d => d.data());
      setUnreadAlerts(alertList.filter(a => a.viewed === false).length);
    });

    // Auto-start camera if remembered role
    const savedRole = localStorage.getItem("hguard_role");
    const savedId = localStorage.getItem("hguard_saved_camera_id");
    if (savedRole === "camera" && savedId) {
      navigate(`/camera/${savedId}`);
    }

    return () => {
      unsubscribeDevices();
      unsubscribeAlerts();
    };
  }, [user, navigate]);

  // Mesh Tracking Handoff Logic
  useEffect(() => {
    if (!isMeshTracking || devices.length === 0) return;

    // Find first device with a recent unread alert (our proxy for active detection)
    // or we could check a specific 'active_detection' field if we added it.
    // For now, use unread_alerts as the trigger.
    const activeTarget = devices.find(d => d.type === 'camera' && d.status === 'online' && (d as any).unread_alerts > 0);
    
    if (activeTarget) {
      toast({ 
        title: "Switching camera", 
        description: `Opening live view for ${activeTarget.name}…`,
        className: "bg-blue-600 text-white border-none shadow-2xl"
      });
      // Small delay to allow user to see the toast before switching
      const timer = setTimeout(() => navigate(`/live/${activeTarget.id}`), 1000);
      return () => clearTimeout(timer);
    }
  }, [devices, isMeshTracking, navigate, toast]);

  const toggleMotionDetection = async (deviceId: string, enabled: boolean) => {
    try {
      await updateDoc(doc(db, "devices", deviceId), { "settings.cloud_recording": enabled });
      toast({ 
        title: enabled ? "Full Protection ON" : "Watch Only Mode", 
        description: enabled ? "AI and cloud recording active." : "Motion detection disabled." 
      });
    } catch (e) {
      toast({ title: "Error", variant: "destructive", description: "Failed to update camera setting" });
    }
  };

  const handleGlobalSetting = async (key: string, value: boolean) => {
    if (devices.length === 0) {
      toast({ title: "No Cameras", description: "Add a camera first.", variant: "destructive" });
      return;
    }
    try {
      const promises = devices.map(cam => 
        updateDoc(doc(db, "devices", cam.id), { [`settings.${key}`]: value })
      );
      await Promise.all(promises);
      toast({ 
        title: "Fleet Command Sent", 
        description: `Successfully updated ${devices.length} cameras.`,
        className: "bg-blue-600 text-white border-none"
      });
    } catch (e) {
      toast({ title: "Error", description: "Failed to update fleet.", variant: "destructive" });
    }
  };

  // Detect real device model from User-Agent (works on Android/iOS browsers)
  const getDeviceModelName = (): string => {
    const ua = navigator.userAgent;

    // Samsung devices: "Samsung Galaxy S9" / "SM-G960F" etc.
    const samsungMatch = ua.match(/Samsung[- ]([^\s;)]+)/i) || ua.match(/SM-([A-Z0-9]+)/i);
    if (samsungMatch) {
      // Try to humanise model numbers: SM-G960 → Samsung S9, SM-A515 → Samsung A51
      const model = samsungMatch[1].toUpperCase();
      const knownSamsung: Record<string, string> = {
        'G960': 'Samsung S9', 'G965': 'Samsung S9+',
        'G970': 'Samsung S10e', 'G973': 'Samsung S10', 'G975': 'Samsung S10+',
        'G980': 'Samsung S20', 'G988': 'Samsung S20 Ultra',
        'G991': 'Samsung S21', 'G998': 'Samsung S21 Ultra',
        'S901': 'Samsung S22', 'S908': 'Samsung S22 Ultra',
        'S911': 'Samsung S23', 'S918': 'Samsung S23 Ultra',
        'S921': 'Samsung S24', 'S928': 'Samsung S24 Ultra',
        'A515': 'Samsung A51', 'A525': 'Samsung A52', 'A536': 'Samsung A53',
        'A546': 'Samsung A54', 'A556': 'Samsung A55',
        'N975': 'Samsung Note 10+', 'N986': 'Samsung Note 20 Ultra',
      };
      const prefix = model.replace(/^SM-/, '').slice(0, 4);
      if (knownSamsung[prefix]) return knownSamsung[prefix];
      return `Samsung ${model.replace(/^SM-/, '')}`;
    }

    // iPhone / iPad
    const iosMatch = ua.match(/iPhone|iPad/i);
    if (iosMatch) {
      // iOS UA doesn't expose model number well, use generic
      const isIPad = /iPad/i.test(ua);
      return isIPad ? 'iPad' : 'iPhone';
    }

    // Google Pixel
    const pixelMatch = ua.match(/Pixel[- ]?(\d+[a-zA-Z]*)/i);
    if (pixelMatch) return `Google Pixel ${pixelMatch[1]}`;

    // OnePlus
    const opMatch = ua.match(/OnePlus[- ]?([^\s;)]+)/i);
    if (opMatch) return `OnePlus ${opMatch[1]}`;

    // Xiaomi / Redmi / Poco
    const xiaomiMatch = ua.match(/(Redmi|POCO|Mi)[- ]?([^\s;)]+)/i);
    if (xiaomiMatch) return `${xiaomiMatch[1]} ${xiaomiMatch[2]}`;

    // Huawei
    const huaweiMatch = ua.match(/HUAWEI[- ]?([^\s;)]+)/i);
    if (huaweiMatch) return `Huawei ${huaweiMatch[1]}`;

    // Generic Android with model
    const androidMatch = ua.match(/\(Linux;[^)]*;\s*([^;)]+)\s*Build\//i);
    if (androidMatch) {
      const raw = androidMatch[1].trim();
      if (raw && raw !== 'Android') return raw;
    }

    // Desktop fallback
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux';

    return 'Unknown device';
  };

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
    const storedName = localStorage.getItem("hguard_preferred_name") || sessionStorage.getItem("hguard_preferred_name");
    const deviceName = storedName || customName || `${getDeviceModelName()} Viewer`;
    
    if (customName) {
      localStorage.setItem("hguard_preferred_name", customName);
      sessionStorage.setItem("hguard_preferred_name", customName);
    }

    // Single-field query to avoid composite index requirement
    const q = query(
      collection(db, "devices"),
      where("user_id", "==", user.uid)
    );

    const querySnapshot = await getDocs(q);
    const matchingDocs = querySnapshot.docs.filter(d => {
      const data = d.data();
      return (data.persistent_id === persistentId || data.name === deviceName) && data.type === "viewer";
    });

    if (matchingDocs.length > 0) {
      const existingDoc = matchingDocs[0];
      await updateDoc(doc(db, "devices", existingDoc.id), { status: 'online', updated_at: serverTimestamp() });
      toast({ title: "Viewer Active", description: "You are now monitoring cameras." });
      setRegistering(false);
      return;
    }

    // Register this device as a new viewer
    try {
      await addDoc(collection(db, "devices"), {
        user_id: user.uid,
        persistent_id: persistentId,
        name: deviceName,
        type: "viewer",
        status: "online",
        pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      toast({ title: "Viewer Active", description: "You are now monitoring cameras." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to start viewer mode.", variant: "destructive" });
    }
    setRegistering(false);
  };

  const handleUseAsCamera = async () => {
    if (!user) return;

    const persistentId = getOrCreateDeviceId();
    const storedName = localStorage.getItem("hguard_preferred_name") || sessionStorage.getItem("hguard_preferred_name");
    const deviceName = storedName || customName || `${getDeviceModelName()} Camera`;
    
    if (customName) {
      localStorage.setItem("hguard_preferred_name", customName);
      sessionStorage.setItem("hguard_preferred_name", customName);
    }

    // Single-field query to avoid composite index requirement
    const q = query(
      collection(db, "devices"),
      where("user_id", "==", user.uid)
    );

    const querySnapshot = await getDocs(q);
    const matchingDocs = querySnapshot.docs.filter(d => {
      const data = d.data();
      return (data.persistent_id === persistentId || data.name === deviceName) && data.type === "camera";
    });

    if (matchingDocs.length > 0) {
      const existingDoc = matchingDocs[0];
      await updateDoc(doc(db, "devices", existingDoc.id), { status: 'online', updated_at: serverTimestamp() });
      localStorage.setItem("hguard_role", "camera");
      localStorage.setItem("hguard_saved_camera_id", existingDoc.id);
      navigate(`/camera/${existingDoc.id}`);
      return;
    }

    setRegistering(true);
    try {
      const docRef = await addDoc(collection(db, "devices"), {
        user_id: user.uid,
        persistent_id: persistentId,
        name: deviceName,
        type: "camera",
        status: "online",
        pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      localStorage.setItem("hguard_role", "camera");
      localStorage.setItem("hguard_saved_camera_id", docRef.id);
      navigate(`/camera/${docRef.id}`);
    } catch (e) {
      toast({ title: "Error", description: "Failed to start camera mode.", variant: "destructive" });
      setRegistering(false);
    }
  };

  const handleSmartCleanup = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, "alerts"), where("user_id", "==", user.uid));
      const snap = await getDocs(q);
      const toDelete = snap.docs.filter(d => {
        const data = d.data();
        // Delete if older than 24h AND not starred
        const isOld = data.created_at?.toDate ? (Date.now() - data.created_at.toDate().getTime() > 24 * 60 * 60 * 1000) : false;
        return isOld && !data.starred;
      });

      if (toDelete.length === 0) {
        toast({ title: "Storage Optimized", description: "No old or unnecessary clips to remove." });
      } else {
        const batchSize = 10;
        for (let i = 0; i < toDelete.length; i += batchSize) {
          const batch = toDelete.slice(i, i + batchSize);
          await Promise.all(batch.map(d => deleteDoc(d.ref)));
        }
        toast({ title: "Cleaned up", description: `Removed ${toDelete.length} old clips to free space.` });
      }
    } catch (e) {
      toast({ title: "Cleanup Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, "devices", id));
      toast({ title: "Device Removed", description: `${name} has been deleted.` });
      setDevices(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error("Error deleting device:", error);
      toast({ title: "Error", description: "Failed to delete device.", variant: "destructive" });
    }
  };

  const resetAllDevices = async () => {
    if (!user) return;
    if (!confirm("Delete ALL devices and cameras? You'll need to re-register them.")) return;
    try {
      const q = query(collection(db, "devices"), where("user_id", "==", user.uid));
      const snapshot = await getDocs(q);
      for (const d of snapshot.docs) {
        await deleteDoc(d.ref);
      }
      toast({ title: "All Devices Cleared", description: "You can now re-register your cameras." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to reset devices.", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 h-full flex flex-col max-w-5xl mx-auto space-y-6">
        
        {/* Top Actions — Alfred-inspired clean header */}
        <div className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary shrink-0" /> My Cameras
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {devices.length} {devices.length === 1 ? 'camera' : 'cameras'} · {viewers.length} viewer{viewers.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {/* Fleet Command */}
            <Button
              onClick={() => setIsFleetControlOpen(true)}
              className="h-8 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded-full font-bold text-[10px] px-3 mr-1"
            >
              <Target className="h-3.5 w-3.5 mr-1" /> Fleet Command
            </Button>

            {/* Grid view select */}
            {devices.length >= 2 && (
              gridSelectMode ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => {
                      if (selectedCameras.size >= 2) {
                        navigate(`/live/all?ids=${[...selectedCameras].join(',')}`);
                      }
                    }}
                    disabled={selectedCameras.size < 2}
                    className="h-8 rounded-full bg-primary text-black hover:bg-primary/90 text-[10px] font-bold px-3"
                  >
                    <Grid2x2 className="h-3.5 w-3.5 mr-1" /> View {selectedCameras.size}
                  </Button>
                  <button onClick={() => { setGridSelectMode(false); setSelectedCameras(new Set()); }} className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  onClick={() => setGridSelectMode(true)}
                  variant="outline"
                  className="h-8 rounded-full border-white/10 hover:bg-white/5 text-[10px] font-bold px-3"
                >
                  <Grid2x2 className="h-3.5 w-3.5 mr-1" /> Grid
                </Button>
              )
            )}
            <Button 
              onClick={handleUseAsCamera} 
              disabled={registering}
              className="h-8 bg-primary text-black hover:bg-primary/90 rounded-full font-bold text-[10px] px-3"
            >
              <Camera className="h-3.5 w-3.5 mr-1" /> Camera
            </Button>
            <Button 
              onClick={handleUseAsViewer} 
              disabled={registering}
              variant="outline"
              className="h-8 rounded-full border-white/10 hover:bg-white/5 font-bold text-[10px] px-3"
            >
              <MonitorSmartphone className="h-3.5 w-3.5 mr-1" /> Viewer
            </Button>
          </div>
        </div>

        {/* Camera List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-xs font-medium text-muted-foreground">Loading cameras...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white/[0.01] border border-white/5 rounded-3xl border-dashed">
            <LayoutGrid className="h-12 w-12 text-white/10 mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">No cameras found</h2>
            <p className="text-xs text-muted-foreground max-w-sm mb-6">
              You haven't added any cameras yet. Install this app on a spare phone or tablet and tap "Add Camera".
            </p>
            <Button onClick={handleUseAsCamera} variant="outline" className="rounded-full border-white/10 hover:bg-white/5">
              Set up this device as a camera instead
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-12">
            {devices.map((camera) => {
              const isSelected = selectedCameras.has(camera.id);
              return (
                <div
                  key={camera.id}
                  className={cn(
                    "w-full h-[18rem] rounded-2xl overflow-hidden border shadow-lg relative bg-black/50 group transition-all",
                    gridSelectMode && isSelected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-white/10"
                  )}
                >
                  {/* Grid select overlay */}
                  {gridSelectMode && (
                    <button
                      onClick={() => {
                        setSelectedCameras(prev => {
                          const next = new Set(prev);
                          if (next.has(camera.id)) next.delete(camera.id);
                          else next.add(camera.id);
                          return next;
                        });
                      }}
                      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer"
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center transition-all",
                        isSelected ? "bg-primary text-black scale-110" : "bg-white/10 text-white/50 border border-white/20"
                      )}>
                        <CheckSquare className="h-5 w-5" />
                      </div>
                    </button>
                  )}

                  {/* Camera stream */}
                  <div
                    className="w-full h-full relative cursor-pointer"
                    onClick={() => !gridSelectMode && navigate(`/live/${camera.id}`)}
                  >
                    <LiveCameraStream
                      device={camera}
                      localStream={null}
                      onFullscreen={(id) => navigate(`/live/${id}`)}
                    />
                  </div>

                  {/* Bottom status pill — Alfred-style compact */}
                  {!gridSelectMode && (
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          camera.status === 'recording' ? 'bg-red-500 animate-pulse' :
                          camera.status === 'online' ? 'bg-green-500' : 'bg-white/20'
                        )} />
                        <span className="text-[10px] font-bold text-white/80 truncate max-w-[100px]">{camera.name}</span>
                        {(camera.settings as any)?.cloud_recording && (
                          <Shield className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Viewers Section */}
        {viewers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <MonitorSmartphone className="h-4 w-4 text-white/40" />
              <span className="text-xs font-bold uppercase tracking-widest text-white/40">Active Viewers ({viewers.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-12">
              {viewers.map((viewer) => (
                <div key={viewer.id} className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    viewer.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/30'
                  }`}>
                    <MonitorSmartphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{viewer.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        viewer.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-white/20'
                      }`} />
                      <p className="text-[10px] text-white/40 font-medium capitalize">{viewer.status}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteDevice(viewer.id, viewer.name)} 
                    className="h-8 w-8 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-xl"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Global Fleet Control Modal */}
      <AnimatePresence>
        {isFleetControlOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsFleetControlOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">Fleet Command</h2>
                    <p className="text-white/40 text-xs">Push updates to all {devices.length} cameras instantly.</p>
                  </div>
                </div>
                <button onClick={() => setIsFleetControlOpen(false)} className="text-white/40 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <p className="text-white font-bold text-sm">AI Security Guard</p>
                    <p className="text-white/40 text-[10px]">Enable Gemini AI narrative descriptions globally.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleGlobalSetting('ai_active', true)} className="h-7 text-[10px] bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30">ON</Button>
                    <Button size="sm" onClick={() => handleGlobalSetting('ai_active', false)} className="h-7 text-[10px] bg-white/5 text-white hover:bg-white/10">OFF</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <p className="text-white font-bold text-sm">Auto Night Vision</p>
                    <p className="text-white/40 text-[10px]">Cameras engage Night Vision automatically in low light.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleGlobalSetting('auto_night_vision', true)} className="h-7 text-[10px] bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30">ON</Button>
                    <Button size="sm" onClick={() => handleGlobalSetting('auto_night_vision', false)} className="h-7 text-[10px] bg-white/5 text-white hover:bg-white/10">OFF</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <p className="text-white font-bold text-sm">Force Sleep (Power Save)</p>
                    <p className="text-white/40 text-[10px]">Turn off all camera screens to save maximum battery.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleGlobalSetting('power_save', true)} className="h-7 text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30">SLEEP</Button>
                    <Button size="sm" onClick={() => handleGlobalSetting('power_save', false)} className="h-7 text-[10px] bg-white/5 text-white hover:bg-white/10">WAKE</Button>
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

export default Dashboard;
