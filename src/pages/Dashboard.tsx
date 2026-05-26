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
import { Camera, Wifi, WifiOff, Video, MonitorSmartphone, LayoutGrid, Trash2, RefreshCcw, Sparkles, Brain, Target, HelpCircle, Settings, Shield } from "lucide-react";
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
        
        {/* Top Actions & Info */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" /> My Cameras
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {devices.length} {devices.length === 1 ? 'camera' : 'cameras'} · {viewers.length} {viewers.length === 1 ? 'viewer' : 'viewers'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button 
              onClick={handleUseAsCamera} 
              disabled={registering}
              className="flex-1 sm:flex-none bg-primary text-black hover:bg-primary/90 rounded-full font-bold shadow-[0_0_15px_rgba(var(--primary),0.3)]"
            >
              <Camera className="mr-2 h-4 w-4" /> Add Camera
            </Button>
            <Button 
              onClick={handleUseAsViewer} 
              disabled={registering}
              variant="outline"
              className="flex-1 sm:flex-none rounded-full border-white/10 hover:bg-white/5 font-bold"
            >
              <MonitorSmartphone className="mr-2 h-4 w-4" /> Add Viewer
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
            {devices.map((camera) => (
              <div key={camera.id} className="w-full h-[22rem] flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-lg relative bg-black/50 group">
                <div className="flex-1 relative cursor-pointer" onClick={() => navigate(`/live/${camera.id}`)}>
                  <LiveCameraStream
                      device={camera}
                      localStream={null}
                      onFullscreen={(id) => navigate(`/live/${id}`)}
                  />
                  <div className="absolute inset-0 z-10 pointer-events-none hover:bg-white/5 transition-colors" />
                </div>
                <div className="h-16 bg-white/[0.02] border-t border-white/10 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-widest">Motion Detection</p>
                      <p className="text-[9px] text-white/50 font-medium">
                        {(camera.settings as any)?.cloud_recording ? "AI Enabled" : "Live Stream Only"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={(camera.settings as any)?.cloud_recording || false} 
                      onCheckedChange={(c) => toggleMotionDetection(camera.id, c)}
                    />
                    <div className="w-px h-6 bg-white/10" />
                    <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="text-white/50 hover:text-white hover:bg-white/10 rounded-xl">
                      <Settings className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
    </AppLayout>
  );
};

export default Dashboard;
