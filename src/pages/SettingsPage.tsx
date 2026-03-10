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
import { Trash2, Save, LogOut, DownloadCloud, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { driveService, DriveFile } from "@/lib/driveService";
import type { Tables } from "@/integrations/supabase/types";

type Device = Tables<"devices">;

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensitivity, setSensitivity] = useState(50);
  const [notifications, setNotifications] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [driveConnected, setDriveConnected] = useState(driveService.isReady());
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [userFolders, setUserFolders] = useState<DriveFile[]>([]);
  const [isSettingUpFolder, setIsSettingUpFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("Home Guardian Pro");

  const driveFolderId = user?.user_metadata?.drive_folder_id;

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [devRes, profileRes] = await Promise.all([
        supabase.from("devices").select("*").order("created_at"),
        supabase.from("profiles").select("display_name").eq("user_id", user.id).single(),
      ]);
      if (devRes.data) setDevices(devRes.data);
      if (profileRes.data?.display_name) setDisplayName(profileRes.data.display_name);
    };
    fetch();

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
      setUserFolders(folders);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectFolder = async (folderId: string) => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { drive_folder_id: folderId }
    });
    if (!error) {
      toast({ title: "Storage folder set" });
      loadDriveFiles(folderId);
    } else {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsSettingUpFolder(true);
    try {
      const id = await driveService.createFolder(newFolderName);
      await handleSelectFolder(id);
      setIsSettingUpFolder(false);
    } catch (e) {
      toast({ title: "Folder creation failed", variant: "destructive" });
      setIsSettingUpFolder(false);
    }
  };

  const loadDriveFiles = async (id: string) => {
    try {
      const files = await driveService.listFiles(id);
      setDriveFiles(files);
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to load Drive files", variant: "destructive" });
    }
  };

  const loginGoogle = useGoogleLogin({
    onSuccess: (codeResponse) => {
      driveService.setToken(codeResponse.access_token);
      setDriveConnected(true);
      toast({ title: "Google Drive Connected", description: "Now select or create a folder for storage." });
    },
    onError: (error) => toast({ title: "Login Failed", description: "Could not connect to Google", variant: "destructive" }),
    scope: "https://www.googleapis.com/auth/drive.file",
    prompt: "select_account"
  });

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0 || !driveFolderId) return;
    setIsDeleting(true);
    try {
      await driveService.deleteFiles(Array.from(selectedFiles));
      toast({ title: "Files deleted" });
      setSelectedFiles(new Set());
      await loadDriveFiles(driveFolderId);
    } catch {
      toast({ title: "Delete Failed", variant: "destructive" });
    }
    setIsDeleting(false);
  };

  const toggleFileSelection = (fileId: string) => {
    const next = new Set(selectedFiles);
    if (next.has(fileId)) next.delete(fileId);
    else next.add(fileId);
    setSelectedFiles(next);
  };

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    toast({ title: "Profile saved" });
    setLoading(false);
  };

  const removeDevice = async (id: string) => {
    await supabase.from("devices").delete().eq("id", id);
    setDevices((d) => d.filter((dev) => dev.id !== id));
    toast({ title: "Device removed" });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <AppLayout>
      <div className="p-4 max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* Profile */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-12 bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="h-12 bg-muted/50 opacity-60" />
            </div>
            <Button onClick={saveProfile} disabled={loading} className="gap-2">
              <Save className="h-4 w-4" /> Save
            </Button>
          </CardContent>
        </Card>

        {/* Motion Settings */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Motion Detection</CardTitle>
            <CardDescription>Configure sensitivity for all cameras</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Sensitivity</Label>
                <span className="text-sm text-muted-foreground">{sensitivity}%</span>
              </div>
              <Slider value={[sensitivity]} onValueChange={([v]) => setSensitivity(v)} min={10} max={100} step={5} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Push Notifications</Label>
                <p className="text-xs text-muted-foreground">Get notified on motion events</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
          </CardContent>
        </Card>

        {/* Google Drive Storage */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-primary"><DownloadCloud className="w-5 h-5" /> Cloud Storage</CardTitle>
            <CardDescription>Save snapshots & recordings to your Google Drive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!driveConnected ? (
              <Button onClick={() => loginGoogle()} className="w-full h-12 gap-2" variant="outline">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" /></svg>
                Connect Google Account
              </Button>
            ) : !driveFolderId ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4">
                  <p className="text-sm font-medium">Select a folder for your recordings</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {userFolders.map(folder => (
                      <Button
                        key={folder.id}
                        variant="ghost"
                        className="w-full justify-start text-left h-auto py-2 px-3 hover:bg-primary/10 transition-colors"
                        onClick={() => handleSelectFolder(folder.id)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm truncate font-normal">{folder.name}</p>
                          <p className="text-[10px] opacity-50">Created {new Date(folder.createdTime).toLocaleDateString()}</p>
                        </div>
                      </Button>
                    ))}
                    {userFolders.length === 0 && <p className="text-xs text-muted-foreground italic py-2">No folders found.</p>}
                  </div>

                  <div className="pt-2 border-t border-primary/10">
                    <p className="text-xs text-muted-foreground mb-2">Or create a new one:</p>
                    <div className="flex gap-2">
                      <Input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder Name"
                        className="h-10 bg-background/50"
                      />
                      <Button onClick={handleCreateFolder} disabled={isSettingUpFolder || !newFolderName.trim()}>
                        {isSettingUpFolder ? "..." : "Create"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 text-sm text-green-500 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>
                    Connected to Drive
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold tracking-wider" onClick={() => handleSelectFolder("")}>Change Folder</Button>
                </div>

                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex gap-3 text-sm text-destructive items-start">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Automated Storage Limit</p>
                    <p className="opacity-80">Oldest files are automatically deleted when this folder exceeds 10GB.</p>
                  </div>
                </div>

                <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {driveFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No recordings saved in this folder yet.</p>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{driveFiles.length} files</span>
                        {selectedFiles.size > 0 && (
                          <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={isDeleting} className="h-8">
                            {isDeleting ? "Deleting..." : `Delete (${selectedFiles.size})`}
                          </Button>
                        )}
                      </div>
                      {driveFiles.map(file => (
                        <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 hover:bg-muted/50 transition-colors">
                          <Switch
                            checked={selectedFiles.has(file.id)}
                            onCheckedChange={() => toggleFileSelection(file.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(file.createdTime).toLocaleDateString()} · {(parseInt(file.size || "0") / 1024 / 1024).toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Devices */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Devices</CardTitle>
            <CardDescription>Manage paired devices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices paired yet.</p>
            ) : (
              devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{d.type} · {d.status}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeDevice(d.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Separator />

        <Button variant="destructive" onClick={handleSignOut} className="w-full h-12 gap-2">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
