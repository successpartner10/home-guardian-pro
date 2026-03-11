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
  RefreshCcw, Lock as Padlock, Maximize, ChevronRight, RotateCw, Tag,
  Settings, Terminal
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
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4 flex flex-col items-center gap-2">
      <div className="bg-black/5 backdrop-blur-xl border border-white/10 rounded-full p-1.5 flex items-center justify-between gap-4 shadow-2xl w-full">
        {/* Left Side: Recording Status */}
        <div className="flex items-center gap-2 pl-4">
          <motion.div
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-2.5 w-2.5 rounded-full bg-destructive shadow-[0_0_12px_red]"
          />
          <span className="text-[14px] font-[900] text-white uppercase tracking-tighter drop-shadow-md">REC</span>
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center gap-6">
          <Button
            onClick={handleSnapshot}
            className="h-10 w-10 rounded-full bg-white text-black hover:bg-white/90 shadow-2xl transition-all active:scale-90 p-0"
          >
            <Camera className="h-5 w-5" />
          </Button>
          <div className="flex flex-col items-center">
            <span className="text-[16px] font-[900] text-white tracking-widest font-mono drop-shadow-lg">{monitoringTime}</span>
          </div>
        </div>

        {/* Right Side: Environment / Stats Block */}
        <div className="flex items-center gap-3 pr-5">
          <div className="flex items-center gap-1.5">
            <BatteryIcon className={cn("h-5 w-5", isCharging ? "text-green-400" : "text-white")} />
            <span className="text-[14px] font-[900] text-white drop-shadow-md">{batteryLevel}%</span>
          </div>
        </div>
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
      const getOrCreatePersistentId = () => {
        let id = localStorage.getItem("hguard_device_persistent_id");
        if (!id) {
          id = Math.random().toString(36).substring(2, 12);
          localStorage.setItem("hguard_device_persistent_id", id);
        }
        return id;
      };

      const persistentId = getOrCreatePersistentId();
      const deviceName = `${navigator.platform} Camera (${persistentId.slice(0, 4)})`;
      console.log(`[CameraMode] Resolving device: ${deviceName}`);

      // Check if this specific device is already registered
      let { data, error } = await supabase
        .from("devices")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", deviceName)
        .eq("type", "camera")
        .maybeSingle();

      if (error) {
        console.error("[CameraMode] Resolve error:", error);
      }

      if (!data) {
        console.log("[CameraMode] Registering new camera device...");
        const { data: newData, error: insertError } = await supabase.from("devices").insert({
          user_id: user.id,
          name: deviceName,
          type: "camera",
          status: "online",
          pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        }).select().single();

        if (insertError) {
          console.error("[CameraMode] Registration failed:", insertError);
        }
        data = newData;
      } else {
        console.log("[CameraMode] Found existing camera. Ensuring online status...");
        await supabase.from("devices").update({ status: 'online', last_seen: new Date().toISOString() }).eq('id', data.id);
      }

      if (data) {
        console.log("[CameraMode] Device resolved successfully:", data.id);
        setResolvedDeviceId(data.id);
      }
    };
    resolve();
  }, [deviceId, user]);

  // Status Heartbeat: Keep device 'online' while in Camera Mode
  useEffect(() => {
    if (!resolvedDeviceId) return;

    console.log("[CameraMode] Starting heartbeat for:", resolvedDeviceId);
    const heartbeat = setInterval(async () => {
      const { error } = await supabase
        .from("devices")
        .update({ status: 'online', last_seen: new Date().toISOString() })
        .eq('id', resolvedDeviceId);

      if (error) console.error("[CameraMode] Heartbeat failed:", error);
      else console.log("[CameraMode] Heartbeat sent.");
    }, 15000); // More frequent heartbeat for mobile visibility

    return () => clearInterval(heartbeat);
  }, [resolvedDeviceId]);

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
      setPendingAlerts(prev => {
        const newPending = [...prev, { ...alertData, created_at: new Date().toISOString() }];
        localStorage.setItem("pending_cam_alerts", JSON.stringify(newPending));
        return newPending;
      });
    } else {
      await supabase.from("alerts").insert(alertData);
    }
  }, [user, resolvedDeviceId, isOnline]);

  const handleSound = useCallback(async () => {
    if (!user || !resolvedDeviceId) return;
    const alertData = { device_id: resolvedDeviceId, user_id: user.id, type: "sound" };
    if (!isOnline) {
      setPendingAlerts(prev => {
        const newPending = [...prev, { ...alertData, created_at: new Date().toISOString() }];
        localStorage.setItem("pending_cam_alerts", JSON.stringify(newPending));
        return newPending;
      });
    } else {
      await supabase.from("alerts").insert(alertData);
    }
  }, [user, resolvedDeviceId, isOnline]);

  const { videoRef, canvasRef, isActive, isMuted, flashOn, brightness, detectedObjects, zoomLevel, zoomCenter, detectionZone, setDetectionZone, startCamera, stopCamera, restartCamera, toggleMute, toggleFlash, takeSnapshot, stream, error: cameraError } =
    useCamera({ onMotionDetected: handleMotion, onSoundDetected: handleSound, aiFrequency, autoZoom: isSmartZoom });

  // Filter detections based on active categories (multi-select)
  const filteredObjects = filterObjects(detectedObjects, activeCategories);
  const isSpotlightActive = !activeCategories.has("all") && filteredObjects.length > 0;

  useEffect(() => {
    if (cameraError) {
      toast({
        title: "Camera Error",
        description: cameraError,
        variant: "destructive"
      });
    }
  }, [cameraError]);

  useEffect(() => {
    if (autoNightVision) {
      if (brightness < 30 && !nightVision) setNightVision(true);
      if (brightness > 50 && nightVision) setNightVision(false);
    }
  }, [brightness, autoNightVision, nightVision]);

  useEffect(() => {
    console.log("[CameraMode] Component mounted, initiating startCamera");
    startCamera();
    return () => {
      console.log("[CameraMode] Component unmounted or restarting, calling stopCamera");
      stopCamera();
    };
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
    localStream: stream,
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
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 z-0 opactiy-100")}
        style={{ transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`, transform: `scale(${zoomLevel})` }}
        autoPlay
        playsInline
        muted
      />

      {/* Black Screen Recovery Button - Appears if camera is active but feed is invisible */}
      <AnimatePresence>
        {isActive && brightness < 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-6 p-10 bg-zinc-950 border border-white/20 rounded-[3rem] shadow-2xl text-center max-w-sm">
              <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse border-2 border-primary/50">
                <RefreshCcw className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Camera Unresponsive</h2>
                <p className="text-muted-foreground font-medium">Your browser blocked the video hardware. Tap below to force start.</p>
              </div>
              <Button
                onClick={() => {
                  videoRef.current?.play();
                  restartCamera();
                }}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-lg shadow-[0_0_30px_rgba(var(--primary),0.4)]"
              >
                Force Start Camera
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
            <button
              onClick={() => navigate("/dashboard")}
              className="group flex flex-col items-start cursor-pointer active:scale-95 transition-transform"
            >
              <h1 className="text-xl font-black text-white uppercase tracking-tighter drop-shadow-lg group-hover:text-primary transition-colors">hGuard</h1>
              <div className="h-0.5 w-0 group-hover:w-full bg-primary transition-all duration-300" />
            </button>
          </div>
        </div>

        {/* Center HUD */}
        <div className="text-center space-y-1">
          <div className="text-xl font-black text-white tracking-wider leading-none drop-shadow-2xl">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1 px-4 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">{isMuted ? 'SILENT' : 'ACTIVE'}</span>
            <ChevronRight className="h-3 w-3 text-white/20" />
          </div>
        </div>

        {/* Right HUD */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 p-2 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md">
            <Button
              variant="ghost"
              size="icon"
              onClick={restartCamera}
              className="h-10 w-10 rounded-xl text-white/40 hover:text-white hover:bg-white/10"
              title="Restart Camera"
            >
              <RefreshCcw className="h-5 w-5" />
            </Button>
            <div className="w-px h-6 bg-white/10 my-2" />
            <Users className={cn("h-5 w-5 mt-2", viewerConnected ? "text-primary animate-pulse" : "text-white/20")} />
          </div>

          {/* Diagnostic Stats (Hidden by default, or just subtle) */}
          <div className="text-[8px] font-mono text-white/20 text-right pr-2">
            {isActive ? "CAM:RDY" : "CAM:OFF"} | {brightness}% BR
          </div>
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
