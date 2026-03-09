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
import { Trash2, Save, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
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
  }, [user]);

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
        <Card className="border-border/50 bg-card/80">
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
        <Card className="border-border/50 bg-card/80">
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

        {/* Devices */}
        <Card className="border-border/50 bg-card/80">
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

        <Button variant="destructive" onClick={handleSignOut} className="w-full gap-2">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
