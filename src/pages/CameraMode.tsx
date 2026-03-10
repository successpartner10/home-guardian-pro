import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCamera } from "@/hooks/useCamera";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Flashlight, FlashlightOff, Camera, ArrowLeft, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CameraMode = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const lastMotionRef = useRef(0);
  const [motionCount, setMotionCount] = useState(0);
  const [resolvedDeviceId, setResolvedDeviceId] = useState<string | null>(deviceId || null);

  // Resolve device ID if not provided in URL
  useEffect(() => {
    if (deviceId || !user) return;
    const resolve = async () => {
      let { data } = await supabase
        .from("devices")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "camera")
        .limit(1)
        .single();

      if (!data) {
        // Create it if it doesn't exist, fixing "Offline" bug for fresh sessions
        const { data: newData } = await supabase.from("devices").insert({
          user_id: user.id,
          name: `${navigator.platform} Camera`,
          type: "camera" as const,
          status: "online" as const,
          pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        }).select().single();

        data = newData;
      }

      if (data) setResolvedDeviceId(data.id);
    };
    resolve();
  }, [deviceId, user]);

  const handleMotion = useCallback(
    async (imageData: string) => {
      const now = Date.now();
      if (now - lastMotionRef.current < 10000) return;
      lastMotionRef.current = now;
      setMotionCount((c) => c + 1);

      if (!user || !resolvedDeviceId) return;

      await supabase.from("alerts").insert({
        device_id: resolvedDeviceId,
        user_id: user.id,
        type: "motion",
      });
    },
    [user, resolvedDeviceId]
  );

  const { videoRef, canvasRef, isActive, isMuted, flashOn, error, stream, soundLevel, startCamera, stopCamera, toggleMute, toggleFlash, takeSnapshot } =
    useCamera({ onMotionDetected: handleMotion, motionSensitivity: 50 });

  const { connectionState, isConnected } = useWebRTC({
    deviceId: resolvedDeviceId || "",
    role: "camera",
    localStream: stream,
  });

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Update device status when active changes
  useEffect(() => {
    if (!user || !resolvedDeviceId || !isActive) return;
    const setOnline = async () => {
      await supabase
        .from("devices")
        .update({ status: "online", last_seen: new Date().toISOString() })
        .eq("id", resolvedDeviceId);
    };
    setOnline();
  }, [isActive, user, resolvedDeviceId]);

  // Set offline only when component unmounts
  useEffect(() => {
    if (!user || !resolvedDeviceId) return;
    return () => {
      // Use fire-and-forget for unmount cleanup
      supabase
        .from("devices")
        .update({ status: "offline", last_seen: new Date().toISOString() })
        .eq("id", resolvedDeviceId)
        .then();
    };
  }, [user, resolvedDeviceId]);

  const handleSnapshot = async () => {
    const dataUrl = takeSnapshot();
    if (dataUrl) {
      toast({ title: "Snapshot taken", description: "Image captured successfully." });

      // If Google Drive is connected, upload it
      import("@/lib/driveService").then(async ({ driveService }) => {
        if (driveService.isReady()) {
          try {
            // Convert base64 Data URL to Blob
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const filename = `Snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;

            toast({ title: "Uploading...", description: "Saving to Google Drive." });
            await driveService.uploadFile(blob, filename);
            toast({ title: "Cloud Save Complete", description: "Snapshot saved to Google Drive safely." });
          } catch (e) {
            console.error(e);
            toast({ title: "Upload Failed", description: "Could not save to Google Drive.", variant: "destructive" });
          }
        }
      });
    }
  };

  const viewerConnected = isConnected || connectionState === "connecting";

  return (
    <div className="relative flex min-h-screen flex-col bg-black overflow-hidden tracking-tight">
      {/* Video feed */}
      <div className="relative flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {/* 360 Sound Radar Overlay */}
        {!isMuted && soundLevel > 5 && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="absolute rounded-full border border-primary/40 bg-primary/10 transition-all duration-75 ease-out"
              style={{
                width: `${100 + soundLevel * 3}px`,
                height: `${100 + soundLevel * 3}px`,
                opacity: soundLevel > 50 ? 0.6 : 0.3,
                boxShadow: `0 0 ${soundLevel}px hsl(var(--primary) / 0.5)`
              }}
            />
            <div
              className="absolute rounded-full border border-primary/20 bg-primary/5 transition-all duration-150 ease-out delay-75"
              style={{
                width: `${150 + soundLevel * 4}px`,
                height: `${150 + soundLevel * 4}px`,
                opacity: soundLevel > 70 ? 0.4 : 0.1,
              }}
            />
          </div>
        )}

        {/* Top Status Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pt-safe">
          <div className="flex gap-3 items-center">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 border border-white/10 backdrop-blur-md hover:bg-black/60 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>

            <div className="flex items-center gap-2 rounded-full bg-black/40 border border-white/10 px-3 py-1.5 backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]" />
              <span className="text-xs font-semibold text-white tracking-widest">LIVE</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {viewerConnected && (
              <div className="flex items-center gap-2 rounded-full bg-primary/80 border border-primary/50 px-3 py-1.5 backdrop-blur-md shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
                <Users className="h-3.5 w-3.5 text-primary-foreground" />
                <span className="text-xs font-semibold text-primary-foreground">Viewer Connected</span>
              </div>
            )}

            {!isMuted && (
              <div className="flex flex-col items-end gap-1 mt-2">
                <span className="text-[10px] uppercase font-bold text-white/70 tracking-widest">Sound Detection</span>
                <div className="flex gap-1 h-3 items-end">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 rounded-t-sm transition-all duration-75 ${soundLevel > i * 20 ? 'bg-primary' : 'bg-white/20'}`}
                      style={{ height: soundLevel > i * 20 ? `${Math.max(40, (soundLevel - i * 20) * 2)}%` : '20%' }}
                    />
                  ))}
                </div>
              </div>
            )}

            {motionCount > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-destructive/80 border border-destructive/50 px-3 py-1.5 backdrop-blur-md mt-2 shadow-[0_0_15px_hsl(var(--destructive)/0.3)]">
                <span className="text-xs font-bold text-destructive-foreground">Motion events: {motionCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right side floating controls (Zoom/Tools) */}
        {isConnected && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40">
            {/* Add hidden audio element to play incoming 2-way audio stream */}
            {stream && <audio autoPlay className="hidden" ref={(el) => {
              if (el && !el.srcObject && stream) {
                // We get the incoming audio from the remote viewer via the peer connection
                // This is handled in useWebRTC, but we need an audio element to play it
              }
            }} />}

            <div className="flex flex-col items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1.5 shadow-2xl">
              <span className="text-[10px] font-bold text-white/70 py-1">LIVE</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md z-50">
            <div className="bg-card/20 p-8 rounded-3xl border border-white/10 glass-panel max-w-sm text-center space-y-4">
              <div className="h-16 w-16 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto mb-2">
                <Camera className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Camera Access Error</h3>
              <p className="text-white/70 text-sm leading-relaxed">{error}</p>
              <Button onClick={startCamera} className="w-full mt-4 h-12 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
                Retry Connection
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-black/80 border-t border-white/10 p-6 pb-safe backdrop-blur-xl relative z-20">
        <div className="flex items-center justify-center gap-8 max-w-sm mx-auto">
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              className={`h-14 w-14 rounded-full border-white/10 transition-colors ${!isMuted ? 'bg-primary/20 text-primary border-primary/50' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            <span className="text-[10px] font-medium text-white/50 uppercase tracking-widest">{isMuted ? 'Mic Off' : 'Mic On'}</span>
          </div>

          <Button
            size="icon"
            onClick={handleSnapshot}
            className="h-20 w-20 rounded-full bg-primary hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_hsl(var(--primary)/0.4)] border-4 border-black"
          >
            <Camera className="h-8 w-8 text-primary-foreground" />
          </Button>

          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFlash}
              className={`h-14 w-14 rounded-full border-white/10 transition-colors ${flashOn ? 'bg-primary/20 text-primary border-primary/50' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              {flashOn ? <Flashlight className="h-6 w-6" /> : <FlashlightOff className="h-6 w-6" />}
            </Button>
            <span className="text-[10px] font-medium text-white/50 uppercase tracking-widest">{flashOn ? 'Flash On' : 'Flash Off'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraMode;
