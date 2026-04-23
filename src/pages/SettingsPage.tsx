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
  orderBy,
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
  HardDrive as DiscIcon, Download, CloudOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { localFileSystem, LocalFile } from "@/lib/localFileSystem";
import { useTheme, ThemeType } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import PinModal from "@/components/PinModal";

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
  const [driveQuota, setDriveQuota] = useState<{ used: number, limit: number } | null>(null);
  const [activeBrain, setActiveBrain] = useState(aiOrchestrator.getProviderId());
  const [autoUpgrade, setAutoUpgrade] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");

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
      setWebhookUrl(profileData.webhook_url || "");
      setAutoUpgrade(profileData.auto_upgrade_ai ?? true);
    }
  }, [profileData, user]);

  useEffect(() => {
    if (!user) return;

    // Fetch devices
    const q = query(collection(db, "devices"), where("user_id", "==", user.uid), orderBy("created_at", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDevices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device)));
    });

    return () => unsubscribe();
  }, [user]);

  const saveArchiveLimit = async (val: number[]) => {
    const limit = val[0];
    setArchiveLimit(limit);
    if (!user) return;
    try {
      await updateDoc(doc(db, "profiles", user.uid), { archive_limit_gb: limit });
      toast({ title: "Storage Limit Updated", description: `FIFO buffer set to ${limit} GB.` });
    } catch (e) {
      console.error(e);
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
        <div className="space-y-2">
          <h1 className="text-4xl font-black uppercase leading-none">Settings</h1>
          <p className="text-lg text-muted-foreground font-medium">Control your security mesh and visual style.</p>
        </div>

        {/* Alert Preferences */}
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Bell className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Alert Preferences</h2>
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
        <div className="zoomon-card space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <Clock className="w-8 h-8" />
              <h2 className="text-2xl font-black uppercase tracking-tight">Focus Hours</h2>
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
                className="h-12 bg-zinc-900/60 border-0 text-xl font-black rounded-xl"
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
                className="h-12 bg-zinc-900/60 border-0 text-xl font-black rounded-xl"
                disabled={!schedule.enabled}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3 text-primary">
              <Shield className="w-8 h-8" />
              <h2 className="text-2xl font-black uppercase tracking-tight">AI Filter</h2>
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
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <LockIcon className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Security & PIN</h2>
          </div>
          <div className="space-y-6">
            <div className="p-6 bg-primary/5 border-2 border-primary/20 rounded-[2.5rem] space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-black uppercase leading-none">Deletion Guard</p>
                  <p className="text-sm font-bold opacity-80 uppercase tracking-tight">Requires 4-digit PIN for destructive actions.</p>
                </div>
                {securityPin ? (
                  <UnlockIcon className="w-8 h-8 text-green-500" />
                ) : (
                  <LockIcon className="w-8 h-8 text-white/20" />
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
                  className="h-14 font-black text-2xl tracking-[0.5em] text-center rounded-2xl bg-zinc-900/70 border-2"
                />
                <Button onClick={savePin} disabled={loading || newPin.length !== 4} size="lg" className="h-14 px-8 rounded-2xl font-black">
                  {securityPin ? "UPDATE" : "SET"}
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
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <HardDrive className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Storage Control</h2>
          </div>
          
          <div className="p-6 bg-primary/5 border-2 border-primary/20 rounded-[2rem] space-y-8">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-lg font-black uppercase leading-none">Cloud Snapshot Limit</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={archiveLimit}
                    onChange={(e) => saveArchiveLimit([parseInt(e.target.value) || 0])}
                    className="w-20 h-10 bg-black/40 border-white/10 text-center font-black rounded-xl"
                  />
                  <span className="text-[10px] font-black text-white/40 uppercase">GB</span>
                </div>
              </div>
              
              <p className="text-xs font-bold opacity-80 uppercase tracking-tight">Set your FIFO buffer size. Older non-starred clips will be purged.</p>

              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-[1.5rem]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <DiscIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <Label className="text-sm font-bold uppercase tracking-widest">Drive Status</Label>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                      {driveQuota 
                        ? `${Math.round(driveQuota.used / 1024 / 1024 / 1024 * 10) / 10} GB of ${Math.round(driveQuota.limit / 1024 / 1024 / 1024)} GB used`
                        : "Info Not Available — Connect Drive"}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-1 shrink-0" />
                <p className="text-[11px] text-yellow-500/80 leading-relaxed font-medium">
                  When your Google Drive usage for HGUARD exceeds <span className="font-bold text-yellow-400">{archiveLimit} GB</span>, the oldest recordings will be automatically purged to maintain your safety buffer (FIFO).
                </p>
              </div>
            </div>

            {driveQuota && (
              <div className="space-y-3 pt-4 border-t border-primary/10">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest leading-none">
                  <span className="text-primary">Drive Usage</span>
                  <span className="opacity-60">{Math.round(driveQuota.used / 1024 / 1024 / 1024 * 10) / 10} GB / {Math.round(driveQuota.limit / 1024 / 1024 / 1024)} GB</span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden border border-white/5">
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
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <ShieldCheck className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Account Sync</h2>
          </div>
          <div className={cn(
            "p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between",
            localStorage.getItem("google_drive_token") ? "bg-green-500/10 border-green-500/30" : "bg-card/40 border-border/40"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn("h-4 w-4 rounded-full", localStorage.getItem("google_drive_token") ? "bg-green-500 animate-pulse" : "bg-white/20")} />
              <div>
                <p className="text-lg font-black uppercase leading-none">Google Drive</p>
                <p className="text-xs font-bold opacity-80 uppercase tracking-tight">
                  {localStorage.getItem("google_drive_token") ? "Authorized & Linked" : "Not Linked"}
                </p>
              </div>
            </div>
            <Button
              variant={localStorage.getItem("google_drive_token") ? "outline" : "default"}
              onClick={signInWithGoogle}
              className="rounded-xl font-black uppercase tracking-widest text-[10px]"
            >
              {localStorage.getItem("google_drive_token") ? "MANAGE ACCESS" : "CONNECT DRIVE"}
            </Button>
          </div>
        </div>

        {/* AI Intelligence Brain */}
        <div className="zoomon-card space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <Brain className="w-8 h-8" />
              <h2 className="text-2xl font-black uppercase tracking-tight">AI Intelligence</h2>
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

        {/* Nuclear Mesh Reset Card */}

        <div className="zoomon-card border-destructive/20 bg-destructive/5 space-y-6">
          <div className="flex items-center gap-3 text-destructive">
            <Zap className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">System Purge</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm font-bold text-destructive/60 uppercase tracking-widest leading-relaxed">
              If your mesh is displaying 'Ghost' cameras or stale devices, use this tool to wipe the slate clean.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full h-16 rounded-[2rem] font-black uppercase tracking-widest">
                  RESET SECURITY MESH
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-zinc-950 border-destructive/50">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-black text-destructive italic underline">NUCLEAR PURGE</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/70 font-bold uppercase tracking-widest leading-loose">
                    This will PERMANENTLY DELETE all camera records from your account. You will need to restart every camera manually.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-2xl border-white/10 font-black">CANCEL</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={async () => {
                      if (!user) return;
                      const q = query(collection(db, "devices"), where("user_id", "==", user.uid));
                      const snap = await getDocs(q);
                      for (const d of snap.docs) await deleteDoc(doc(db, "devices", d.id));
                      window.location.reload();
                    }}
                    className="bg-destructive text-white rounded-2xl font-black"
                  >
                    CONFIRM PURGE
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Webhooks & Automation */}
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Zap className="h-8 w-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Automation</h2>
          </div>
          <div className="p-8 bg-card/40 border-2 border-border/40 rounded-[2.5rem] space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Real-time Webhook URL</p>
            <div className="flex gap-3">
              <Input 
                placeholder="https://your-webhook-endpoint.com" 
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="h-14 bg-zinc-900/70 border-0 rounded-2xl font-bold px-6 text-primary"
              />
              <Button onClick={saveWebhook} className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest">
                SAVE
              </Button>
            </div>
          </div>
        </div>

        {/* Force Logout All Devices */}
        <div className="zoomon-card border-orange-500/20 bg-orange-500/5 space-y-6">
          <div className="flex items-center gap-3 text-orange-400">
            <LockIcon className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Session Control</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm font-bold text-orange-400/70 uppercase tracking-widest leading-relaxed">
              Signs out all active devices instantly, clears their local cache, and forces them to re-authenticate. Use if you suspect unauthorized access.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-16 rounded-[2rem] font-black uppercase tracking-widest border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
                >
                  <LockIcon className="h-5 w-5 mr-3" />
                  FORCE LOGOUT ALL DEVICES
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-zinc-950 border-orange-500/40">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-black text-orange-400">Force Global Logout?</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/70 font-bold uppercase tracking-widest leading-loose">
                    This will immediately sign out ALL devices connected to your account, clear their local caches, and redirect them to the login screen. You will also be signed out.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-2xl border-white/10 font-black">CANCEL</AlertDialogCancel>
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
                    className="bg-orange-500 text-white rounded-2xl font-black hover:bg-orange-600"
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
