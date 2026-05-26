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
import { Camera, Wifi, WifiOff, Video, MonitorSmartphone, LayoutGrid, Trash2, RefreshCcw, Sparkles, Brain, Target, HelpCircle } from "lucide-react";
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

const Dashboard = () => {
  const { user, relinkGoogle } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
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

      // Auto-deduplicate cameras: keep only the newest per unique name
      const camerasByName = new Map<string, typeof deviceList>();
      const viewers: typeof deviceList = [];

      for (const device of deviceList) {
        if (device.type === 'camera') {
          const existing = camerasByName.get(device.name) || [];
          existing.push(device);
          camerasByName.set(device.name, existing);
        } else {
          viewers.push(device);
        }
      }

      // Delete duplicates (keep newest)
      const uniqueCameras: Device[] = [];
      for (const [name, cameras] of camerasByName) {
        cameras.sort((a, b) => {
          const timeA = a.created_at?.toDate ? a.created_at.toDate().getTime() : Date.now();
          const timeB = b.created_at?.toDate ? b.created_at.toDate().getTime() : Date.now();
          return timeB - timeA;
        });
        uniqueCameras.push(cameras[0]);
        // Silently delete duplicates
        for (let i = 1; i < cameras.length; i++) {
          deleteDoc(doc(db, "devices", cameras[i].id)).catch(() => { });
        }
      }

      setDevices(uniqueCameras);
      setLoading(false);
    }, (err) => {
      console.error("Dashboard devices error:", err);
      setLoading(false);
    });

    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const alertList = snapshot.docs.map(d => d.data());
      setUnreadAlerts(alertList.filter(a => a.viewed === false).length);
    });

    return () => {
      unsubscribeDevices();
      unsubscribeAlerts();
    };
  }, [user]);

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
    const deviceName = storedName || customName || `${navigator.platform} Viewer (${persistentId.slice(0, 4)})`;
    
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
      return data.name === deviceName && data.type === "viewer";
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
    const deviceName = storedName || customName || `${navigator.platform} Camera (${persistentId.slice(0, 4)})`;
    
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
      return data.name === deviceName && data.type === "camera";
    });

    if (matchingDocs.length > 0) {
      const existingDoc = matchingDocs[0];
      await updateDoc(doc(db, "devices", existingDoc.id), { status: 'online', updated_at: serverTimestamp() });
      navigate(`/camera/${existingDoc.id}`);
      return;
    }

    setRegistering(true);
    try {
      const docRef = await addDoc(collection(db, "devices"), {
        user_id: user.uid,
        name: deviceName,
        type: "camera",
        status: "online",
        pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
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
      <div className="p-6 h-full flex flex-col justify-center max-w-4xl mx-auto space-y-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 mb-12"
        >
          <Logo size="lg" className="h-24 w-24 mx-auto drop-shadow-2xl animate-float" />
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary animate-pulse-subtle">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest">Ready</span>
              </div>

              <button
                onClick={() => setIsMeshTracking(!isMeshTracking)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-300",
                  isMeshTracking 
                    ? "bg-blue-500/20 border-blue-400/40 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
                    : "bg-white/5 border-white/10 text-white/30 hover:bg-white/10"
                )}
              >
                <Target className={cn("h-3 w-3", isMeshTracking && "animate-spin-slow")} />
                <span className="text-[9px] font-black uppercase tracking-widest">Auto-switch {isMeshTracking ? 'on' : 'off'}</span>
              </button>
            </div>
            
            {user?.email === "successpartner10@gmail.com" && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/ai-lab')}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
              >
                <Sparkles className="h-3 w-3 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest">AI Insight Available</span>
              </motion.button>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex justify-center mb-8"
        >
          <button 
            onClick={() => navigate('/help')}
            className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all duration-200"
          >
            <HelpCircle className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="text-[10px] font-black text-white tracking-wide leading-none">New to HGUARD?</p>
              <p className="text-[9px] font-bold text-white/40 mt-1">See tips and how-to guides</p>
            </div>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              size="lg"
              onClick={handleUseAsCamera}
              disabled={registering}
              className="group relative h-48 w-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-primary/50 text-white rounded-[2rem] transition-all duration-500 flex flex-col gap-4 items-center justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-4 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-500">
                <Camera className="h-8 w-8" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold tracking-tight">Use as camera</div>
                <div className="text-[10px] font-medium text-muted-foreground mt-1">Turn this device into a security camera</div>
              </div>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              size="lg"
              onClick={() => { handleUseAsViewer(); navigate('/live/all'); }}
              disabled={registering}
              className="group relative h-48 w-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-blue-500/50 text-white rounded-[2rem] transition-all duration-500 flex flex-col gap-4 items-center justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform duration-500">
                <MonitorSmartphone className="h-8 w-8" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold tracking-tight">Watch cameras</div>
                <div className="text-[10px] font-medium text-muted-foreground mt-1">See live video from your other devices</div>
              </div>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              size="lg"
              onClick={() => navigate('/archive')}
              className="group relative h-48 w-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-purple-500/50 text-white rounded-[2rem] transition-all duration-500 flex flex-col gap-4 items-center justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform duration-500">
                <Video className="h-8 w-8" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold tracking-tight">Recordings</div>
                <div className="text-[10px] font-medium text-muted-foreground mt-1">Watch saved clips from Google Drive</div>
              </div>
            </Button>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="pt-12 border-t border-white/5 space-y-8"
        >
          <div className="flex flex-col items-center gap-4">
            <span className="text-[10px] font-bold text-white/30 tracking-wide">Status</span>
            <div className="flex flex-wrap justify-center gap-8">
               <div className="flex items-center gap-3 group translate-z-0">
                 <div className="relative flex h-2 w-2">
                    <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-40"></div>
                    <div className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></div>
                 </div>
                 <span className="text-[10px] font-bold tracking-wide text-white/60 group-hover:text-white transition-colors">Cameras can connect</span>
               </div>
               <div className="flex items-center gap-3 group">
                 <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                 <span className="text-[10px] font-bold tracking-wide text-white/60 group-hover:text-white transition-colors">Google Drive linked</span>
                 <button 
                   onClick={relinkGoogle}
                   className="ml-2 text-[9px] font-black uppercase text-primary hover:underline cursor-pointer"
                 >
                   Reconnect
                 </button>
               </div>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-3">
             <div className="px-5 py-2.5 rounded-full bg-white/[0.02] border border-white/5 backdrop-blur-md flex items-center gap-3 transition-colors hover:bg-white/[0.05]">
                <span className="text-[9px] font-bold text-white/20 tracking-wide">Open in browser</span>
                <a href="https://hguard-elite.web.app" target="_blank" className="text-[11px] font-medium text-primary/80 hover:text-primary transition-colors">hguard-elite.web.app</a>
             </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
