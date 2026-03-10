import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCamera } from "@/hooks/useCamera";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Button } from "@/components/ui/button";
import { Moon, Sun, AlertTriangle, Mic, MicOff, Flashlight, FlashlightOff, Camera, ArrowLeft, Users, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const CameraMode = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const lastMotionRef = useRef(0);
  const [motionCount, setMotionCount] = useState(0);
  const [resolvedDeviceId, setResolvedDeviceId] = useState<string | null>(deviceId || null);
  const [nightVision, setNightVision] = useState(false);
  const [autoNightVision, setAutoNightVision] = useState(true);
  const [sirenActive, setSirenActive] = useState(false);
  const sirenRef = useRef<OscillatorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const toggleSiren = async () => {
    if (sirenActive) {
      if (sirenRef.current) {
        try {
          sirenRef.current.stop();
        } catch (e) {
          console.error("Stop error", e);
        }
      }
      setSirenActive(false);
    } else {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();

      osc.type = "sawtooth";
      const now = audioCtxRef.current.currentTime;
      osc.frequency.setValueAtTime(800, now);
      for (let i = 0; i < 60; i++) {
        osc.frequency.exponentialRampToValueAtTime(1200, now + i * 1 + 0.5);
        osc.frequency.exponentialRampToValueAtTime(800, now + i * 1 + 1);
      }
      gain.gain.setValueAtTime(0.5, now);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      sirenRef.current = osc;
      setSirenActive(true);
    }
  };

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
    async (imageData: string, objectLabel?: string) => {
      setMotionCount((c) => c + 1);
      if (!user || !resolvedDeviceId) return;

      let thumbnail_url = null;
      const folderId = user?.user_metadata?.drive_folder_id;

      try {
        const { driveService } = await import("@/lib/driveService");
        if (driveService.isReady() && folderId) {
          const res = await fetch(imageData);
          const blob = await res.blob();
          const filename = `${objectLabel || 'Motion'}_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
          const driveFile = await driveService.uploadFile(blob, filename, folderId);
          thumbnail_url = driveFile.thumbnailLink || null;
        }
      } catch (e) {
        console.error("Failed to upload motion thumbnail:", e);
      }

      await supabase.from("alerts").insert({
        device_id: resolvedDeviceId,
        user_id: user.id,
        type: objectLabel ? `motion:${objectLabel}` : "motion",
        thumbnail_url: thumbnail_url,
      });
    },
    [user, resolvedDeviceId]
  );

  const handleSound = useCallback(async () => {
    if (!user || !resolvedDeviceId) return;
    await supabase.from("alerts").insert({
      device_id: resolvedDeviceId,
      user_id: user.id,
      type: "sound",
    });
  }, [user, resolvedDeviceId]);

  const { videoRef, canvasRef, isActive, isMuted, flashOn, error, stream, soundLevel, brightness, detectedObjects, startCamera, stopCamera, toggleMute, toggleFlash, takeSnapshot } =
    useCamera({
      onMotionDetected: handleMotion,
      onSoundDetected: handleSound,
      motionSensitivity: 50,
      soundSensitivity: 60
    });

  // Auto Night Vision Logic
  useEffect(() => {
    if (autoNightVision) {
      if (brightness < 30 && !nightVision) setNightVision(true);
      if (brightness > 50 && nightVision) setNightVision(false);
    }
  }, [brightness, autoNightVision, nightVision]);

  // Auto Start Camera
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Update device status in Supabase
  useEffect(() => {
    if (!resolvedDeviceId) return;

    const updateStatus = async () => {
      await supabase
        .from("devices")
        .update({ status: isActive ? "online" : "offline" })
        .eq("id", resolvedDeviceId);
    };
    updateStatus();
  }, [isActive, resolvedDeviceId]);

  const { isConnected: viewerConnected } = useWebRTC({
    deviceId: resolvedDeviceId || "",
    role: "camera",
    localStream: stream,
  });

  const handleSnapshot = () => {
    const data = takeSnapshot();
    if (data) {
      toast({ title: "Snapshot Captured", description: "Saved to your device." });
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-black overflow-hidden tracking-tighter">
      {/* Video feed */}
      <div className="relative flex-1">
        <video
          ref={videoRef}
          className={cn("h-full w-full object-cover transition-all duration-700", nightVision && "night-vision-filter")}
          autoPlay
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* 360° Tactical Radar Overlay */}
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center opacity-40">
          <div className="relative h-[280px] w-[280px]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border border-primary/20"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1/2 w-1 bg-gradient-to-t from-primary/60 via-primary/10 to-transparent origin-bottom" />
            </motion.div>

            <div className="absolute inset-[40px] rounded-full border border-primary/10" />
            <div className="absolute inset-[80px] rounded-full border border-primary/10" />

            {/* AI Object Markers on Radar */}
            {detectedObjects.map((obj, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute h-6 w-6 bg-primary rounded-full shadow-[0_0_20px_hsl(var(--primary))] flex items-center justify-center"
                style={{
                  left: `${(obj.bbox[0] / (videoRef.current?.videoWidth || 640)) * 100}%`,
                  top: `${(obj.bbox[1] / (videoRef.current?.videoHeight || 480)) * 100}%`
                }}
              >
                <div className="text-[8px] font-black text-primary-foreground uppercase mt-8">{obj.class}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Top Status Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start bg-gradient-to-b from-black/90 to-transparent pt-safe z-30">
          <div className="flex gap-4 items-center">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/60 border-2 border-white/20 backdrop-blur-xl hover:bg-black/80 transition-all active:scale-95 shadow-2xl"
            >
              <ArrowLeft className="h-7 w-7 text-white" />
            </button>

            <div className="flex items-center gap-3 rounded-2xl bg-black/60 border-2 border-white/20 px-4 py-2 backdrop-blur-xl shadow-2xl">
              <span className="h-3 w-3 animate-pulse rounded-full bg-destructive shadow-[0_0_15px_hsl(var(--destructive))]" />
              <span className="text-sm font-black text-white tracking-widest uppercase">REC LIVE</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-black/60 border-2 border-white/10 px-4 py-2 backdrop-blur-xl">
              <Zap className={cn("h-4 w-4", brightness > 50 ? "text-yellow-400" : "text-white/40")} />
              <span className="text-xs font-bold text-white uppercase">{brightness}% LIGHT</span>
            </div>

            {detectedObjects.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 rounded-2xl bg-primary border-2 border-primary/50 px-4 py-2 backdrop-blur-xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
              >
                <div className="h-2 w-2 rounded-full bg-white animate-ping" />
                <span className="text-xs font-black text-white uppercase tracking-tighter">
                  {detectedObjects[0].class} DETECTED
                </span>
              </motion.div>
            )}

            {viewerConnected && (
              <div className="flex items-center gap-2 rounded-2xl bg-primary border-2 border-primary/50 px-4 py-2 backdrop-blur-xl shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)]">
                <Users className="h-4 w-4 text-primary-foreground" />
                <span className="text-xs font-black text-primary-foreground uppercase tracking-tight">VIEWER CONNECTED</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar (ZoomOn Style) */}
      <div className="bg-black/95 border-t-2 border-white/10 p-4 pb-safe backdrop-blur-3xl relative z-40">
        <div className="grid grid-cols-5 gap-3 max-w-2xl mx-auto items-center">

          {/* Siren */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSiren}
              className={cn("h-14 w-14 rounded-2xl border-2 transition-all duration-300", sirenActive ? "bg-destructive text-destructive-foreground border-destructive animate-bounce" : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10")}
            >
              <AlertTriangle className="h-6 w-6" />
            </Button>
            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none">Siren</span>
          </div>

          {/* Night Vision */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => { setNightVision(!nightVision); setAutoNightVision(false); }}
              className={cn("h-14 w-14 rounded-2xl border-2 transition-all duration-300", nightVision ? "bg-primary/20 text-primary border-primary" : "bg-white/5 text-white/70 border-white/10")}
            >
              {nightVision ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />}
            </Button>
            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none">{nightVision ? 'Night' : 'Day'}</span>
          </div>

          {/* Snapshot (Center Big) */}
          <div className="flex flex-col items-center gap-2 -mt-2">
            <Button
              size="icon"
              onClick={handleSnapshot}
              className="h-20 w-20 rounded-[2rem] bg-primary hover:bg-primary/90 hover:scale-110 active:scale-95 transition-all shadow-[0_0_50px_rgba(var(--primary-rgb),0.6)] border-4 border-black group"
            >
              <div className="relative">
                <Camera className="h-8 w-8 text-primary-foreground group-hover:rotate-12 transition-transform" />
              </div>
            </Button>
          </div>

          {/* Mic */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              className={cn("h-14 w-14 rounded-2xl border-2 transition-all duration-300", !isMuted ? "bg-primary/20 text-primary border-primary" : "bg-white/5 text-white/70 border-white/10")}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none">Mic</span>
          </div>

          {/* Flash */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFlash}
              className={cn("h-14 w-14 rounded-2xl border-2 transition-all duration-300", flashOn ? "bg-yellow-500/20 text-yellow-500 border-yellow-500" : "bg-white/5 text-white/70 border-white/10")}
            >
              {flashOn ? <Flashlight className="h-6 w-6" /> : <FlashlightOff className="h-6 w-6" />}
            </Button>
            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none">Light</span>
          </div>

        </div>
      </div>

      {isActive && (
        <div className="hidden">
          <Button onClick={startCamera}>Start</Button>
          <Button onClick={stopCamera}>Stop</Button>
        </div>
      )}
    </div>
  );
};

export default CameraMode;
