import React, { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  getDocs,
  deleteDoc,
  limit,
  serverTimestamp,
  deleteField,
  increment
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useCamera } from "@/hooks/useCamera";
import { useWebRTC, purgeStaleSignals } from "@/hooks/useWebRTC";
import { useBattery } from "@/hooks/useBattery";
import { useNetwork } from "@/hooks/useNetwork";
import { Button } from "@/components/ui/button";
import {
  Moon, Sun, AlertTriangle, Mic, MicOff, Flashlight, FlashlightOff,
  Camera, ArrowLeft, Users, Zap, Battery as BatteryIcon, WifiOff, Wifi,
  RefreshCcw, Lock as Padlock, Maximize, ChevronRight, RotateCw, Tag,
  Settings, Terminal, Clock, ShieldAlert, RefreshCw
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ZonePicker } from "@/components/ZonePicker";
import { googleDrive } from "@/lib/googleDrive";
import { generateImageSummary } from "@/lib/gemini";
import { aiOrchestrator, AIResponse } from "@/lib/ai/aiOrchestrator";
import { AIOverlays } from "@/components/AIOverlays";

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
  isOnline,
  batteryLevel,
  isCharging,
  isPowerSaveMode,
  togglePowerSave,
  deviceName,
  handleRename
}: any) => {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4 flex flex-col items-center gap-4">
      <div className="bg-black/20 backdrop-blur-2xl border border-white/5 rounded-full p-2 flex items-center justify-between gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full">
        <div className="flex items-center gap-2 pl-4">
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
          />
          <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live</span>
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={handleRename}
            variant="ghost"
            className="px-4 py-1 h-auto text-[10px] font-black text-white/40 hover:text-white uppercase tracking-widest bg-white/5 rounded-full border border-white/10"
          >
            {deviceName || "Unnamed Camera"}
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={togglePowerSave}
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full transition-all border border-transparent",
              isPowerSaveMode ? "bg-primary text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
             <Moon className="h-5 w-5" />
          </Button>

          <Button
            onClick={toggleFlash}
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full transition-all border border-transparent",
              flashOn ? "bg-primary text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
             {flashOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
          </Button>

          <Button
            onClick={handleSnapshot}
            className="h-12 w-12 rounded-full bg-white text-black hover:bg-white/90 shadow-2xl transition-all active:scale-90 p-0"
          >
            <Camera className="h-6 w-6" />
          </Button>

          <Button
            onClick={toggleSiren}
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full transition-all border border-transparent",
              sirenActive ? "bg-destructive text-white animate-pulse" : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
             <AlertTriangle className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 pr-4">
          <BatteryIcon className={cn("h-4 w-4", isCharging ? "text-green-400" : "text-white/60")} />
          <span className="text-[10px] font-black text-white/80">{batteryLevel}%</span>
        </div>
      </div>
    </div>
  );
});

const CameraMode = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { user, profileData } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [resolvedDeviceId, setResolvedDeviceId] = useState<string | null>(deviceId || null);
  const resolvedDeviceIdRef = useRef(resolvedDeviceId);
  const userRef = useRef(user);
  const isOnlineRef = useRef(true);
  const showNarrativeRef = useRef(false);
  const referenceImageRef = useRef<string | null>(null);
  const isPowerSaveModeRef = useRef(false);
  const profileDataRef = useRef(profileData);

  const [nightVision, setNightVision] = useState(false);
  const [autoNightVision, setAutoNightVision] = useState(true);
  const [sirenActive, setSirenActive] = useState(false);
  const sirenRef = useRef<OscillatorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const battery = useBattery();
  const { isOnline } = useNetwork();

  const [analysis, setAnalysis] = useState<AIResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [referenceImage, setReferenceImage] = useState<string | null>(localStorage.getItem("hguard_reference_image"));
  const [cameraStarted, setCameraStarted] = useState(false);
  const [watchdogError, setWatchdogError] = useState<string | null>(null);
  const [pendingAlerts, setPendingAlerts] = useState<PendingAlert[]>(() => {
    const saved = localStorage.getItem("pending_cam_alerts");
    return saved ? JSON.parse(saved) : [];
  });
  const [isZonePickerOpen, setIsZonePickerOpen] = useState(false);
  const [ignoreZones, setIgnoreZones] = useState<any[]>([]);
  const [monitoringSeconds, setMonitoringSeconds] = useState(0);
  const [isPowerSaveMode, setIsPowerSaveMode] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const activeRecorderRef = useRef<{ extend: () => void } | null>(null);
  const [ambientBrightness, setAmbientBrightness] = useState(100);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(localStorage.getItem("hguard_preferred_camera") || "");
  const [isBridgeMode, setIsBridgeMode] = useState(false);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    resolvedDeviceIdRef.current = resolvedDeviceId;
    userRef.current = user;
    isOnlineRef.current = isOnline;
    showNarrativeRef.current = showNarrative;
    referenceImageRef.current = referenceImage;
    isPowerSaveModeRef.current = isPowerSaveMode;
    profileDataRef.current = profileData;
  }, [resolvedDeviceId, user, isOnline, showNarrative, referenceImage, isPowerSaveMode, profileData]);

  // Sync devices for naming
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "devices"), where("user_id", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDevices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // Monitoring Timer
  useEffect(() => {
    const timer = setInterval(() => setMonitoringSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        if (!selectedCameraId && videoDevices.length > 0) {
          const env = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          const def = env ? env.deviceId : videoDevices[0].deviceId;
          setSelectedCameraId(def);
        }
      } catch (e) {
        console.error("Failed to list cameras", e);
      }
    };
    getCameras();
    navigator.mediaDevices.addEventListener('devicechange', getCameras);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getCameras);
  }, [selectedCameraId]);

  const handleCameraChange = (id: string) => {
    setSelectedCameraId(id);
    localStorage.setItem("hguard_preferred_camera", id);
    restartCamera();
  };

  const formatTime = (secondsLabel: number) => {
    const h = Math.floor(secondsLabel / 3600).toString().padStart(2, '0');
    const m = Math.floor((secondsLabel % 3600) / 60).toString().padStart(2, '0');
    const s = (secondsLabel % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

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

  const getDetailedDeviceName = () => {
    const ua = navigator.userAgent;
    let model = "Unknown Device";
    if (/Android/i.test(ua)) {
      const match = ua.match(/Android\s+[\d\.]+;\s+([^;]+)\s+Build/i) || ua.match(/\(([^;]+);\s+Android/i);
      model = match ? match[1].trim() : "Android Phone";
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      model = /iPad/.test(ua) ? "iPad" : "iPhone";
    } else if (/Macintosh/i.test(ua)) {
      model = "MacBook / iMac";
    } else if (/Windows/i.test(ua)) {
      model = "Windows PC";
    }
    const id = localStorage.getItem("hguard_device_persistent_id") || Math.random().toString(36).substring(2, 12);
    if (!localStorage.getItem("hguard_device_persistent_id")) localStorage.setItem("hguard_device_persistent_id", id);
    return { model, persistentId: id };
  };

  useEffect(() => {
    if (deviceId || !user) return;
    const resolve = async () => {
      const emergencyTimeout = setTimeout(() => {
        if (!resolvedDeviceId) {
          const tempId = `temp-${Math.random().toString(36).substring(2, 10)}`;
          setResolvedDeviceId(tempId);
        }
      }, 5000);
      const resolveTask = async () => {
        const { model, persistentId } = getDetailedDeviceName();
        const deviceName = `${model} (${persistentId.slice(0, 4)})`;
        const q = query(collection(db, "devices"), where("user_id", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const existingDoc = querySnapshot.docs.find(d => {
          const data = d.data();
          return data.persistent_id === persistentId || data.name === deviceName;
        });
        let deviceIdLiteral: string | null = null;
        if (!existingDoc) {
          const docRef = await addDoc(collection(db, "devices"), {
            user_id: user.uid,
            persistent_id: persistentId,
            name: deviceName,
            type: "camera",
            status: "online",
            pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            version: '2.5.2'
          });
          deviceIdLiteral = docRef.id;
        } else {
          await updateDoc(doc(db, "devices", existingDoc.id), {
            name: deviceName,
            type: "camera",
            status: 'online',
            persistent_id: persistentId,
            updated_at: serverTimestamp(),
            version: '2.5.2'
          });
          deviceIdLiteral = existingDoc.id;
        }
        if (deviceIdLiteral) setResolvedDeviceId(deviceIdLiteral);
        clearTimeout(emergencyTimeout);
      };
      resolveTask();
    };
    resolve();
  }, [deviceId, user]);

  const triggerWebhook = useCallback(async (alertData: any) => {
    const url = profileDataRef.current?.webhook_url;
    if (!url || !url.startsWith("http")) return;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...alertData,
          timestamp: new Date().toISOString(),
          device_name: devices.find(d => d.id === resolvedDeviceIdRef.current)?.name || "Unknown Camera"
        })
      });
    } catch (e) { console.error("Webhook failed:", e); }
  }, [devices]);

  const wakeUp = useCallback(() => {
    if (isPowerSaveModeRef.current) {
      setIsPowerSaveMode(false);
      toast({ title: "Smart Wake Triggered", description: "Activity detected. Feed restored." });
    }
  }, []);

  const handleMotion = useCallback(async (_imageData: string) => {
    wakeUp();
    if (!userRef.current || !resolvedDeviceIdRef.current) return;
    updateDoc(doc(db, "devices", resolvedDeviceIdRef.current), { unread_alerts: increment(1) }).catch(() => {});
    if (isRecordingRef.current) return;
    const snapshot = _imageData;
    try {
      const providerToken = localStorage.getItem("google_drive_token");
      let videoUrl: string | null = null;
      if (providerToken) {
        const stream = videoRef.current?.srcObject as MediaStream | null;
        if (stream) {
          isRecordingRef.current = true;
          const videoBlob = await new Promise<Blob | null>((resolve) => {
            const chunks: Blob[] = [];
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => { resolve(new Blob(chunks, { type: 'video/webm' })); };
            recorder.start(1000);
            setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 15000);
          });
          if (videoBlob) {
            const filename = `hguard_${Date.now()}.webm`;
            const fileId = await googleDrive.saveFile(filename, videoBlob, providerToken);
            if (fileId) {
              const limitGB = profileData?.archive_limit_gb || 10;
              googleDrive.enforceQuota(providerToken, limitGB * 1024 * 1024 * 1024).catch(() => {});
              updateDoc(doc(db, "devices", resolvedDeviceIdRef.current), { total_clips: increment(1) }).catch(() => {});
              videoUrl = filename;
            } else {
              toast({
                title: "Storage Error",
                description: "Google Drive upload failed. Please re-sign in to refresh storage access.",
                variant: "destructive"
              });
            }
          }
          isRecordingRef.current = false;
        }
      }
      const alertData = {
        device_id: resolvedDeviceIdRef.current,
        user_id: userRef.current.uid,
        type: "motion",
        thumbnail_url: videoUrl,
        viewed: false,
        created_at: serverTimestamp()
      };
      addDoc(collection(db, "alerts"), alertData).catch(() => {});
      triggerWebhook(alertData);
    } catch (e) { console.error("Motion error:", e); }
  }, [triggerWebhook, wakeUp]);

  const handleSound = useCallback(async (soundClass: string) => {
    wakeUp();
    if (!userRef.current || !resolvedDeviceIdRef.current) return;
    updateDoc(doc(db, "devices", resolvedDeviceIdRef.current), { unread_alerts: increment(1) }).catch(() => {});
    const alertData = { device_id: resolvedDeviceIdRef.current, user_id: userRef.current.uid, type: `sound:${soundClass}`, viewed: false, created_at: serverTimestamp() };
    addDoc(collection(db, "alerts"), alertData).catch(() => {});
    triggerWebhook(alertData);
  }, [triggerWebhook, wakeUp]);

  const handleFall = useCallback(async (snapshot: string) => {
    wakeUp();
    if (!userRef.current || !resolvedDeviceIdRef.current) return;
    toast({ title: "FALL DETECTED", variant: "destructive" });
    if (!sirenActive) toggleSiren();
    const alertData = { device_id: resolvedDeviceIdRef.current, user_id: userRef.current.uid, type: "fall_detected", viewed: false, created_at: serverTimestamp() };
    addDoc(collection(db, "alerts"), alertData).catch(() => {});
    triggerWebhook(alertData);
  }, [sirenActive, toggleSiren, wakeUp]);

  const { videoRef, canvasRef, isActive, isMuted, flashOn, brightness, zoomLevel, zoomCenter, detectionZone, setDetectionZone, startCamera, stopCamera, restartCamera, toggleMute, toggleFlash, takeSnapshot, stream, error: cameraError } =
    useCamera({ onMotionDetected: handleMotion, onSoundDetected: handleSound, onFallDetected: handleFall, ignoreZones, deviceId: selectedCameraId, isScreenCapture: isBridgeMode });

  const handleRemoteCommand = useCallback((msg: any) => {
    wakeUp();
    if (msg.type === 'COMMAND') {
      if (msg.action === 'TOGGLE_FLASH') toggleFlash();
      if (msg.action === 'TOGGLE_SIREN') toggleSiren();
      if (msg.action === 'TOGGLE_NIGHT_VISION') { setAutoNightVision(false); setNightVision(prev => !prev); }
      if (msg.action === 'TAKE_SNAPSHOT') takeSnapshot();
      if (msg.action === 'TOGGLE_AI') setShowNarrative(prev => !prev);
    }
  }, [toggleFlash, toggleSiren, takeSnapshot, wakeUp]);

  const webRTCDeviceId = resolvedDeviceId || "";

  const { isConnected: viewerConnected, sendData, isReceivingAudio } = useWebRTC({
    deviceId: webRTCDeviceId,
    role: "camera",
    localStream: webRTCDeviceId ? stream : null,
    onDataMessage: handleRemoteCommand
  });

  // Purge stale signaling docs when camera device ID resolves
  useEffect(() => {
    if (resolvedDeviceId && resolvedDeviceId !== "awaiting-resolution") {
      purgeStaleSignals(resolvedDeviceId);
    }
  }, [resolvedDeviceId]);

  useEffect(() => {
    if (!resolvedDeviceId) return;
    const unsubscribe = onSnapshot(doc(db, "devices", resolvedDeviceId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIgnoreZones(data.settings?.ignore_zones || []);
        setDeviceName(data.name || "");
      }
    });
    return () => unsubscribe();
  }, [resolvedDeviceId]);

  useEffect(() => {
    if (!resolvedDeviceId) return;
    const heartbeat = setInterval(async () => {
      updateDoc(doc(db, "devices", resolvedDeviceId), { status: 'online', last_seen: serverTimestamp(), battery_level: battery.level, is_charging: battery.isCharging }).catch(() => {});
    }, 15000);
    return () => clearInterval(heartbeat);
  }, [resolvedDeviceId, battery]);

  useEffect(() => {
    if (!cameraStarted) { startCamera(); setCameraStarted(true); }
    return () => stopCamera();
  }, [startCamera, stopCamera, cameraStarted]);

  useEffect(() => {
    if (viewerConnected) {
      sendData({ type: 'TELEMETRY', data: { zoomLevel, zoomCenter, isFlashOn: flashOn, isSirenOn: sirenActive, isNightVision: nightVision, ambientBrightness: ambientBrightness, isAiActive: showNarrative } });
    }
  }, [zoomLevel, zoomCenter, viewerConnected, sendData, flashOn, sirenActive, nightVision, ambientBrightness, showNarrative]);

  // AI Analysis Loop
  const aiErrorCountRef = useRef(0);
  useEffect(() => {
    let mounted = true;
    let timeout: any;

    const analyze = async () => {
      if (!showNarrative || !isActive || isPowerSaveMode) return;
      
      try {
        setIsAnalyzing(true);
        const snapshot = takeSnapshot();
        if (snapshot) {
          const result = await aiOrchestrator.identify(snapshot, referenceImage || undefined);
          if (mounted) {
            setAnalysis(result);
            // Treat rate limit returns as errors for backoff purposes
            if (result.tags?.includes("RATE_LIMIT")) {
              aiErrorCountRef.current += 1;
            } else {
              aiErrorCountRef.current = 0; // Reset error count on actual success
            }
            if (viewerConnected) {
              sendData({ type: 'AI_ANALYSIS', data: result });
            }
          }
        }
      } catch (e) {
        console.error("AI Analysis failed", e);
        if (mounted) aiErrorCountRef.current += 1;
      } finally {
        if (mounted) {
          setIsAnalyzing(false);
          // Calculate interval: Base 10s + exponential backoff if errors occur
          const interval = Math.min(60000, 10000 + (aiErrorCountRef.current * 10000));
          timeout = setTimeout(analyze, interval);
        }
      }
    };

    if (showNarrative && isActive && !isPowerSaveMode) {
      analyze();
    } else {
      setAnalysis(null);
      setIsAnalyzing(false);
      aiErrorCountRef.current = 0;
    }

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [showNarrative, isActive, isPowerSaveMode, takeSnapshot, viewerConnected, referenceImage, sendData]);

  useEffect(() => {
    (window as any).hguard_night_vision = nightVision;
  }, [nightVision]);

  const handleRename = () => {
    const newName = prompt("Enter new camera name:", deviceName);
    if (newName && resolvedDeviceId) updateDoc(doc(db, "devices", resolvedDeviceId), { name: newName });
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none">
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-all duration-[2000ms] z-0 opacity-100",
          nightVision ? "brightness-[1.8] contrast-[1.4] sepia-[1] hue-rotate-[70deg] saturate-[2.5] invert-[0.05]" : ""
        )}
        style={{ transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`, transform: `scale(${zoomLevel})` }}
        autoPlay playsInline muted
      />
      <canvas ref={canvasRef} className="hidden" />
      {/* Broadcast Status */}
      {isReceivingAudio && (
        <div className="absolute top-6 right-6 z-50 flex items-center gap-3 px-4 py-2 bg-red-600/90 backdrop-blur-md rounded-2xl animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.4)] border border-red-500/50">
          <Mic className="h-4 w-4 text-white" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Broadcast Live</span>
        </div>
      )}

      {/* Header HUD */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
        <div className="px-4 py-2 rounded-2xl bg-black/40 backdrop-blur-3xl border border-white/10 flex items-center gap-3 shadow-2xl">
          <div className={cn(
            "h-2 w-2 rounded-full animate-pulse",
            !resolvedDeviceId ? "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" : 
            viewerConnected ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" :
            "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
          )} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/80">
            {!resolvedDeviceId ? "Resolving Node..." : viewerConnected ? "Active Link" : "Mesh Ready"}
          </span>
        </div>
      </div>

      {/* Source Selection Controls */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 w-full max-w-xs">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex gap-1 shadow-2xl">
          <button
            onClick={() => { setIsBridgeMode(false); restartCamera(); }}
            className={cn(
              "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
              !isBridgeMode ? "bg-primary text-black" : "text-white/40 hover:text-white/60"
            )}
          >
            LENS
          </button>
          <button
            onClick={() => { setIsBridgeMode(true); restartCamera(); }}
            className={cn(
              "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
              isBridgeMode ? "bg-blue-500 text-white" : "text-white/40 hover:text-white/60"
            )}
          >
            BRIDGE
          </button>
        </div>

        {isBridgeMode && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-center"
          >
            <p className="text-[8px] font-bold text-blue-300 uppercase tracking-widest leading-tight">
              Select your Ring/Zoom tab<br/>to start the bridge
            </p>
          </motion.div>
        )}

        {!isBridgeMode && availableCameras.length > 1 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {availableCameras.map((cam, idx) => (
              <button
                key={cam.deviceId}
                onClick={() => handleCameraChange(cam.deviceId)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border",
                  selectedCameraId === cam.deviceId 
                    ? "bg-white border-white text-black" 
                    : "bg-black/40 border-white/10 text-white/40 hover:bg-white/10"
                )}
              >
                {cam.label || `Cam ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <ActionBar
        toggleSiren={toggleSiren} sirenActive={sirenActive} handleSnapshot={() => { const s = takeSnapshot(); if (s) toast({ title: "Snapshot Saved" }); }}
        isMuted={isMuted} toggleMute={toggleMute} flashOn={flashOn} toggleFlash={toggleFlash}
        batteryLevel={battery.level} isCharging={battery.isCharging} isPowerSaveMode={isPowerSaveMode}
        togglePowerSave={() => setIsPowerSaveMode(!isPowerSaveMode)} deviceName={deviceName} handleRename={handleRename}
      />

      <div className="absolute top-6 left-6 z-50">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-3xl border border-white/20 text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default CameraMode;
