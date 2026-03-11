import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Trash2, Save, LogOut, DownloadCloud, AlertTriangle, ShieldCheck, Settings2, CloudOff, Lock, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { driveService, DriveFile } from "@/lib/driveService";
import { useTheme, ThemeType } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import PinModal from "@/components/PinModal";
import type { Tables } from "@/integrations/supabase/types";
import { Palette, Bell, VolumeX, Smartphone, Music, Clock, Calendar } from "lucide-react";

type Device = Tables<"devices">;

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
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensitivity, setSensitivity] = useState(50);
  const [notificationPref, setNotificationPref] = useState<"mute" | "vibrate" | "ring">(user?.user_metadata?.notifications || "ring");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [userFolders, setUserFolders] = useState<DriveFile[]>([]);
  const [isSettingUpFolder, setIsSettingUpFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("Home Guardian Pro");

  const [securityPin, setSecurityPin] = useState(user?.user_metadata?.security_pin || "");
  const [newPin, setNewPin] = useState("");
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const [schedule, setSchedule] = useState<{ enabled: boolean, start: string, end: string }>({
    enabled: user?.user_metadata?.detection_schedule?.enabled ?? false,
    start: user?.user_metadata?.detection_schedule?.start ?? "22:00",
    end: user?.user_metadata?.detection_schedule?.end ?? "06:00"
  });

  const isAdmin = user?.email === ADMIN_EMAIL;
  const driveFolderId = user?.user_metadata?.drive_folder_id;

  useEffect(() => {
    if (user?.user_metadata?.security_pin) {
      setSecurityPin(user.user_metadata.security_pin);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      try {
        // 1. Check devices
        const { data } = await supabase.from("devices").select("*").order("created_at");
        if (data) setDevices(data);

        // 2. Load profile
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).single();
        if (profile?.display_name) setDisplayName(profile.display_name);

        // 3. Check Drive status (SSO or manual)
        const isReady = await driveService.isReady();
        setDriveConnected(isReady);
      } catch (e) {
        console.error("Settings initialization error:", e);
      }
    };
    init();
  }, [user]);

  useEffect(() => {
    if (driveConnected) {
      if (driveFolderId) {
        loadDriveFiles(driveFolderId);
      } else {
        fetchUserFolders();
      }
    }
  }, [user, driveConnected, driveFolderId]);

  const fetchUserFolders = async () => {
    try {
      const folders = await driveService.listFolders();
      setUserFolders(folders || []);
    } catch (e) {
      console.error("Fetch folders error:", e);
      toast({ title: "Drive Error", description: "Failed to load folders.", variant: "destructive" });
    }
  };

  const handleSelectFolder = async (folderId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        data: { drive_folder_id: folderId }
      });
      if (!error) {
        toast({ title: "Storage folder set" });
        if (folderId) loadDriveFiles(folderId);
      } else {
        toast({ title: "Failed to update profile", variant: "destructive" });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsSettingUpFolder(true);
    try {
      const id = await driveService.createFolder(newFolderName);
      await handleSelectFolder(id);
    } catch (e) {
      toast({ title: "Folder creation failed", variant: "destructive" });
    } finally {
      setIsSettingUpFolder(false);
    }
  };

  const loadDriveFiles = async (id: string) => {
    if (!id) return;
    try {
      const files = await driveService.listFiles(id);
      setDriveFiles(files || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to load Drive files", variant: "destructive" });
    }
  };



  const loginGoogle = useGoogleLogin({
    onSuccess: (codeResponse) => {
      driveService.setToken(codeResponse.access_token);
      setDriveConnected(true);
      toast({ title: "Google Drive Connected" });
    },
    onError: (error) => toast({ title: "Login Failed", variant: "destructive" }),
    scope: "https://www.googleapis.com/auth/drive.file",
    prompt: "select_account"
  });

  const handleBulkDelete = () => {
    if (selectedFiles.size === 0 || !driveFolderId) return;
    if (securityPin) {
      setIsPinModalOpen(true);
    } else {
      confirmBulkDelete();
    }
  };

  const confirmBulkDelete = async () => {
    setIsPinModalOpen(false);
    setIsDeleting(true);
    try {
      await driveService.deleteFiles(Array.from(selectedFiles));
      toast({ title: "Files deleted" });
      setSelectedFiles(new Set());
      if (driveFolderId) await loadDriveFiles(driveFolderId);
    } catch {
      toast({ title: "Delete Failed", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const savePin = async () => {
    if (newPin.length !== 4) {
      toast({ title: "Invalid PIN", description: "PIN must be exactly 4 digits.", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        data: { security_pin: newPin }
      });
      if (!error) {
        setSecurityPin(newPin);
        setNewPin("");
        toast({ title: "Security PIN Set", description: "Now required for deleting recordings." });
      } else {
        toast({ title: "Failed to set PIN", variant: "destructive" });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    const next = new Set(selectedFiles);
    if (next.has(fileId)) next.delete(fileId);
    else next.add(fileId);
    setSelectedFiles(next);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    if (!error) toast({ title: "Profile saved" });
    setLoading(false);
  };

  const removeDevice = async (id: string) => {
    await supabase.from("devices").delete().eq("id", id);
    setDevices((d) => d.filter((dev) => dev.id !== id));
    toast({ title: "Device removed" });
  };

  const handleNotificationChange = async (pref: "mute" | "vibrate" | "ring") => {
    setNotificationPref(pref);
    const { error } = await supabase.auth.updateUser({
      data: { notifications: pref }
    });
    if (!error) {
      toast({ title: "Alert preference saved", description: `Notifications set to ${pref}.` });
      if (pref === "vibrate" && "vibrate" in navigator) {
        navigator.vibrate(200);
      }
    }
  };

  const saveSchedule = async (newSchedule: typeof schedule) => {
    setSchedule(newSchedule);
    await supabase.auth.updateUser({
      data: { detection_schedule: newSchedule }
    });
    toast({ title: "Schedule Updated", description: `Auto-detection ${newSchedule.enabled ? 'enabled' : 'disabled'}.` });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-10 mb-20 tracking-tighter">
        <div className="space-y-2">
          <h1 className="text-4xl font-black uppercase leading-none">Settings</h1>
          <p className="text-lg text-muted-foreground font-medium">Control your security mesh and visual style.</p>
        </div>

        {/* Visual Style Gallery */}
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Palette className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">App Appearance</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "relative flex flex-col items-center gap-3 p-4 rounded-[2rem] border-2 transition-all group overflow-hidden",
                  theme === t.id ? "border-primary bg-primary/10 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]" : "border-border/40 bg-card/40 hover:border-primary/30"
                )}
              >
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full border-2 border-background shadow-lg" style={{ backgroundColor: t.colors[0] }} />
                  <div className="w-10 h-10 rounded-full border-2 border-background shadow-lg" style={{ backgroundColor: t.colors[1] }} />
                </div>
                <span className={cn("text-[10px] font-black uppercase tracking-widest", theme === t.id ? "text-primary" : "text-muted-foreground")}>
                  {t.label}
                </span>
                {theme === t.id && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            ))}
          </div>
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
          <p className="text-[10px] font-bold text-center opacity-40 uppercase tracking-widest px-4">
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
                className="h-12 bg-black/20 border-0 text-xl font-black rounded-xl"
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
                className="h-12 bg-black/20 border-0 text-xl font-black rounded-xl"
                disabled={!schedule.enabled}
              />
            </div>
          </div>

          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary shrink-0" />
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest leading-normal">
              hGuard will only record events during this window. Automatic night vision will still function.
            </p>
          </div>
        </div>

        {/* Access Control & PIN */}
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Lock className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Security & PIN</h2>
          </div>
          <div className="space-y-6">
            <div className="p-6 bg-primary/5 border-2 border-primary/20 rounded-[2rem] space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-black uppercase leading-none">Deletion Guard</p>
                  <p className="text-sm font-bold opacity-60 uppercase tracking-tight">Requires 4-digit PIN for destructive actions.</p>
                </div>
                {securityPin ? (
                  <Unlock className="w-8 h-8 text-green-500" />
                ) : (
                  <Lock className="w-8 h-8 text-white/20" />
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
                  className="h-14 font-black text-2xl tracking-[0.5em] text-center rounded-2xl bg-black/40 border-2"
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



        {/* Admin Gatekeeper Card */}
        {isAdmin && (
          <div className="zoomon-card space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <ShieldCheck className="w-32 h-32 rotate-12" />
            </div>
            <div className="flex items-center gap-3 text-primary">
              <ShieldCheck className="w-8 h-8" />
              <h2 className="text-2xl font-black uppercase tracking-tight">Gatekeeper</h2>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-bold opacity-60 uppercase tracking-tight max-w-md">
                Manage secure network access. Review pending registrations and approve new viewers.
              </p>
              <Button
                onClick={() => navigate("/users")}
                className="zoomon-btn-large w-full bg-primary/10 border-2 border-primary/20 text-primary hover:bg-primary/20"
              >
                OPEN USER MANAGEMENT
              </Button>
            </div>
          </div>
        )}

        {/* Google Drive Backup Card */}
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <DownloadCloud className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Google Drive Backup</h2>
          </div>

          <div className="space-y-6">
            {!driveConnected ? (
              <div className="space-y-4">
                <Button onClick={() => loginGoogle()} className="zoomon-btn-large w-full bg-background border-2 border-primary text-primary hover:bg-primary/5">
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" /></svg>
                  SYNC ADDITIONAL GOOGLE ACCOUNT
                </Button>
                <p className="text-[10px] font-bold text-center opacity-40 uppercase tracking-widest">
                  Tip: Login with Google on the home screen for automatic sync.
                </p>
              </div>
            ) : !driveFolderId ? (
              <div className="space-y-4">
                <p className="text-lg font-bold uppercase">Select Storage Vault:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {userFolders.map(f => (
                    <Button key={f.id} variant="ghost" className="w-full justify-start h-auto py-4 px-6 rounded-2xl hover:bg-primary/10 text-left border-2 border-transparent hover:border-primary/20" onClick={() => handleSelectFolder(f.id)}>
                      <div className="min-w-0">
                        <p className="text-lg font-black uppercase truncate">{f.name}</p>
                        <p className="text-xs font-bold opacity-40 uppercase tracking-widest">Modified {new Date(f.createdTime).toLocaleDateString()}</p>
                      </div>
                    </Button>
                  ))}
                </div>
                <div className="pt-4 border-t-2 border-border/30 flex gap-3">
                  <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New Folder Name" className="h-14 font-bold rounded-2xl" />
                  <Button onClick={handleCreateFolder} className="h-14 px-8 rounded-2xl" disabled={isSettingUpFolder}>CREATE</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 bg-green-500/10 border-2 border-green-500/30 rounded-[2rem]">
                  <div className="flex items-center gap-4">
                    <div className="relative h-5 w-5"><span className="animate-ping absolute inset-0 rounded-full bg-green-400 opacity-75"></span><span className="relative block h-5 w-5 bg-green-500 rounded-full"></span></div>
                    <span className="text-xl font-black uppercase text-green-500 tracking-tighter">Vault Connected</span>
                  </div>
                  <Button variant="outline" className="h-12 border-2 border-green-500/20 text-green-500 font-black hover:bg-green-500/20" onClick={() => handleSelectFolder("")}>CHANGE</Button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-4">
                    <h3 className="text-xl font-black uppercase tracking-tighter">{driveFiles.length} RECORDINGS</h3>
                    {selectedFiles.size > 0 && (
                      <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting} className="h-14 px-8 font-black rounded-2xl shadow-xl shadow-destructive/40 transition-all">
                        {isDeleting ? "WIPING..." : `DELETE ${selectedFiles.size}`}
                      </Button>
                    )}
                  </div>

                  {securityPin && (
                    <div className="px-4 flex items-center gap-2 text-primary">
                      <ShieldCheck className="w-5 h-5 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-widest opacity-60">Pin Guard Active</span>
                    </div>
                  )}

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                    {driveFiles.map(file => (
                      <div key={file.id} className={cn("flex items-center gap-5 p-5 bg-card border-2 rounded-[2rem] transition-all", selectedFiles.has(file.id) ? "border-destructive/50 bg-destructive/5" : "border-border/40 hover:border-primary/40")}>
                        <Switch checked={selectedFiles.has(file.id)} onCheckedChange={() => toggleFileSelection(file.id)} className="scale-125 data-[state=checked]:bg-destructive" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xl font-black uppercase truncate tracking-tight">{file.name}</p>
                          <p className="text-xs font-bold opacity-40 uppercase tracking-widest">{new Date(file.createdTime).toLocaleTimeString()} · {(parseInt(file.size || "0") / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      </div>
                    ))}
                    {driveFiles.length === 0 && <p className="text-center py-10 font-black opacity-20 uppercase italic">Your vault is empty.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security Hardware Card */}
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Settings2 className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Security Nodes</h2>
          </div>
          <div className="space-y-4">
            {devices.map(d => (
              <div key={d.id} className="flex items-center justify-between p-6 bg-muted/20 border-2 border-border/30 rounded-[2.5rem] group hover:border-primary/50 transition-all">
                <div>
                  <p className="text-2xl font-black uppercase group-hover:text-primary transition-colors">{d.name}</p>
                  <p className="text-sm font-bold opacity-50 uppercase tracking-widest">{d.type} · <span className={cn(d.status === 'online' ? 'text-green-500' : 'text-orange-500')}>{d.status}</span></p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeDevice(d.id)} className="h-16 w-16 rounded-3xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all border-2 border-transparent hover:border-destructive/30">
                  <Trash2 className="h-8 w-8" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button variant="destructive" onClick={handleSignOut} className="zoomon-btn-large w-full h-24 text-3xl font-black bg-destructive hover:bg-destructive/90 shadow-2xl">
          <LogOut className="h-10 w-10" /> DISCONNECT
        </Button>
      </div>

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={confirmBulkDelete}
        correctPin={securityPin}
        title="Confirm Data Wipe"
      />
    </AppLayout>
  );
};

export default SettingsPage;
