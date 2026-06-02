// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Trash2, Save, LogOut, AlertTriangle, ShieldCheck, Settings2, Shield, Bell, Clock, 
  UserCheck, HardDrive, Edit3, Share2, Activity, Moon, Zap, Palette, 
  VolumeX, Smartphone, Music, Calendar, Lock as LockIcon, Unlock as UnlockIcon,
  DiscIcon, Download, CloudOff, Check, Camera as CameraIcon, Monitor, Sun,
  Radio, ShieldAlert, Heart, ChevronDown, ChevronUp, BellRing, Settings, Thermometer, AlertOctagon, Terminal, RefreshCw, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { localFileSystem, LocalFile } from "@/lib/localFileSystem";
import { useTheme, ThemeType } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import PinModal from "@/components/PinModal";
import TwoFactorSetup from "@/components/TwoFactorSetup";

import { googleDrive } from "@/lib/googleDrive";
import { aiOrchestrator } from "@/lib/ai/aiOrchestrator";
import { Cpu, Brain } from "lucide-react";
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

interface Device {
  id: string;
  user_id: string;
  name: string;
  type: string;
  status: string;
  created_at: any;
  settings?: {
    night_vision?: boolean;
    motion_detection?: boolean;
    ai_mode?: 'security' | 'pet' | 'elder';
    sensitivity?: number;
  };
}

const ADMIN_EMAIL = "successpartner10@gmail.com";

const THEMES: { id: ThemeType; label: string; colors: string[] }[] = [
  { id: "dark-blue", label: "Midnight Blue", colors: ["#0f172a", "#3b82f6"] },
  { id: "dark-onyx", label: "Onyx Black", colors: ["#050505", "#f8fafc"] },
  { id: "dark-slate", label: "Slate Pro", colors: ["#1e293b", "#10b981"] },
  { id: "pastel", label: "Lavender", colors: ["#fdfaff", "#8b5cf6"] },
  { id: "light-pure", label: "Pure White", colors: ["#ffffff", "#0f172a"] },
  { id: "light-cream", label: "Warm Cream", colors: ["#fdfaf6", "#ea580c"] },
];

const SettingsPage = () => {
  const { user, profileData, signOut, signInWithGoogle, forceLogoutAllDevices } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensitivity, setSensitivity] = useState(50);
  const [notificationPref, setNotificationPref] = useState<"mute" | "vibrate" | "ring">("ring");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
 
  const [securityPin, setSecurityPin] = useState("");
  const [newPin, setNewPin] = useState("");
 
  const [schedule, setSchedule] = useState<{ enabled: boolean, start: string, end: string }>({
    enabled: false,
    start: "22:00",
    end: "06:00"
  });
 
  const [ignorePets, setIgnorePets] = useState(false);
  const [archiveLimit, setArchiveLimit] = useState(10);
  const [purgeThreshold, setPurgeThreshold] = useState(80);
  const [driveQuota, setDriveQuota] = useState<{ used: number, limit: number } | null>(null);
  const [activeBrain, setActiveBrain] = useState(aiOrchestrator.getProviderId());
  const [autoUpgrade, setAutoUpgrade] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState("");
  const [expandedCameraId, setExpandedCameraId] = useState<string | null>(null);

  // Synchronized Custom AI Keys States
  const [g1, setG1] = useState("");
  const [g2, setG2] = useState("");
  const [g3, setG3] = useState("");
  const [g4, setG4] = useState("");
  const [gr1, setGr1] = useState("");
  const [gr2, setGr2] = useState("");
  const [or, setOr] = useState("");
  const [op, setOp] = useState("");

  const isAdmin = user?.email === ADMIN_EMAIL;
  
  // Fetch Drive Quota
  useEffect(() => {
    const fetchQuota = async () => {
      const token = localStorage.getItem("google_drive_token");
      if (token) {
        const quota = await googleDrive.getStorageQuota(token);
        if (quota) setDriveQuota(quota);
      }
    };
    fetchQuota();
    const interval = setInterval(fetchQuota, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync state with profile data
  useEffect(() => {
    if (profileData) {
      setNotificationPref(profileData.notifications || "ring");
      setDisplayName(profileData.display_name || user?.displayName || "");
      setSecurityPin(profileData.security_pin || "");
      setSchedule(profileData.detection_schedule || { enabled: false, start: "22:00", end: "06:00" });
      setIgnorePets(profileData.ignore_pets ?? false);
      setArchiveLimit(profileData.archive_limit_gb || 10);
      setPurgeThreshold(profileData.purge_threshold_percent || 80);
      setWebhookUrl(profileData.webhook_url || "");
      setAutoUpgrade(profileData.auto_upgrade_ai ?? true);

      // Cloud API key synchronization
      const ck = profileData.custom_keys || {};
      setG1(ck.hguard_gemini_api_key_1 || ck.hguard_gemini_api_key || localStorage.getItem("hguard_gemini_api_key_1") || localStorage.getItem("hguard_gemini_api_key") || "");
      setG2(ck.hguard_gemini_api_key_2 || localStorage.getItem("hguard_gemini_api_key_2") || "");
      setG3(ck.hguard_gemini_api_key_3 || localStorage.getItem("hguard_gemini_api_key_3") || "");
      setG4(ck.hguard_gemini_api_key_4 || localStorage.getItem("hguard_gemini_api_key_4") || "");
      setGr1(ck.hguard_groq_api_key || localStorage.getItem("hguard_groq_api_key") || "");
      setGr2(ck.hguard_groq_api_key_alt || localStorage.getItem("hguard_groq_api_key_alt") || "");
      setOr(ck.hguard_openrouter_api_key || localStorage.getItem("hguard_openrouter_api_key") || "");
      setOp(ck.hguard_openai_api_key || localStorage.getItem("hguard_openai_api_key") || "");
    } else {
      // Offline fallback
      setG1(localStorage.getItem("hguard_gemini_api_key_1") || localStorage.getItem("hguard_gemini_api_key") || "");
      setG2(localStorage.getItem("hguard_gemini_api_key_2") || "");
      setG3(localStorage.getItem("hguard_gemini_api_key_3") || "");
      setG4(localStorage.getItem("hguard_gemini_api_key_4") || "");
      setGr1(localStorage.getItem("hguard_groq_api_key") || "");
      setGr2(localStorage.getItem("hguard_groq_api_key_alt") || "");
      setOr(localStorage.getItem("hguard_openrouter_api_key") || "");
      setOp(localStorage.getItem("hguard_openai_api_key") || "");
    }
  }, [profileData, user]);

  useEffect(() => {
    if (!user) return;

    // Note: no orderBy here — avoids composite index while it builds; sorting client-side.
    const q = query(collection(db, "devices"), where("user_id", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sorted = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Device))
        .sort((a, b) => {
          const aMs = a.created_at?.toMillis?.() ?? 0;
          const bMs = b.created_at?.toMillis?.() ?? 0;
          return aMs - bMs;
        });
      setDevices(sorted);
    });

    return () => unsubscribe();
  }, [user]);

  const saveArchiveLimit = async (val: number[]) => {
    const limit = val[0];
    setArchiveLimit(limit);
    if (!user) return;
    try {
      await updateDoc(doc(db, "profiles", user.uid), { archive_limit_gb: limit });
      toast({ title: "Storage Limit Updated", description: limit === 9999 ? "FIFO buffer set to Unlimited." : `FIFO buffer set to ${limit} GB.` });
    } catch (e) {
      console.error(e);
    }
  };

  const savePurgeThreshold = async (val: number) => {
    setPurgeThreshold(val);
    if (!user) return;
    try {
      await updateDoc(doc(db, "profiles", user.uid), { purge_threshold_percent: val });
      toast({ title: "Purge Threshold Updated", description: `Auto-purge will trigger at ${val}% capacity.` });
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkToggle = async (key: string, enabled: boolean) => {
    const cameras = devices.filter(d => d.type === 'camera');
    if (cameras.length === 0) {
      toast({ title: "No Cameras", description: "No camera devices registered yet." });
      return;
    }
    try {
      const { writeBatch, doc } = await import("firebase/firestore");
      const batch = writeBatch(db);
      cameras.forEach(device => {
        if (key === "civic_mesh_enabled") {
          batch.update(doc(db, "devices", device.id), {
            civic_mesh_enabled: enabled,
            "settings.civic_mesh_enabled": enabled
          });
        } else {
          batch.update(doc(db, "devices", device.id), {
            [`settings.${key}`]: enabled
          });
        }
      });
      await batch.commit();
      toast({
        title: "Bulk Update Done",
        description: `Set ${key.replace(/_/g, ' ')} to ${enabled ? "ON" : "OFF"} for all cameras.`
      });
    } catch (e) {
      toast({ title: "Failed bulk update", variant: "destructive" });
    }
  };

  const saveWebhook = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "profiles", user.uid), { webhook_url: webhookUrl });
      toast({ title: "Automation Updated", description: "Webhook URL saved." });
    } catch (e) {
      console.error(e);
    }
  };

  const updateDeviceName = async (id: string, name: string) => {
    try {
      await updateDoc(doc(db, "devices", id), { name });
      toast({ title: "Device Renamed" });
    } catch (e) {
      console.error(e);
    }
  };

  const [shareEmail, setShareEmail] = useState("");
  const [sharingDeviceId, setSharingDeviceId] = useState<string | null>(null);

  const toggleDeviceSetting = async (id: string, field: string, value: any) => {
    try {
      await updateDoc(doc(db, "devices", id), {
        [`settings.${field}`]: value
      });
      toast({ title: "Settings Updated" });
    } catch (e) {
      console.error(e);
    }
  };

  const [shareDuration, setShareDuration] = useState<string>("forever");

  const handleShareDevice = async (id: string) => {
    if (!shareEmail.includes("@")) {
      toast({ title: "Invalid Email", variant: "destructive" });
      return;
    }
    try {
      const deviceRef = doc(db, "devices", id);
      const device = devices.find(d => d.id === id);
      
      let expiresAt: number | null = null;
      if (shareDuration !== "forever") {
        const hours = parseInt(shareDuration);
        expiresAt = Date.now() + hours * 60 * 60 * 1000;
      }

      const newInvite = { email: shareEmail, expires_at: expiresAt };
      const currentShared = (device as any).shared_with || [];
      const updatedShared = [...currentShared.filter((s: any) => s.email !== shareEmail), newInvite];

      await updateDoc(deviceRef, { shared_with: updatedShared });
      toast({ title: "Access Shared", description: `Invited ${shareEmail} (${shareDuration}).` });
      setShareEmail("");
      setSharingDeviceId(null);
    } catch (e) {
      console.error(e);
      toast({ title: "Sharing Failed", variant: "destructive" });
    }
  };

  const removeShare = async (deviceId: string, email: string) => {
    try {
      const device = devices.find(d => d.id === deviceId);
      const updated = ((device as any).shared_with || []).filter((s: any) => (typeof s === 'string' ? s : s.email) !== email);
      await updateDoc(doc(db, "devices", deviceId), { shared_with: updated });
      toast({ title: "Access Revoked" });
    } catch (e) {
       console.error(e);
    }
  };

  const savePin = async () => {
    if (newPin.length !== 4) {
      toast({ title: "Invalid PIN", description: "PIN must be exactly 4 digits.", variant: "destructive" });
      return;
    }
    if (!user) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, "profiles", user.uid), {
        security_pin: newPin
      });
      setSecurityPin(newPin);
      setNewPin("");
      toast({ title: "Security PIN Set", description: "Now required for deleting recordings." });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to set PIN", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveCustomKey = async (localStorageKey: string, val: string, successTitle: string, successDesc: string) => {
    const trimmed = val.trim();
    if (trimmed) {
      localStorage.setItem(localStorageKey, trimmed);
    } else {
      localStorage.removeItem(localStorageKey);
    }
    
    if (!user) return;
    try {
      await updateDoc(doc(db, "profiles", user.uid), {
        [`custom_keys.${localStorageKey}`]: trimmed || null
      });
      toast({
        title: successTitle,
        description: successDesc
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Sync Error",
        description: "Saved locally, but failed to sync to cloud.",
        variant: "destructive"
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const saveProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, "profiles", user.uid), { display_name: displayName });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
      }
      toast({ title: "Profile saved" });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to save profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const removeDevice = async (id: string) => {
    try {
      await deleteDoc(doc(db, "devices", id));
      toast({ title: "Device removed" });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to remove device", variant: "destructive" });
    }
  };

  const handleNotificationChange = async (pref: "mute" | "vibrate" | "ring") => {
    if (!user) return;
    setNotificationPref(pref);
    try {
      await updateDoc(doc(db, "profiles", user.uid), { notifications: pref });
      toast({ title: "Alert preference saved", description: `Notifications set to ${pref}.` });
      if (pref === "vibrate" && "vibrate" in navigator) {
        navigator.vibrate(200);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveSchedule = async (newSchedule: typeof schedule) => {
    if (!user) return;
    setSchedule(newSchedule);
    try {
      await updateDoc(doc(db, "profiles", user.uid), { detection_schedule: newSchedule });
      toast({ title: "Schedule Updated", description: `Auto-detection ${newSchedule.enabled ? 'enabled' : 'disabled'}.` });
    } catch (e) {
      console.error(e);
    }
  };

  const saveIgnorePets = async (enabled: boolean) => {
    if (!user) return;
    setIgnorePets(enabled);
    try {
      await updateDoc(doc(db, "profiles", user.uid), { ignore_pets: enabled });
      toast({ title: "AI Filter Updated", description: enabled ? "Pets will be ignored strictly." : "Pets will be recorded." });
    } catch (e) {
      console.error(e);
    }
  };

  const handleBrainChange = async (providerId: string) => {
    if (!user) return;
    setActiveBrain(providerId);
    aiOrchestrator.setProvider(providerId);
    try {
      await updateDoc(doc(db, "profiles", user.uid), { ai_provider: providerId });
      toast({ 
        title: "AI Brain Updated", 
        description: `Now powered by ${providerId === 'gemma' ? 'Gemma 2' : 'Gemini 1.5'}.`,
        variant: "default" 
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleAutoUpgrade = async (enabled: boolean) => {
    if (!user) return;
    setAutoUpgrade(enabled);
    try {
      await updateDoc(doc(db, "profiles", user.uid), { auto_upgrade_ai: enabled });
      toast({ 
        title: "Adaptive AI Updated", 
        description: enabled ? "Auto-upgrading to latest Google models." : "Manual model control enabled." 
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-10 mb-20 tracking-tighter">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase leading-none">Settings</h1>
            <p className="text-base text-muted-foreground font-medium">Control your security settings and preferences.</p>
          </div>
          <div className="flex items-center gap-2 bg-card border rounded-full p-1">
            <Button
              variant={theme === "light" ? "default" : "ghost"}
              onClick={() => setTheme("light")}
              className="h-8 w-8 rounded-full p-0"
            >
              <Sun className="h-4 w-4" />
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "ghost"}
              onClick={() => setTheme("dark")}
              className="h-8 w-8 rounded-full p-0"
            >
              <Moon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* My Cameras & Viewers — Rename Section */}
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <CameraIcon className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-black tracking-tight">My cameras & viewers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Tap any name to rename it</p>
            </div>
          </div>

          {devices.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No devices registered yet.</p>
          )}

          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center gap-3 p-4 rounded-2xl bg-card/40 border border-border/40 group"
              >
                <div className={`p-2 rounded-xl ${device.type === 'camera' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-400'}`}>
                  {device.type === 'camera' ? <CameraIcon className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  {editingDeviceId === device.id ? (
                    <input
                      autoFocus
                      value={editingDeviceName}
                      onChange={(e) => setEditingDeviceName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          await updateDeviceName(device.id, editingDeviceName);
                          setEditingDeviceId(null);
                        }
                        if (e.key === 'Escape') setEditingDeviceId(null);
                      }}
                      className="w-full bg-transparent border-b-2 border-primary text-base font-bold outline-none py-0.5 text-foreground"
                      placeholder="Enter a custom name…"
                    />
                  ) : (
                    <button
                      className="text-left w-full"
                      onClick={() => { setEditingDeviceId(device.id); setEditingDeviceName(device.name); }}
                    >
                      <p className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">{device.name || 'Unnamed device'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{device.type} · {device.status}</p>
                    </button>
                  )}
                </div>

                {editingDeviceId === device.id ? (
                  <button
                    onClick={async () => {
                      await updateDeviceName(device.id, editingDeviceName);
                      setEditingDeviceId(null);
                    }}
                    className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => { setEditingDeviceId(device.id); setEditingDeviceName(device.name); }}
                    className="p-2 rounded-xl opacity-0 group-hover:opacity-100 bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Camera Features Manager */}
        <div className="bg-card border-2 border-primary/20 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground">Camera Features Manager</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle advanced on-demand features and settings per camera</p>
            </div>
          </div>

          {/* Explanation Banner & Civic Mesh Detail */}
          <div className="p-4 rounded-2xl bg-muted/60 border border-border/80 space-y-3 text-xs font-medium">
            <div className="space-y-1">
              <p className="text-foreground font-black text-xs">Is the Features Manager required?</p>
              <p className="text-muted-foreground leading-relaxed">
                <span className="text-primary font-bold">Yes.</span> It is essential for managing individual hardware and software capabilities on each active camera node. Since different devices have different battery capacities, processing power, and surveillance locations, configuring features per-device ensures optimal resource usage and stops unnecessary power drain.
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider">Civic Mesh & GPS Performance profile</span>
              </div>
              <p className="text-[9px] text-amber-200/80 leading-normal">
                <strong>Impact of 20+ active alerts:</strong> Comparing descriptors uses highly optimized 128-dimensional Euclidean distance calculations. Matching a face against 20 active alerts takes less than 1 millisecond on the device's CPU, presenting <strong>0% visual or streaming lag</strong>.
              </p>
              <p className="text-[9px] text-amber-200/80 leading-normal">
                <strong>GPS Delivery Speed:</strong> Signals are sent instantly (throttled to 20-second intervals per alert). The coordinates sent are the <strong>precise geolocation of the camera device itself</strong>, acting as an exact physical proxy of where the match occurred.
              </p>
            </div>
          </div>

          {/* Bulk Actions Panel */}
          <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Global Controls (Set all cameras at once)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "night_vision", label: "Night Vision" },
                { key: "ai_active", label: "Smart AI Alerts" },
                { key: "power_save", label: "Battery Saver" },
                { key: "cloud_recording", label: "Cloud Sync" },
                { key: "motion_alerts", label: "Motion Alerts" },
                { key: "civic_mesh_enabled", label: "Civic Mesh" },
                { key: "thermal_mode", label: "Thermal View" },
                { key: "siren_defense", label: "Siren Rules" },
              ].map(feat => (
                <div key={feat.key} className="flex flex-col gap-1 p-2 bg-background/50 rounded-lg border border-border/40 text-center">
                  <span className="text-[9px] font-black truncate">{feat.label}</span>
                  <div className="flex gap-1 justify-center mt-1">
                    <button
                      onClick={() => handleBulkToggle(feat.key, true)}
                      className="px-1.5 py-0.5 text-[8px] font-black bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded"
                    >
                      ON
                    </button>
                    <button
                      onClick={() => handleBulkToggle(feat.key, false)}
                      className="px-1.5 py-0.5 text-[8px] font-black bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded"
                    >
                      OFF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {devices.filter(d => d.type === 'camera').length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No cameras registered yet.</p>
            )}
            {devices.filter(d => d.type === 'camera').map((device) => {
              const isExpanded = expandedCameraId === device.id;
              const currentSettings = device.settings || {};
              const isCivicMesh = (device as any).civic_mesh_enabled ?? currentSettings.civic_mesh_enabled ?? false;

              const cameraSettingsList = [
                { key: "night_vision", label: "Night Vision", desc: "Digital light amplification", icon: Moon, color: "text-blue-400", checked: currentSettings.night_vision ?? false },
                { key: "ai_active", label: "Smart AI Alerts", desc: "Edge AI scene descriptions", icon: Brain, color: "text-primary", checked: currentSettings.ai_active ?? false },
                { key: "power_save", label: "Battery Saver", desc: "Dim screen/save power", icon: Zap, color: "text-yellow-500", checked: currentSettings.power_save ?? false },
                { key: "cloud_recording", label: "Cloud Recording", desc: "Auto-save clips to Drive", icon: Shield, color: "text-green-500", checked: currentSettings.cloud_recording ?? false },
                { key: "motion_alerts", label: "Motion Alerts", desc: "Send push alerts", icon: BellRing, color: "text-orange-500", checked: currentSettings.motion_alerts ?? false },
                { key: "civic_mesh_enabled", label: "Civic Mesh", desc: "Silent BOLO alert scanning", icon: Radio, color: "text-amber-500", checked: isCivicMesh },
                { key: "thermal_mode", label: "Thermal Mapping", desc: "Estimated heat reconstruction", icon: Thermometer, color: "text-red-500", checked: currentSettings.thermal_mode ?? false },
                { key: "siren_defense", label: "Siren Rules", desc: "Acoustic warning deterrent", icon: AlertOctagon, color: "text-red-400", checked: currentSettings.siren_defense ?? false },
              ];

              return (
                <div key={device.id} className="border border-border rounded-2xl overflow-hidden bg-muted/20">
                  <button
                    onClick={() => setExpandedCameraId(isExpanded ? null : device.id)}
                    className="w-full flex items-center justify-between p-4 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <CameraIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{device.name}</p>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                          {device.status} · {cameraSettingsList.filter(s => s.checked).length} active settings
                        </p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border bg-card/30"
                      >
                        <div className="p-4 space-y-3">
                          {cameraSettingsList.map((setting) => (
                            <div key={setting.key} className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/50 gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <setting.icon className={cn("h-4 w-4 shrink-0", setting.color)} />
                                <div className="min-w-0">
                                  <p className="text-foreground font-bold text-xs leading-tight">{setting.label}</p>
                                  <p className="text-muted-foreground text-[9px] mt-0.5 leading-tight">{setting.desc}</p>
                                </div>
                              </div>
                              <Switch
                                checked={setting.checked}
                                onCheckedChange={async (checked) => {
                                  try {
                                    if (setting.key === "civic_mesh_enabled") {
                                      await updateDoc(doc(db, "devices", device.id), {
                                        civic_mesh_enabled: checked,
                                        "settings.civic_mesh_enabled": checked
                                      });
                                    } else {
                                      await updateDoc(doc(db, "devices", device.id), {
                                        [`settings.${setting.key}`]: checked
                                      });
                                    }
                                    toast({
                                      title: "Setting Updated",
                                      description: `${device.name}: ${setting.label} → ${checked ? "ON" : "OFF"}`
                                    });
                                  } catch (e) {
                                    toast({ title: "Failed to save settings", variant: "destructive" });
                                  }
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alert Preferences */}
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Bell className="w-8 h-8" />
            <h2 className="text-xl font-black uppercase tracking-tight">Alert Preferences</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => handleNotificationChange("mute")}
              className={cn(
                "h-24 flex-col gap-2 rounded-3xl border-2 transition-all",
                notificationPref === "mute" ? "bg-primary/10 border-primary text-primary" : "bg-card/40 border-border/40"
              )}
            >
              <VolumeX className="w-8 h-8" />
              <span className="text-[10px] font-black uppercase tracking-widest">Mute</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleNotificationChange("vibrate")}
              className={cn(
                "h-24 flex-col gap-2 rounded-3xl border-2 transition-all",
                notificationPref === "vibrate" ? "bg-primary/10 border-primary text-primary" : "bg-card/40 border-border/40"
              )}
            >
              <Smartphone className="w-8 h-8" />
              <span className="text-[10px] font-black uppercase tracking-widest">Vibrate</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleNotificationChange("ring")}
              className={cn(
                "h-24 flex-col gap-2 rounded-3xl border-2 transition-all",
                notificationPref === "ring" ? "bg-primary/10 border-primary text-primary" : "bg-card/40 border-border/40"
              )}
            >
              <Music className="w-8 h-8" />
              <span className="text-[10px] font-black uppercase tracking-widest">Ring</span>
            </Button>
          </div>
          <p className="text-[10px] font-black text-center opacity-80 uppercase tracking-widest px-4">
            These settings affect events on this device only.
          </p>
        </div>

        {/* Detection Schedule */}
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <Clock className="w-8 h-8" />
              <h2 className="text-xl font-black tracking-tight">Motion Schedule</h2>
            </div>
            <Switch
              checked={schedule.enabled}
              onCheckedChange={(enabled) => saveSchedule({ ...schedule, enabled })}
              className="scale-125"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={cn(
              "p-6 rounded-[2rem] border-2 transition-all space-y-3",
              schedule.enabled ? "bg-card/40 border-border/40" : "opacity-40 grayscale"
            )}>
              <div className="flex items-center gap-2 text-primary/60">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Starts</span>
              </div>
              <Input
                type="time"
                value={schedule.start}
                onChange={(e) => saveSchedule({ ...schedule, start: e.target.value })}
                className="h-12 bg-muted border-0 text-xl font-black rounded-xl"
                disabled={!schedule.enabled}
              />
            </div>
            <div className={cn(
              "p-6 rounded-[2rem] border-2 transition-all space-y-3",
              schedule.enabled ? "bg-card/40 border-border/40" : "opacity-40 grayscale"
            )}>
              <div className="flex items-center gap-2 text-primary/60">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Ends</span>
              </div>
              <Input
                type="time"
                value={schedule.end}
                onChange={(e) => saveSchedule({ ...schedule, end: e.target.value })}
                className="h-12 bg-muted border-0 text-xl font-black rounded-xl"
                disabled={!schedule.enabled}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3 text-primary">
              <Shield className="w-8 h-8" />
              <h2 className="text-xl font-black tracking-tight">Smart Detection</h2>
            </div>
            <Switch
              checked={ignorePets}
              onCheckedChange={saveIgnorePets}
              className="scale-125"
            />
          </div>
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex flex-col gap-2">
            <h3 className="text-sm font-black text-primary uppercase tracking-widest leading-normal">Smart Drive-Saver</h3>
            <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest leading-normal">
              Ignore pets to save Google Drive storage. If only cats or dogs are detected without a person, the recording will be deleted.
            </p>
          </div>
        </div>

        {/* Access Control & PIN */}
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <LockIcon className="w-8 h-8" />
            <h2 className="text-xl font-black tracking-tight">Security & PIN</h2>
          </div>
          <div className="space-y-6">
            <TwoFactorSetup />
            
            <div className="p-6 bg-primary/5 border-2 border-primary/20 rounded-[2.5rem] space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-base font-black uppercase leading-none">Deletion Guard</p>
                  <p className="text-sm font-bold opacity-80 uppercase tracking-tight">Requires 4-digit PIN for destructive actions.</p>
                </div>
                {securityPin ? (
                  <UnlockIcon className="w-8 h-8 text-green-500" />
                ) : (
                  <LockIcon className="w-8 h-8 text-foreground/20" />
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder={securityPin ? "Change PIN (4 digits)" : "Set PIN (4 digits)"}
                  className="h-14 font-black text-xl tracking-[0.5em] text-center rounded-2xl bg-muted border-2"
                />
                <Button onClick={savePin} disabled={loading || newPin.length !== 4} size="lg" className="h-14 px-8 rounded-2xl font-black">
                  {securityPin ? "Update" : "Set"}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">Account Identity</Label>
              <div className="h-20 bg-muted/20 border-2 border-border/20 rounded-2xl px-6 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase opacity-40">Display Name</p>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} onBlur={saveProfile} className="h-8 bg-transparent border-0 p-0 text-xl font-bold focus-visible:ring-0" />
                </div>
                <div className="h-8 px-3 flex items-center bg-primary/10 text-primary text-[10px] font-black uppercase rounded-lg border border-primary/20">
                  {isAdmin ? "Global Admin" : "User Account"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Limits Dashboard */}
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <HardDrive className="w-8 h-8" />
            <h2 className="text-xl font-black tracking-tight">Storage Control</h2>
          </div>
          
          <div className="p-6 bg-primary/5 border-2 border-primary/20 rounded-[2rem] space-y-8">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-base font-black leading-none">Storage Limit</p>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 50, 100, 500, 9999].map((val) => {
                    const isUnlimited = val === 9999;
                    const active = archiveLimit === val;
                    return (
                      <button
                        key={val}
                        onClick={() => saveArchiveLimit([val])}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all",
                          active
                            ? "bg-primary border-primary text-black"
                            : "bg-background/40 border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {isUnlimited ? "Unlimited" : `${val}GB`}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <p className="text-xs font-bold opacity-80 tracking-tight">Set HGUARD storage space limit. Select Unlimited to utilize the total drive capacity.</p>

              {/* Deletion Purge Threshold Settings */}
              <div className="space-y-3 pt-4 border-t border-primary/10">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-foreground">Auto-Purge Threshold (%)</p>
                    <p className="text-[9px] text-muted-foreground uppercase">Triggers automatic oldest recording cleanup when storage exceeds this target</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={10}
                      max={95}
                      value={purgeThreshold}
                      onChange={(e) => savePurgeThreshold(Math.max(10, Math.min(95, parseInt(e.target.value) || 80)))}
                      className="w-14 h-8 bg-background/40 border border-border text-center font-black rounded-lg text-xs"
                    />
                    <span className="text-[9px] font-black text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={10}
                    max={95}
                    step={5}
                    value={purgeThreshold}
                    onChange={(e) => savePurgeThreshold(parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-full accent-primary cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted border border-border rounded-[1.5rem]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <DiscIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <Label className="text-sm font-bold uppercase tracking-widest">Drive Status</Label>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                      {driveQuota 
                        ? `${Math.round(driveQuota.used / 1024 / 1024 / 1024 * 10) / 10} GB of ${Math.round(driveQuota.limit / 1024 / 1024 / 1024)} GB used (${Math.round((driveQuota.used / driveQuota.limit) * 100)}% full)`
                        : "Info Not Available — Connect Drive"}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-1 shrink-0" />
                <p className="text-[11px] text-yellow-500/80 leading-relaxed font-medium">
                  {archiveLimit === 9999 ? (
                    <span>Auto-purge will trigger to delete the oldest recordings once your storage capacity reaches <span className="font-bold text-yellow-400">{purgeThreshold}%</span>.</span>
                  ) : (
                    <span>When your storage usage for HGUARD exceeds <span className="font-bold text-yellow-400">{archiveLimit} GB</span>, or overall space hits <span className="font-bold text-yellow-400">{purgeThreshold}%</span>, the oldest recordings will be automatically cleaned up.</span>
                  )}
                </p>
              </div>
            </div>

            {driveQuota && (
              <div className="space-y-3 pt-4 border-t border-primary/10">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest leading-none">
                  <span className="text-primary">Drive Usage</span>
                  <span className="opacity-60">{Math.round(driveQuota.used / 1024 / 1024 / 1024 * 10) / 10} GB / {Math.round(driveQuota.limit / 1024 / 1024 / 1024)} GB</span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden border border-border">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000",
                      (driveQuota.used / driveQuota.limit) > 0.9 ? "bg-destructive w-full" : "bg-primary"
                    )} 
                    style={{ width: `${Math.min(100, (driveQuota.used / driveQuota.limit) * 100)}%` }}
                  />
                </div>
                {(driveQuota.used / driveQuota.limit) > 0.9 && (
                   <p className="text-[10px] font-bold text-destructive animate-pulse uppercase tracking-widest text-center mt-2">
                     Warning: Google Drive is nearly full! Purge may fail.
                   </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Google Drive Connection */}
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <ShieldCheck className="w-8 h-8" />
            <h2 className="text-xl font-black uppercase tracking-tight">Account Sync</h2>
          </div>
          <div className={cn(
            "p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between",
            localStorage.getItem("google_drive_token") ? "bg-green-500/10 border-green-500/30" : "bg-card/40 border-border/40"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn("h-4 w-4 rounded-full", localStorage.getItem("google_drive_token") ? "bg-green-500 animate-pulse" : "bg-white/20")} />
              <div>
                <p className="text-base font-black uppercase leading-none">Google Drive</p>
                <p className="text-xs font-bold opacity-80 uppercase tracking-tight">
                  {localStorage.getItem("google_drive_token") ? "Authorized & Linked" : "Not Linked"}
                </p>
              </div>
            </div>
            <Button
              variant={localStorage.getItem("google_drive_token") ? "outline" : "default"}
              onClick={signInWithGoogle}
              className="rounded-xl font-black tracking-widest text-xs"
            >
              {localStorage.getItem("google_drive_token") ? "Manage Access" : "Connect Drive"}
            </Button>
          </div>
        </div>

        {/* AI Intelligence Brain */}
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <Brain className="w-8 h-8" />
              <h2 className="text-xl font-black tracking-tight">AI Settings</h2>
            </div>
            <Switch
              checked={autoUpgrade}
              onCheckedChange={toggleAutoUpgrade}
              className="scale-125"
            />
          </div>
          
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Adaptive Model Selection</span>
            </div>
            <p className="text-[9px] font-bold text-primary/70 uppercase tracking-tight">
              {autoUpgrade 
                ? "System is automatically routing requests to the most efficient model (Gemini 1.5 Flash)." 
                : "Manual model selection active. Performance may vary."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => handleBrainChange('gemma')}
              className={cn(
                "h-32 flex-col gap-3 rounded-[2rem] border-2 transition-all p-6",
                activeBrain === 'gemma' ? "bg-primary/10 border-primary text-primary" : "bg-card/40 border-border/40 opacity-60"
              )}
            >
              <Cpu className="w-10 h-10" />
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest">Local-Edge</p>
                <p className="text-[8px] font-bold opacity-60 uppercase">Gemma 2 / Flash</p>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleBrainChange('gemini')}
              className={cn(
                "h-32 flex-col gap-3 rounded-[2rem] border-2 transition-all p-6",
                activeBrain === 'gemini' ? "bg-primary/10 border-primary text-primary" : "bg-card/40 border-border/40 opacity-60"
              )}
            >
              <Brain className="w-10 h-10" />
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-widest">Cloud Neural</p>
                <p className="text-[8px] font-bold opacity-60 uppercase">Gemini 1.5 Pro</p>
              </div>
            </Button>
          </div>
        </div>

        {/* Custom AI Keys Settings Card */}
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Brain className="w-8 h-8" />
            <h2 className="text-xl font-black uppercase tracking-tight">Custom AI Keys</h2>
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Configure your custom API keys for extended AI quotas.
          </p>

          <div className="space-y-4">
            {/* Groq Key 1 */}
            <div className="p-6 bg-card/40 border-2 border-border/40 rounded-[2rem] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Groq API Key (Primary)</span>
                {gr1 ? (
                  <span className="text-[8px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full uppercase">Configured</span>
                ) : (
                  <span className="text-[8px] bg-muted/50 text-muted-foreground font-bold px-2 py-0.5 rounded-full uppercase">Not Configured</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="gsk_..."
                  value={gr1}
                  onChange={(e) => setGr1(e.target.value)}
                  className="h-12 bg-muted border-0 rounded-xl font-mono text-xs px-4"
                />
                <Button
                  onClick={() => saveCustomKey("hguard_groq_api_key", gr1, "Primary Groq Key Updated", "Primary Groq Key saved successfully & synced.")}
                  className="h-12 px-6 rounded-xl font-bold text-[10px] uppercase tracking-wider shrink-0"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Groq Key 2 */}
            <div className="p-6 bg-card/40 border-2 border-border/40 rounded-[2rem] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Groq API Key (Secondary)</span>
                {gr2 ? (
                  <span className="text-[8px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full uppercase">Configured</span>
                ) : (
                  <span className="text-[8px] bg-muted/50 text-muted-foreground font-bold px-2 py-0.5 rounded-full uppercase">Not Configured</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="gsk_..."
                  value={gr2}
                  onChange={(e) => setGr2(e.target.value)}
                  className="h-12 bg-muted border-0 rounded-xl font-mono text-xs px-4"
                />
                <Button
                  onClick={() => saveCustomKey("hguard_groq_api_key_alt", gr2, "Secondary Groq Key Updated", "Secondary Groq Key saved successfully & synced.")}
                  className="h-12 px-6 rounded-xl font-bold text-[10px] uppercase tracking-wider shrink-0"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* OpenRouter Key */}
            <div className="p-6 bg-card/40 border-2 border-border/40 rounded-[2rem] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">OpenRouter API Key (Free Vision Option)</span>
                {or ? (
                  <span className="text-[8px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full uppercase">Configured</span>
                ) : (
                  <span className="text-[8px] bg-muted/50 text-muted-foreground font-bold px-2 py-0.5 rounded-full uppercase">Not Configured</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={or}
                  onChange={(e) => setOr(e.target.value)}
                  className="h-12 bg-muted border-0 rounded-xl font-mono text-xs px-4"
                />
                <Button
                  onClick={() => saveCustomKey("hguard_openrouter_api_key", or, "OpenRouter Key Updated", "Your free OpenRouter Vision API key has been saved and synced.")}
                  className="h-12 px-6 rounded-xl font-bold text-[10px] uppercase tracking-wider shrink-0"
                >
                  Save
                </Button>
              </div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase leading-normal">
                OpenRouter lets you query the <strong>Llama 3.2 11B Vision (Free)</strong> model with high stability! Get your free key at openrouter.ai.
              </p>
            </div>

            {/* OpenAI Key */}
            <div className="p-6 bg-card/40 border-2 border-border/40 rounded-[2rem] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">OpenAI API Key (Custom)</span>
                {op ? (
                  <span className="text-[8px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full uppercase">Configured</span>
                ) : (
                  <span className="text-[8px] bg-muted/50 text-muted-foreground font-bold px-2 py-0.5 rounded-full uppercase">Not Configured</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-proj-..."
                  value={op}
                  onChange={(e) => setOp(e.target.value)}
                  className="h-12 bg-muted border-0 rounded-xl font-mono text-xs px-4"
                />
                <Button
                  onClick={() => saveCustomKey("hguard_openai_api_key", op, "OpenAI Key Updated", "Your custom OpenAI key has been saved and synced.")}
                  className="h-12 px-6 rounded-xl font-bold text-[10px] uppercase tracking-wider shrink-0"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Gemini Key 1 */}
            <div className="p-6 bg-card/40 border-2 border-border/40 rounded-[2rem] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Gemini API Key #1 (Primary)</span>
                {g1 ? (
                  <span className="text-[8px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full uppercase">Configured</span>
                ) : (
                  <span className="text-[8px] bg-primary/20 text-primary font-bold px-2 py-0.5 rounded-full uppercase">System Free Tier</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={g1}
                  onChange={(e) => setG1(e.target.value)}
                  className="h-12 bg-muted border-0 rounded-xl font-mono text-xs px-4"
                />
                <Button
                  onClick={() => {
                    saveCustomKey("hguard_gemini_api_key_1", g1, "Gemini Key #1 Updated", "Primary Gemini key saved and synced.");
                    localStorage.setItem("hguard_gemini_api_key", g1); // legacy sync
                  }}
                  className="h-12 px-6 rounded-xl font-bold text-[10px] uppercase tracking-wider shrink-0"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Gemini Key 2 */}
            <div className="p-6 bg-card/40 border-2 border-border/40 rounded-[2rem] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Gemini API Key #2</span>
                {g2 ? (
                  <span className="text-[8px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full uppercase">Configured</span>
                ) : (
                  <span className="text-[8px] bg-muted/50 text-muted-foreground font-bold px-2 py-0.5 rounded-full uppercase">Not Configured</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={g2}
                  onChange={(e) => setG2(e.target.value)}
                  className="h-12 bg-muted border-0 rounded-xl font-mono text-xs px-4"
                />
                <Button
                  onClick={() => saveCustomKey("hguard_gemini_api_key_2", g2, "Gemini Key #2 Updated", "Gemini key #2 saved and synced.")}
                  className="h-12 px-6 rounded-xl font-bold text-[10px] uppercase tracking-wider shrink-0"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Gemini Key 3 */}
            <div className="p-6 bg-card/40 border-2 border-border/40 rounded-[2rem] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Gemini API Key #3</span>
                {g3 ? (
                  <span className="text-[8px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full uppercase">Configured</span>
                ) : (
                  <span className="text-[8px] bg-muted/50 text-muted-foreground font-bold px-2 py-0.5 rounded-full uppercase">Not Configured</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={g3}
                  onChange={(e) => setG3(e.target.value)}
                  className="h-12 bg-muted border-0 rounded-xl font-mono text-xs px-4"
                />
                <Button
                  onClick={() => saveCustomKey("hguard_gemini_api_key_3", g3, "Gemini Key #3 Updated", "Gemini key #3 saved and synced.")}
                  className="h-12 px-6 rounded-xl font-bold text-[10px] uppercase tracking-wider shrink-0"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Gemini Key 4 */}
            <div className="p-6 bg-card/40 border-2 border-border/40 rounded-[2rem] space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Gemini API Key #4</span>
                {g4 ? (
                  <span className="text-[8px] bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded-full uppercase">Configured</span>
                ) : (
                  <span className="text-[8px] bg-muted/50 text-muted-foreground font-bold px-2 py-0.5 rounded-full uppercase">Not Configured</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={g4}
                  onChange={(e) => setG4(e.target.value)}
                  className="h-12 bg-muted border-0 rounded-xl font-mono text-xs px-4"
                />
                <Button
                  onClick={() => saveCustomKey("hguard_gemini_api_key_4", g4, "Gemini Key #4 Updated", "Gemini key #4 saved and synced.")}
                  className="h-12 px-6 rounded-xl font-bold text-[10px] uppercase tracking-wider shrink-0"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Nuclear Mesh Reset Card */}

        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 text-destructive">
            <Zap className="w-8 h-8" />
            <h2 className="text-xl font-black tracking-tight">Remove all cameras</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm font-bold text-destructive/60 uppercase tracking-widest leading-relaxed">
              If cameras look duplicated or outdated, use this tool to refresh your camera list.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full h-16 rounded-[2rem] font-black tracking-wide text-base">
                  Remove all cameras
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-background border-destructive/50">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black text-destructive italic underline">Confirm reset</AlertDialogTitle>
                  <AlertDialogDescription className="text-foreground/70 font-bold uppercase tracking-widest leading-loose">
                    This permanently removes all cameras from your account. You'll need to set them up again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-2xl border-border font-black">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={async () => {
                      if (!user) return;
                      const q = query(collection(db, "devices"), where("user_id", "==", user.uid));
                      const snap = await getDocs(q);
                      for (const d of snap.docs) await deleteDoc(doc(db, "devices", d.id));
                      window.location.reload();
                    }}
                    className="bg-destructive text-foreground rounded-2xl font-black"
                  >
                    Remove all cameras
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Webhooks & Automation */}
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Zap className="h-8 w-8" />
            <h2 className="text-xl font-black uppercase tracking-tight">Automation</h2>
          </div>
          <div className="p-8 bg-card/40 border-2 border-border/40 rounded-[2.5rem] space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-foreground/70">Real-time Webhook URL</p>
            <div className="flex gap-3">
              <Input 
                placeholder="https://your-webhook-endpoint.com" 
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="h-14 bg-muted border-0 rounded-2xl font-bold px-6 text-primary"
              />
              <Button onClick={saveWebhook} className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest">
                SAVE
              </Button>
            </div>
          </div>
        </div>

        {/* Force Logout All Devices */}
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 text-orange-400">
            <LockIcon className="w-8 h-8" />
            <h2 className="text-xl font-black uppercase tracking-tight">Session Control</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm font-bold text-orange-400/70 uppercase tracking-widest leading-relaxed">
              Signs out all active devices instantly, clears their local cache, and forces them to re-authenticate. Use if you suspect unauthorized access.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-16 rounded-[2rem] font-black tracking-wide border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
                >
                  <LockIcon className="h-5 w-5 mr-3" />
                  Log out all devices
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-background border-orange-500/40">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black text-orange-400">Force Global Logout?</AlertDialogTitle>
                  <AlertDialogDescription className="text-foreground/70 font-bold uppercase tracking-widest leading-loose">
                    This will immediately sign out ALL devices connected to your account, clear their local caches, and redirect them to the login screen. You will also be signed out.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-2xl border-border font-black">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await forceLogoutAllDevices();
                      // Also sign this device out and clear its own cache
                      await signOut();
                      localStorage.clear();
                      sessionStorage.clear();
                      if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                      }
                      window.location.href = "/login";
                    }}
                    className="bg-orange-500 text-foreground rounded-2xl font-black hover:bg-orange-600"
                  >
                    CONFIRM — LOGOUT ALL
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Button variant="destructive" onClick={handleSignOut} className="zoomon-btn-large w-full h-24 text-3xl font-black bg-destructive hover:bg-destructive/90 shadow-2xl">
          <LogOut className="h-10 w-10" /> DISCONNECT
        </Button>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
