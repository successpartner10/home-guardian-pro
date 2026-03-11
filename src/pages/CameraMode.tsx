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
  RefreshCcw, Lock as Padlock, Maximize, ChevronRight, Settings, Plus, RotateCw,
  ScanSearch, Tag
} from "lucide-react";
import type { DetectedObject } from "@tensorflow-models/coco-ssd";

// Detection category filters
const DETECTION_CATEGORIES = [
  { id: "all", label: "ALL", classes: null, color: "hsl(var(--primary))" },
  { id: "person", label: "PERSON", classes: ["person"], color: "#3b82f6" },
  { id: "pet", label: "PET", classes: ["cat", "dog", "bird", "horse", "sheep", "cow"], color: "#10b981" },
  { id: "vehicle", label: "VEHICLE", classes: ["car", "truck", "bus", "motorcycle", "bicycle"], color: "#f59e0b" },
  { id: "plant", label: "PLANT", classes: ["potted plant", "vase"], color: "#22c55e" },
  { id: "other", label: "OTHER", classes: "__other__" as any, color: "#a855f7" },
] as const;

type CategoryId = typeof DETECTION_CATEGORIES[number]["id"];

const getCategoryColor = (obj: DetectedObject, activeCategories: Set<CategoryId>): string => {
  // Find the first matching category for this object
  for (const cat of DETECTION_CATEGORIES) {
    if (cat.id === "all" || cat.id === "other") continue;
    if (Array.isArray(cat.classes) && cat.classes.includes(obj.class)) return cat.color;
  }
  return "#a855f7";
};

const filterObjects = (objects: DetectedObject[], activeCategories: Set<CategoryId>): DetectedObject[] => {
  if (activeCategories.has("all")) return objects;
  if (activeCategories.size === 0) return [];
  const knownClasses = DETECTION_CATEGORIES.flatMap(c => (Array.isArray(c.classes) ? c.classes : []));
  return objects.filter(obj => {
    for (const catId of activeCategories) {
      const cat = DETECTION_CATEGORIES.find(c => c.id === catId);
      if (!cat) continue;
      if (catId === "other" && !knownClasses.includes(obj.class)) return true;
      if (Array.isArray(cat.classes) && cat.classes.includes(obj.class)) return true;
    }
    return false;
  });
};

const countByCategory = (objects: DetectedObject[], catId: CategoryId): number => {
  if (catId === "all") return objects.length;
  const cat = DETECTION_CATEGORIES.find(c => c.id === catId);
  if (!cat) return 0;
  if (catId === "other") {
    const knownClasses = DETECTION_CATEGORIES.flatMap(c => (Array.isArray(c.classes) ? c.classes : []));
    return objects.filter(o => !knownClasses.includes(o.class)).length;
  }
  if (!Array.isArray(cat.classes)) return 0;
  return objects.filter(o => cat.classes!.includes(o.class)).length;
};
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ZonePicker } from "@/components/ZonePicker";
import { localFileSystem } from "@/lib/localFileSystem";

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
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4">
      <div className="bg-black/40 backdrop-blur-2xl border-2 border-white/10 rounded-[3rem] p-3 flex items-center justify-between gap-1 shadow-2xl overflow-hidden">
        {/* Recording Status */}
        <div className="flex flex-col items-center gap-1 w-14">
          <motion.div
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-3 w-3 rounded-full bg-destructive shadow-[0_0_10px_red]"
          />
          <span className="text-[7px] font-black text-destructive uppercase tracking-widest">REC</span>
        </div>

        {/* Primary Action (Large Circular Button) */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <Button
            onClick={handleSnapshot}
            className="h-[4.5rem] w-[4.5rem] rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all active:scale-90"
          >
            <Camera className="h-8 w-8" />
          </Button>
          <span className="text-[7px] font-black text-white/60 uppercase tracking-widest">Snap</span>
        </div>

        {/* Functional Buttons with Labels */}
        <div className="flex items-start gap-0.5">
          <button
            onClick={() => setIsZonePickerOpen(true)}
            className="flex flex-col items-center gap-1 p-1.5 rounded-2xl text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <div className="h-14 w-14 flex items-center justify-center rounded-full hover:bg-white/5">
              <Maximize className="h-6 w-6" />
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Zone</span>
          </button>

          <button
            onClick={toggleFlash}
            className={cn("flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all", flashOn ? "text-yellow-400" : "text-white/70 hover:bg-white/10")}
          >
            <div className={cn("h-14 w-14 flex items-center justify-center rounded-full", flashOn && "bg-yellow-400/10")}>
              {flashOn ? <Flashlight className="h-6 w-6" /> : <FlashlightOff className="h-6 w-6" />}
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest opacity-60">{flashOn ? "On" : "Flash"}</span>
          </button>

          <button
            onClick={toggleMute}
            className={cn("flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all", isMuted ? "text-white/40" : "text-white/70 hover:bg-white/10")}
          >
            <div className={cn("h-14 w-14 flex items-center justify-center rounded-full", isMuted && "bg-white/5")}>
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest opacity-60">{isMuted ? "Muted" : "Audio"}</span>
          </button>

          <button
            onClick={() => setIsSmartZoom(!isSmartZoom)}
            className={cn("flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all", isSmartZoom ? "text-primary" : "text-white/70 hover:bg-white/10")}
          >
            <div className={cn("h-14 w-14 flex items-center justify-center rounded-full", isSmartZoom && "bg-primary/10")}>
              <Zap className="h-6 w-6" />
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest opacity-60">AI Zoom</span>
          </button>

          <button
            onClick={toggleSiren}
            className={cn("flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all", sirenActive ? "text-destructive" : "text-white/70 hover:bg-white/10")}
          >
            <div className={cn("h-14 w-14 flex items-center justify-center rounded-full", sirenActive && "bg-destructive/10 animate-pulse")}>
              <AlertTriangle className="h-6 w-6" />
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest opacity-60">{sirenActive ? "Stop" : "Siren"}</span>
          </button>
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
  const isRecordingRef = useRef(false);
  const [activeCategories, setActiveCategories] = useState<Set<CategoryId>>(new Set(["all"]));

  const toggleCategory = (catId: CategoryId) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (catId === "all") {
        // "ALL" clears everything and selects all
        return new Set(["all"]);
      }
      // Deselect "all" when picking specific categories
      next.delete("all");
      if (next.has(catId)) {
        next.delete(catId);
        // If nothing selected, default back to "all"
        if (next.size === 0) return new Set(["all"]);
      } else {
        next.add(catId);
        // If all specific categories are selected, switch to "all"
        const specificCats = DETECTION_CATEGORIES.filter(c => c.id !== "all");
        if (specificCats.every(c => next.has(c.id))) return new Set(["all"]);
      }
      return next;
    });
  };

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

  const handleMotion = useCallback(async (_imageData: string, objectLabel?: string) => {
    if (!user || !resolvedDeviceId) return;
    // Prevent overlapping recordings
    if (isRecordingRef.current) return;

    const driveReady = localFileSystem.isReady();
    let videoUrl: string | null = null;

    // Record a 10-second video clip and save locally
    if (driveReady) {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      if (stream) {
        isRecordingRef.current = true;
        try {
          const videoBlob = await new Promise<Blob>((resolve, reject) => {
            const chunks: Blob[] = [];
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
            recorder.onerror = (e) => reject(e);
            recorder.start();
            setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 10000);
          });

          const filename = `hguard_${Date.now()}.webm`;
          const success = await localFileSystem.saveFile(filename, videoBlob);
          // Local files don't have public URLs, so we leave it empty for DB,
          // but we could set a local object URL for immediate in-app viewing if needed.
          if (success) console.log(`Saved local recording: ${filename}`);
        } catch (e) {
          console.error("Video recording/save failed:", e);
        } finally {
          isRecordingRef.current = false;
        }
      }
    }

    const alertData = {
      device_id: resolvedDeviceId,
      user_id: user.id,
      type: objectLabel ? `motion:${objectLabel}` : "motion",
      thumbnail_url: videoUrl
    };

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

  // Filter detections based on active categories (multi-select)
  const filteredObjects = filterObjects(detectedObjects, activeCategories);
  const isSpotlightActive = !activeCategories.has("all") && filteredObjects.length > 0;

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
        <MemoRadar detectedObjects={filteredObjects} videoWidth={videoRef.current?.videoWidth || 640} videoHeight={videoRef.current?.videoHeight || 480} />
      </div>

      {/* Spotlight Overlay — Dims everything when a filter is active */}
      <AnimatePresence>
        {isSpotlightActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[15] pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            {/* Cut-out holes for each detected object */}
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <mask id="spotlight-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {filteredObjects.map((obj, i) => (
                    <rect
                      key={`mask-${i}`}
                      x={`${(obj.bbox[0] / 320) * 100}%`}
                      y={`${(obj.bbox[1] / 240) * 100}%`}
                      width={`${(obj.bbox[2] / 320) * 100}%`}
                      height={`${(obj.bbox[3] / 240) * 100}%`}
                      rx="12"
                      fill="black"
                    />
                  ))}
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#spotlight-mask)" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Bounding Box Overlays — Photo Frame Style */}
      <AnimatePresence>
        {detectedObjects.map((obj, i) => {
          const isFiltered = filteredObjects.some(f => f === obj);
          const color = getCategoryColor(obj, activeCategories);

          // Subtle appearance for non-filtered objects
          const opacity = isFiltered ? 1 : 0.25;
          const scale = isFiltered ? 1 : 0.95;

          return (
            <motion.div
              key={`bbox-${i}-${obj.class}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity, scale }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute z-20 pointer-events-none"
              style={{
                left: `${(obj.bbox[0] / 320) * 100}%`,
                top: `${(obj.bbox[1] / 240) * 100}%`,
                width: `${(obj.bbox[2] / 320) * 100}%`,
                height: `${(obj.bbox[3] / 240) * 100}%`,
              }}
            >
              {/* Photo frame corners */}
              <div className="absolute inset-0">
                <div className="absolute top-0 left-0 w-4 h-4 border-t border-l rounded-tl-md" style={{ borderColor: color }} />
                <div className="absolute top-0 right-0 w-4 h-4 border-t border-r rounded-tr-md" style={{ borderColor: color }} />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l rounded-bl-md" style={{ borderColor: color }} />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r rounded-br-md" style={{ borderColor: color }} />
              </div>

              {/* Glow effect for filtered items */}
              {isFiltered && (
                <div className="absolute inset-0 rounded-lg opacity-20" style={{ boxShadow: `0 0 15px ${color}, inset 0 0 10px ${color}` }} />
              )}

              {/* Label tag — Smaller and Transparent */}
              {isFiltered && (
                <div
                  className="absolute -top-5 left-0 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-tighter text-white/90 backdrop-blur-md border border-white/5 shadow-2xl flex items-center gap-1"
                  style={{ backgroundColor: `${color}44` }}
                >
                  <Tag className="h-2 w-2 opacity-60" />
                  {obj.class}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>



      {/* Multi-Identify Pill Bar */}
      <div className="absolute top-[100px] left-0 right-0 z-30 flex justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-1.5 p-1.5 rounded-full bg-black/50 backdrop-blur-xl border-2 border-white/10 shadow-2xl overflow-x-auto no-scrollbar max-w-full"
        >
          {DETECTION_CATEGORIES.map(cat => {
            const isActive = activeCategories.has(cat.id);
            const count = countByCategory(detectedObjects, cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-200 whitespace-nowrap shrink-0",
                  isActive
                    ? "text-white shadow-lg"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
                style={isActive ? { backgroundColor: cat.color, boxShadow: `0 0 15px ${cat.color}40` } : {}}
              >
                {cat.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[8px] font-black",
                      isActive ? "bg-white/25 text-white" : "bg-white/10 text-white/50"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>
      </div>

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
