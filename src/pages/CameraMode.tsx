import { useEffect, useCallback, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCamera } from "@/hooks/useCamera";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Flashlight, FlashlightOff, Camera, Square, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const CameraMode = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const lastMotionRef = useRef(0);
  const [motionCount, setMotionCount] = useState(0);

  const handleMotion = useCallback(
    async (imageData: string) => {
      const now = Date.now();
      if (now - lastMotionRef.current < 10000) return; // Throttle to every 10s
      lastMotionRef.current = now;
      setMotionCount((c) => c + 1);

      if (!user) return;

      // Get first camera device for this user
      const { data: device } = await supabase
        .from("devices")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "camera")
        .limit(1)
        .single();

      if (device) {
        await supabase.from("alerts").insert({
          device_id: device.id,
          user_id: user.id,
          type: "motion",
        });
      }
    },
    [user]
  );

  const { videoRef, canvasRef, isActive, isMuted, flashOn, error, startCamera, stopCamera, toggleMute, toggleFlash, takeSnapshot } =
    useCamera({ onMotionDetected: handleMotion, motionSensitivity: 50 });

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Update device status
  useEffect(() => {
    if (!user) return;
    const updateStatus = async (status: "online" | "offline") => {
      await supabase
        .from("devices")
        .update({ status, last_seen: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("type", "camera");
    };

    if (isActive) updateStatus("online");
    return () => { updateStatus("offline"); };
  }, [isActive, user]);

  const handleSnapshot = () => {
    const data = takeSnapshot();
    if (data) {
      toast({ title: "Snapshot taken", description: "Image captured successfully." });
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-black">
      {/* Video feed */}
      <div className="relative flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {/* Status overlay */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <button onClick={() => navigate("/dashboard")} className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50 backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
        </div>

        <div className="absolute right-4 top-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-background/50 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            <span className="text-xs font-medium text-foreground">LIVE</span>
          </div>
        </div>

        {motionCount > 0 && (
          <div className="absolute left-4 bottom-24 flex items-center gap-2 rounded-full bg-destructive/80 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-xs font-medium text-destructive-foreground">Motion: {motionCount}</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90">
            <div className="text-center space-y-3">
              <p className="text-destructive font-medium">{error}</p>
              <Button onClick={startCamera}>Retry</Button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 bg-background/80 p-6 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={toggleMute} className="h-14 w-14 rounded-full">
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        <Button size="icon" onClick={handleSnapshot} className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90">
          <Camera className="h-7 w-7" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleFlash} className="h-14 w-14 rounded-full">
          {flashOn ? <FlashlightOff className="h-6 w-6" /> : <Flashlight className="h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
};

export default CameraMode;
