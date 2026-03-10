import React, { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCamera } from "@/hooks/useCamera";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useBattery } from "@/hooks/useBattery";
import { useNetwork } from "@/hooks/useNetwork";
import { Button } from "@/components/ui/button";
import {
  Moon, Sun, AlertTriangle, Mic, MicOff, Flashlight, FlashlightOff,
  Camera, ArrowLeft, Users, Zap, Battery as BatteryIcon, WifiOff,
  RefreshCcw, Lock as Padlock, Maximize, ChevronRight, Settings, Plus, RotateCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ZonePicker } from "@/components/ZonePicker";

interface PendingAlert {
  type: string;
  thumbnail_url?: string | null;
  created_at: string;
}

const RadarOverlay = ({ detectedObjects, videoWidth, videoHeight }: { detectedObjects: any[], videoWidth: number, videoHeight: number }) => {
  return (
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
              left: `${(obj.bbox[0] / (videoWidth || 640)) * 100}%`,
              top: `${(obj.bbox[1] / (videoHeight || 480)) * 100}%`
            }}
          >
            <div className="text-[8px] font-black text-primary-foreground uppercase mt-8 text-center w-max whitespace-nowrap">{obj.class}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const MemoRadar = React.memo(RadarOverlay);

const ActionBar = React.memo(({
  toggleSiren,
  sirenActive,
  handleSnapshot,
  isMuted,
  toggleMute,
  flashOn,
  toggleFlash,
  isSmartZoom,
  setIsSmartZoom,
  setIsZonePickerOpen,
  monitoringTime
}: any) => {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4">
      <div className="bg-black/40 backdrop-blur-2xl border-2 border-white/10 rounded-[3rem] p-2 flex items-center justify-between gap-1 shadow-2xl overflow-hidden">
        {/* Recording Status */}
        <div className="flex h-12 w-12 items-center justify-center">
          <motion.div
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-3 w-3 rounded-full bg-destructive shadow-[0_0_10px_red]"
          />
        </div>

        {/* Primary Action (Large Circular Button) */}
        <Button
          onClick={handleSnapshot}
          className="h-16 w-16 rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all active:scale-90 shrink-0"
        >
          <Camera className="h-8 w-8" />
        </Button>

        {/* Functional Icons (Circular & Glassmorphic) */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsZonePickerOpen(true)}
            className="h-12 w-12 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Maximize className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFlash}
            className={cn("h-12 w-12 rounded-full transition-all", flashOn ? "text-yellow-400 bg-yellow-400/10" : "text-white/70 hover:bg-white/10")}
          >
            {flashOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className={cn("h-12 w-12 rounded-full transition-all", isMuted ? "text-white/40 bg-white/5" : "text-white/70 hover:bg-white/10")}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSmartZoom(!isSmartZoom)}
            className={cn("h-12 w-12 rounded-full transition-all", isSmartZoom ? "text-primary bg-primary/10" : "text-white/70 hover:bg-white/10")}
          >
            <Zap className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSiren}
            className={cn("h-12 w-12 rounded-full transition-all", sirenActive ? "text-destructive bg-destructive/10 animate-pulse" : "text-white/70 hover:bg-white/10")}
          >
            <AlertTriangle className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Monitoring Timer */}
      <div className="mt-4 text-center">
        <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">
          Monitoring time <span className="text-white font-mono">{monitoringTime}</span>
        </p>
      </div>
    </div>
  );
});

const CameraMode = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [resolvedDeviceId, setResolvedDeviceId] = useState<string | null>(deviceId || null);
  const [nightVision, setNightVision] = useState(false);
  const [autoNightVision, setAutoNightVision] = useState(true);
  const [sirenActive, setSirenActive] = useState(false);
  const sirenRef = useRef<OscillatorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const battery = useBattery();
  const { isOnline } = useNetwork();

  const [isSmartZoom, setIsSmartZoom] = useState(true);
  const [isCoolingMode, setIsCoolingMode] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState<PendingAlert[]>(() => {
    const saved = localStorage.getItem("pending_cam_alerts");
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isZonePickerOpen, setIsZonePickerOpen] = useState(false);
  const [monitoringSeconds, setMonitoringSeconds] = useState(0);

  // Monitoring Timer effect
  useEffect(() => {
    const timer = setInterval(() => setMonitoringSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secondsLabel: number) => {
    const h = Math.floor(secondsLabel / 3600).toString().padStart(2, '0');
    const m = Math.floor((secondsLabel % 3600) / 60).toString().padStart(2, '0');
    const s = (secondsLabel % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const aiFrequency = isCoolingMode ? 60 : (battery.level < 15 && !battery.isCharging ? 30 : 10);

  const toggleSiren = async () => {
    if (sirenActive) {
      sirenRef.current?.stop();
      setSirenActive(false);
    } else {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();

      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(800, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.5, audioCtxRef.current.currentTime);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      sirenRef.current = osc;
      setSirenActive(true);
    }
  };

  useEffect(() => {
    if (deviceId || !user) return;
    const resolve = async () => {
      let { data } = await supabase.from("devices").select("id").eq("user_id", user.id).eq("type", "camera").limit(1).single();
      if (!data) {
        const { data: newData } = await supabase.from("devices").insert({
          user_id: user.id,
          name: `${navigator.platform} Camera`,
          type: "camera",
          status: "online",
          pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        }).select().single();
        data = newData;
      }
      if (data) setResolvedDeviceId(data.id);
    };
    resolve();
  }, [deviceId, user]);

  const handleMotion = useCallback(async (imageData: string, objectLabel?: string) => {
    if (!user || !resolvedDeviceId) return;
    let thumbnail_url = null;
    try {
      const res = await fetch(imageData);
      const blob = await res.blob();
      const filename = `${user.id}/${Date.now()}.jpg`;
      const { data } = await supabase.storage.from('snapshots').upload(filename, blob, { contentType: 'image/jpeg' });
      if (data) thumbnail_url = supabase.storage.from('snapshots').getPublicUrl(filename).data.publicUrl;
    } catch (e) {
      console.error(e);
    }
    const alertData = { device_id: resolvedDeviceId, user_id: user.id, type: objectLabel ? `motion:${objectLabel}` : "motion", thumbnail_url };
    if (!isOnline) {
      const newPending = [...pendingAlerts, { ...alertData, created_at: new Date().toISOString() }];
      setPendingAlerts(newPending);
      localStorage.setItem("pending_cam_alerts", JSON.stringify(newPending));
    } else {
      await supabase.from("alerts").insert(alertData);
    }
  }, [user, resolvedDeviceId, isOnline, pendingAlerts]);

  const handleSound = useCallback(async () => {
    if (!user || !resolvedDeviceId) return;
    const alertData = { device_id: resolvedDeviceId, user_id: user.id, type: "sound" };
    if (!isOnline) {
      const newPending = [...pendingAlerts, { ...alertData, created_at: new Date().toISOString() }];
      setPendingAlerts(newPending);
      localStorage.setItem("pending_cam_alerts", JSON.stringify(newPending));
    } else {
      await supabase.from("alerts").insert(alertData);
    }
  }, [user, resolvedDeviceId, isOnline, pendingAlerts]);

  const { videoRef, canvasRef, isActive, isMuted, flashOn, brightness, detectedObjects, zoomLevel, zoomCenter, detectionZone, setDetectionZone, startCamera, stopCamera, toggleMute, toggleFlash, takeSnapshot } =
    useCamera({ onMotionDetected: handleMotion, onSoundDetected: handleSound, aiFrequency, autoZoom: isSmartZoom });

  useEffect(() => {
    if (autoNightVision) {
      if (brightness < 30 && !nightVision) setNightVision(true);
      if (brightness > 50 && nightVision) setNightVision(false);
    }
  }, [brightness, autoNightVision, nightVision]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const { isConnected: viewerConnected } = useWebRTC({ deviceId: resolvedDeviceId || "", role: "camera", localStream: videoRef.current?.srcObject as MediaStream });

  const handleSnapshot = () => {
    if (takeSnapshot()) toast({ title: "Snapshot Captured", description: "Saved to your device." });
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none touch-none">
      {/* Edge-to-Edge Video */}
      <video
        ref={videoRef}
        className={cn("absolute inset-0 h-full w-full object-cover transition-all duration-1000", nightVision && "night-vision-filter")}
        style={{ transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`, transform: `scale(${zoomLevel})` }}
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Premium HUD Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start z-30 bg-gradient-to-b from-black/60 to-transparent pt-safe">
        {/* Left HUD */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-12 w-12 rounded-full bg-black/40 border border-white/10 backdrop-blur-md text-white/80 hover:bg-white/10"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-lg">hGuard</h1>
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
              <WifiOff className={cn("h-5 w-5", isOnline ? "text-white/20" : "text-destructive animate-pulse")} />
            </div>
            <div className="h-10 w-14 flex items-center justify-center rounded-full bg-black/40 border border-white/10 backdrop-blur-md gap-1">
              <BatteryIcon className={cn("h-4 w-4", battery.isCharging ? "text-green-400" : "text-white/60")} />
              <span className="text-[10px] font-black text-white/80 uppercase">{battery.level}%</span>
            </div>
          </div>
        </div>

        {/* Center HUD */}
        <div className="text-center space-y-1">
          <div className="text-3xl font-black text-white tracking-widest leading-none drop-shadow-2xl">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1 px-4 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">{isMuted ? 'SILENT' : 'ACTIVE'}</span>
            <ChevronRight className="h-3 w-3 text-white/20" />
          </div>
        </div>

        {/* Right HUD */}
        <div className="flex flex-col gap-3 items-end">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
              className="h-12 w-12 rounded-full bg-black/40 border border-white/10 backdrop-blur-md text-white/80"
            >
              <Settings className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-black/40 border border-white/10 backdrop-blur-md text-white/80"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex gap-2 p-3 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
            <RotateCw className="h-5 w-5 text-white/40" />
            <Users className={cn("h-5 w-5", viewerConnected ? "text-primary animate-pulse" : "text-white/20")} />
          </div>
        </div>
      </div>

      {/* Tactical Radar Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-150 opacity-20">
        <MemoRadar detectedObjects={detectedObjects} videoWidth={videoRef.current?.videoWidth || 640} videoHeight={videoRef.current?.videoHeight || 480} />
      </div>

      {/* AI Detection Overlay */}
      <AnimatePresence>
        {detectedObjects.length > 0 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute top-24 right-8 z-30">
            <div className="flex items-center gap-3 bg-primary text-white p-4 rounded-2xl shadow-2xl border-2 border-primary/50 backdrop-blur-md">
              <Zap className="h-6 w-6 animate-pulse" />
              <div>
                <p className="text-[10px] font-black uppercase opacity-60">AI Alert</p>
                <p className="text-xl font-black uppercase tracking-tighter">{detectedObjects[0].class} Identified</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Dock */}
      <ActionBar
        toggleSiren={toggleSiren}
        sirenActive={sirenActive}
        handleSnapshot={handleSnapshot}
        isMuted={isMuted}
        toggleMute={toggleMute}
        flashOn={flashOn}
        toggleFlash={toggleFlash}
        isSmartZoom={isSmartZoom}
        setIsSmartZoom={setIsSmartZoom}
        setIsZonePickerOpen={setIsZonePickerOpen}
        monitoringTime={formatTime(monitoringSeconds)}
      />

      <AnimatePresence>
        {isZonePickerOpen && (
          <ZonePicker
            initialZone={detectionZone}
            onCancel={() => setIsZonePickerOpen(false)}
            onConfirm={(zone) => {
              setDetectionZone(zone);
              setIsZonePickerOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CameraMode;
