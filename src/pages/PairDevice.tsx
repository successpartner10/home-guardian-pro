import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Monitor, QrCode, Keyboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const PairDevice = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deviceName, setDeviceName] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);

  const setupAsCamera = async () => {
    if (!user) return;
    setLoading(true);
    const code = generateCode();
    setGeneratedCode(code);

    const { error } = await supabase.from("devices").insert({
      user_id: user.id,
      name: deviceName || "Camera",
      type: "camera" as const,
      pairing_code: code,
      status: "offline" as const,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Camera registered!", description: "Share the pairing code with your viewer device." });
    }
    setLoading(false);
  };

  const pairWithCode = async () => {
    if (!user || !pairingCode.trim()) return;
    setLoading(true);

    // Find device by pairing code
    const { data: device, error } = await supabase
      .from("devices")
      .select("*")
      .eq("pairing_code", pairingCode.toUpperCase())
      .single();

    if (error || !device) {
      toast({ title: "Invalid code", description: "No device found with that pairing code.", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Register viewer device linked to same user
    const { error: viewerError } = await supabase.from("devices").insert({
      user_id: user.id,
      name: deviceName || "Viewer",
      type: "viewer" as const,
      status: "online" as const,
    });

    if (viewerError) {
      toast({ title: "Error", description: viewerError.message, variant: "destructive" });
    } else {
      toast({ title: "Paired!", description: `Connected to ${device.name}` });
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="p-4 max-w-lg mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold mb-2">Add Device</h1>
          <p className="text-sm text-muted-foreground mb-6">Set up this device as a camera or pair with an existing one.</p>

          <div className="space-y-4 mb-6">
            <Input
              placeholder="Device name (optional)"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="h-12 bg-muted/50"
            />
          </div>

          <Tabs defaultValue="camera" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50">
              <TabsTrigger value="camera" className="gap-2"><Camera className="h-4 w-4" /> Use as Camera</TabsTrigger>
              <TabsTrigger value="viewer" className="gap-2"><Monitor className="h-4 w-4" /> Pair as Viewer</TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="mt-4">
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-lg">Camera Mode</CardTitle>
                  <CardDescription>This device will stream video to paired viewers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedCode ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="rounded-2xl bg-white p-4">
                        <QRCodeSVG value={generatedCode} size={180} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Pairing Code</p>
                        <p className="text-3xl font-mono font-bold tracking-widest text-primary">{generatedCode}</p>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Enter this code on your viewer device to start monitoring.
                      </p>
                      <Button onClick={() => navigate("/camera")} className="w-full h-12">Start Camera</Button>
                    </div>
                  ) : (
                    <Button onClick={setupAsCamera} disabled={loading} className="w-full h-12">
                      {loading ? "Setting up..." : "Register as Camera"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="viewer" className="mt-4">
              <Card className="border-border/50 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-lg">Pair with Camera</CardTitle>
                  <CardDescription>Enter the code from your camera device.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Enter pairing code"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                    className="h-12 bg-muted/50 text-center text-xl font-mono tracking-widest"
                    maxLength={6}
                  />
                  <Button onClick={pairWithCode} disabled={loading || !pairingCode.trim()} className="w-full h-12">
                    {loading ? "Pairing..." : "Pair Device"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default PairDevice;
