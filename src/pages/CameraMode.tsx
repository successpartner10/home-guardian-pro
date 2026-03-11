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
  Camera, ArrowLeft, Users, Zap, Battery as BatteryIcon, WifiOff, Wifi,
  RefreshCcw, Lock as Padlock, Maximize, ChevronRight, RotateCw, Tag
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { DetectedObject } from "@tensorflow-models/coco-ssd";

import {
  DETECTION_CATEGORIES,
  getCategoryColor,
  filterObjects,
  countByCategory,
  RadarOverlay as SharedRadarOverlay,
  BoundingBoxesOverlay,
  type CategoryId
} from "@/components/AIOverlays";
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



const ActionBar = React.memo(({
  toggleSiren,
  sirenActive,
  handleSnapshot,
  isMuted,
  toggleMute,
  flashOn,
  toggleFlash,
  setIsZonePickerOpen,
  monitoringTime,
  isOnline,
  batteryLevel,
  isCharging,
}: any) => {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 flex flex-col items-center gap-4">
      <div className="bg-black/40 backdrop-blur-2xl border-2 border-white/10 rounded-[3rem] p-3 flex items-center justify-between gap-2 shadow-2xl overflow-hidden w-full">
        {/* Left Side: Recording Status */}
        <div className="flex flex-col items-center gap-1 w-14 shrink-0">
          <motion.div
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-3 w-3 rounded-full bg-destructive shadow-[0_0_10px_red]"
          />
          <span className="text-[7px] font-black text-destructive uppercase tracking-widest">REC</span>
        </div>

        {/* Action Buttons Group */}
        <div className="flex flex-1 items-center justify-center gap-4 px-2">
          {/* Snap */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <Button
              onClick={handleSnapshot}
              className="h-14 w-14 rounded-full bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all active:scale-90"
            >
              <Camera className="h-6 w-6" />
            </Button>
            <span className="text-[7px] font-black text-white/60 uppercase tracking-widest">Snap</span>
          </div>

          <div className="h-10 w-[1px] bg-white/10 mx-2" />

          <div className="flex flex-col items-start gap-1 justify-center min-w-[100px]">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] animate-pulse">Monitoring</span>
            <span className="text-[8px] font-medium text-white/40 uppercase tracking-widest">Remote Control Active</span>
          </div>
        </div>

        {/* Right Side: Environment / Stats Block */}
        <div className="flex flex-col gap-2 shrink-0 border-l border-white/5 pl-3 w-16">
          <div className="flex items-center gap-1.5">
            {isOnline ? <Wifi className="h-3.5 w-3.5 text-primary" /> : <WifiOff className="h-3.5 w-3.5 text-destructive animate-pulse" />}
            <span className="text-[7px] font-black text-white/50 uppercase tracking-widest">NET</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BatteryIcon className={cn("h-3.5 w-3.5", isCharging ? "text-green-400" : "text-white/80")} />
            <span className="text-[7px] font-black text-white/50 uppercase tracking-widest">{batteryLevel}%</span>
          </div>
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

  const handleRemoteCommand = useCallback((msg: any) => {
    if (msg.type === 'COMMAND') {
      if (msg.action === 'TOGGLE_FLASH') toggleFlash();
      if (msg.action === 'TOGGLE_SIREN') toggleSiren();
    }
  }, [toggleFlash, toggleSiren]);

  const { isConnected: viewerConnected, sendData } = useWebRTC({
    deviceId: resolvedDeviceId || "",
    role: "camera",
    localStream: videoRef.current?.srcObject as MediaStream,
    onDataMessage: handleRemoteCommand
  });

  // Stream AI Telemetry to Viewers
  useEffect(() => {
    if (viewerConnected) {
      sendData({
        type: 'TELEMETRY',
        data: {
          detectedObjects,
          zoomLevel,
          zoomCenter,
          videoWidth: videoRef.current?.videoWidth || 640,
          videoHeight: videoRef.current?.videoHeight || 480,
          isFlashOn: flashOn,
          isSirenOn: sirenActive
        }
      });
    }
  }, [detectedObjects, zoomLevel, zoomCenter, viewerConnected, sendData, flashOn, sirenActive]);

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
        <div className="flex gap-2 p-3 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
          <RotateCw className="h-5 w-5 text-white/40" />
          <Users className={cn("h-5 w-5", viewerConnected ? "text-primary animate-pulse" : "text-white/20")} />
        </div>
      </div>

      {/* Tactical Radar Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-150 opacity-20">
        <SharedRadarOverlay
          detectedObjects={filteredObjects as any}
          videoWidth={videoRef.current?.videoWidth || 640}
          videoHeight={videoRef.current?.videoHeight || 480}
        />
      </div>

      <BoundingBoxesOverlay
        detectedObjects={detectedObjects as any}
        filteredObjects={filteredObjects as any}
        activeCategories={activeCategories}
      />



      {/* Floating Bottom Dock */}
      <ActionBar
        toggleSiren={toggleSiren}
        sirenActive={sirenActive}
        handleSnapshot={handleSnapshot}
        isMuted={isMuted}
        toggleMute={toggleMute}
        flashOn={flashOn}
        toggleFlash={toggleFlash}
        setIsZonePickerOpen={setIsZonePickerOpen}
        monitoringTime={formatTime(monitoringSeconds)}
        isOnline={isOnline}
        batteryLevel={battery.level}
        isCharging={battery.isCharging}
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
    </div >
  );
};

export default CameraMode;
