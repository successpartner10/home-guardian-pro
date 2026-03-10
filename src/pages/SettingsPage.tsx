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
import { cn } from "@/lib/utils";
import PinModal from "@/components/PinModal";
import type { Tables } from "@/integrations/supabase/types";

type Device = Tables<"devices">;

const ADMIN_EMAIL = "successpartner10@gmail.com";

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensitivity, setSensitivity] = useState(50);
  const [notifications, setNotifications] = useState(true);
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

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-10 mb-20 tracking-tighter">
        <div className="space-y-2">
          <h1 className="text-4xl font-black uppercase leading-none">Settings</h1>
          <p className="text-lg text-muted-foreground font-medium">Control your security mesh and cloud storage.</p>
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

        {/* Cloud Storage Card */}
        <div className="zoomon-card space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <DownloadCloud className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Cloud Storage</h2>
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
