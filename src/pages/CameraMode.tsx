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
import { useWebRTC } from "@/hooks/useWebRTC";
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

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ZonePicker } from "@/components/ZonePicker";
import { localFileSystem } from "@/lib/localFileSystem";
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
  setIsZonePickerOpen,
  monitoringTime,
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
        {/* Left Side: Recording Status */}
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

        {/* Action Buttons Group */}
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

        {/* Right Side: Battery Block */}
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

  const [isSmartZoom, setIsSmartZoom] = useState(true);
  const [isCoolingMode, setIsCoolingMode] = useState(false);
  const [analysis, setAnalysis] = useState<AIResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  // Reference image for AI identity matching
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [showRefSavedToast, setShowRefSavedToast] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [watchdogError, setWatchdogError] = useState<string | null>(null);
  const [pendingAlerts, setPendingAlerts] = useState<PendingAlert[]>(() => {
    const saved = localStorage.getItem("pending_cam_alerts");
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isZonePickerOpen, setIsZonePickerOpen] = useState(false);
  const [ignoreZones, setIgnoreZones] = useState<any[]>([]);
  const [monitoringSeconds, setMonitoringSeconds] = useState(0);
  const [isPowerSaveMode, setIsPowerSaveMode] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const isRecordingRef = useRef(false);
  // Shared ref so audio events can extend an active video recording
  const activeRecorderRef = useRef<{ extend: () => void } | null>(null);

  const handleRename = () => {
    const newName = prompt("Enter new camera name:", deviceName);
    if (newName && resolvedDeviceId) {
      updateDoc(doc(db, "devices", resolvedDeviceId), { name: newName });
    }
  };

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
      // Emergency Timeout: If Firestore resolution hangs longer than 5s, 
      // generate a temporary local ID so the camera can start.
      const emergencyTimeout = setTimeout(() => {
        if (!resolvedDeviceId) {
          const tempId = `temp-${Math.random().toString(36).substring(2, 10)}`;
          console.warn("[CameraMode] Resolution timeout - using temporary ID:", tempId);
          setResolvedDeviceId(tempId);
        }
      }, 5000);

      const resolveTask = async () => {
      const { model, persistentId } = getDetailedDeviceName();
      const deviceName = `${model} (${persistentId.slice(0, 4)})`;
      console.log(`[CameraMode] Resolving device: ${deviceName}`);

      // Query for ANY device with this persistentId for this user
      const q = query(
        collection(db, "devices"),
        where("user_id", "==", user.uid)
      );

      const querySnapshot = await getDocs(q);
      
      // Client-side filtering for persistentId (or name fallback for legacy)
      const existingDoc = querySnapshot.docs.find(d => {
        const data = d.data();
        return data.persistent_id === persistentId || data.name === deviceName;
      });

      let deviceIdLiteral: string | null = null;

      if (!existingDoc) {
        console.log("[CameraMode] Registering new camera node...");
        const docRef = await addDoc(collection(db, "devices"), {
          user_id: user.uid,
          persistent_id: persistentId,
          name: deviceName,
          type: "camera",
          status: "online",
          pairing_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          version: '2.5.0'
        });
        deviceIdLiteral = docRef.id;
      } else {
        console.log("[CameraMode] Resuming existing device node:", existingDoc.id);
        await updateDoc(doc(db, "devices", existingDoc.id), {
          name: deviceName,
          type: "camera",
          status: 'online',
          persistent_id: persistentId,
          updated_at: serverTimestamp(),
          version: '2.5.0'
        });
        deviceIdLiteral = existingDoc.id;

        // NUCLEAR DEDUPLICATION: Kill any other docs sharing this persistentId for this user
        const duplicates = querySnapshot.docs.filter(d => 
          d.id !== existingDoc.id && 
          (d.data().persistent_id === persistentId || d.data().name === deviceName)
        );
        for (const dup of duplicates) {
           console.log("[CameraMode] Purging ghost duplicate:", dup.id);
           await deleteDoc(doc(db, "devices", dup.id)).catch(() => {});
        }
      }

      if (deviceIdLiteral) {
        setResolvedDeviceId(deviceIdLiteral);
      }
      clearTimeout(emergencyTimeout);
    };
    
    resolveTask();
  };
  resolve();
  }, [deviceId, user]);

  // Status Heartbeat: Keep device 'online' while in Camera Mode
  useEffect(() => {
    if (!resolvedDeviceId) return;

    console.log("[CameraMode] Starting heartbeat for:", resolvedDeviceId);
    const heartbeat = setInterval(async () => {
      try {
        await updateDoc(doc(db, "devices", resolvedDeviceId), {
          status: 'online',
          last_seen: serverTimestamp(),
          updated_at: serverTimestamp(),
          battery_level: battery.level,
          is_charging: battery.isCharging
        });
        console.log("[CameraMode] Heartbeat sent.");
      } catch (error) {
        console.error("[CameraMode] Heartbeat failed:", error);
      }
    }, 10000); // Aggressive 10s heartbeat

    return () => clearInterval(heartbeat);
  }, [resolvedDeviceId, battery]);


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
      console.log("[CameraMode] Webhook triggered successfully.");
    } catch (e) {
      console.error("[CameraMode] Webhook failed:", e);
    }
  }, [devices]);

  const wakeUp = useCallback(() => {
    if (isPowerSaveModeRef.current) {
      console.log("[CameraMode] Motion/Sound detected — Waking from Deep Sleep.");
      setIsPowerSaveMode(false);
      toast({
        title: "Smart Wake Triggered",
        description: "Activity detected. Feed restored.",
        duration: 3000
      });
    }
  }, []);

  const handleMotion = useCallback(async (_imageData: string) => {
    wakeUp();
    if (!userRef.current || !resolvedDeviceIdRef.current) return;
    
    // Increment unread alerts counter
    updateDoc(doc(db, "devices", resolvedDeviceIdRef.current), {
      unread_alerts: increment(1)
    }).catch(() => {});

    if (isRecordingRef.current) return;

    const snapshot = _imageData;
    try {
      const providerToken = localStorage.getItem("google_drive_token");
      let videoUrl: string | null = null;

      if (providerToken) {
        googleDrive.enforceQuota(providerToken).catch(() => {});

        const stream = videoRef.current?.srcObject as MediaStream | null;
        if (stream) {
          isRecordingRef.current = true;
          try {
            // Record up to 30s — long enough to capture the full event
            const CLIP_DURATION_MS = 30000;
            // At 5s, take a mid-clip snapshot and run AI to decide if worth keeping
            const AI_SAMPLE_DELAY_MS = 5000;

            const videoBlob = await new Promise<Blob | null>((resolve) => {
              const chunks: Blob[] = [];
              let discarded = false;
              // Max clip = 5 minutes; each confirmed event resets the 30s idle timer
              const MAX_CLIP_MS = 5 * 60 * 1000;
              const IDLE_STOP_MS = 30000;
              const recordingStarted = Date.now();

              const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
              recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
              recorder.onstop = () => {
                activeRecorderRef.current = null;
                resolve(discarded ? null : new Blob(chunks, { type: 'video/webm' }));
              };
              recorder.start(1000); // collect chunks every 1s

              // Idle stop timer — gets reset each time activity is confirmed
              let idleTimer = setTimeout(() => {
                if (recorder.state === 'recording') recorder.stop();
              }, IDLE_STOP_MS);

              // Expose extend() so audio events can also push the timer
              activeRecorderRef.current = {
                extend: () => {
                  if (recorder.state !== 'recording') return;
                  if (Date.now() - recordingStarted >= MAX_CLIP_MS) {
                    console.log('[CameraMode] Max clip length reached (5 min) — stopping.');
                    recorder.stop();
                    return;
                  }
                  clearTimeout(idleTimer);
                  idleTimer = setTimeout(() => {
                    if (recorder.state === 'recording') recorder.stop();
                  }, IDLE_STOP_MS);
                  console.log('[CameraMode] Recording extended by 30s due to continued activity.');
                }
              };

              // Absolute safety cap at 5 min
              const absTimer = setTimeout(() => {
                if (recorder.state === 'recording') recorder.stop();
              }, MAX_CLIP_MS);

              // Mid-clip AI gate at 5s: validate relevance
              setTimeout(async () => {
                if (recorder.state !== 'recording') return;
                const midSnapshot = takeSnapshot();
                if (midSnapshot && showNarrativeRef.current) {
                  try {
                    const aiResult = await aiOrchestrator.identify(midSnapshot, referenceImageRef.current || undefined);
                    const hasRelevant = (aiResult.detected_objects || []).some((o: any) =>
                      /person|people|human|animal|dog|cat|bird|vehicle|car|truck/i.test(o.label || '')
                    );
                    const isHighRisk = aiResult.risk_level === 'high' || aiResult.risk_level === 'medium';

                    if (!hasRelevant && !isHighRisk) {
                      console.log('[CameraMode] AI: nothing relevant — stopping early & discarding.');
                      clearTimeout(idleTimer);
                      clearTimeout(absTimer);
                      discarded = true;
                      if (recorder.state === 'recording') recorder.stop();
                    } else {
                      console.log('[CameraMode] AI confirmed relevant — extending clip.');
                      activeRecorderRef.current?.extend();
                    }
                  } catch (e) {
                    console.warn('[CameraMode] Mid-clip AI check failed, keeping clip.', e);
                  }
                }
              }, AI_SAMPLE_DELAY_MS);
            });

            if (videoBlob) {
              const filename = `hguard_${Date.now()}.webm`;
              await googleDrive.ensureFolder("camera files", providerToken);
              const fileId = await googleDrive.saveFile(filename, videoBlob, providerToken);
              if (fileId) {
                console.log("[CameraMode] Video clip saved to Google Drive:", fileId);
                // Increment total clips counter
                if (resolvedDeviceIdRef.current) {
                  updateDoc(doc(db, "devices", resolvedDeviceIdRef.current), {
                    total_clips: increment(1)
                  }).catch(() => {});
                }
                toast({ title: "Recording Saved", description: "Video clip uploaded to Google Drive." });
                videoUrl = filename;
              }
            }
          } catch (e) {
            console.error("Video record error:", e);
          } finally {
            isRecordingRef.current = false;
          }
        }
      }

      let summary: string | null = null;
      if (showNarrativeRef.current) {
        setIsAnalyzing(true);
        try {
          if (snapshot) summary = await generateImageSummary(snapshot);
        } catch (e) {
          console.warn("AI summary skipped:", e);
        } finally {
          setIsAnalyzing(false);
        }
      }

      const alertData = {
        device_id: resolvedDeviceIdRef.current,
        user_id: userRef.current.uid,
        type: "motion",
        thumbnail_url: videoUrl,
        summary: analysis?.summary || null,
        tags: analysis?.tags || [],
        risk_level: analysis?.risk_level || "low",
        viewed: false,
        created_at: serverTimestamp()
      };

      if (!isOnlineRef.current) {
        setPendingAlerts(prev => {
          const newPending = [...prev, { ...alertData, created_at: new Date().toISOString() } as any];
          localStorage.setItem("pending_cam_alerts", JSON.stringify(newPending));
          return newPending;
        });
      } else {
        addDoc(collection(db, "alerts"), alertData).catch(() => {});
        triggerWebhook(alertData);
      }
    } catch (e) {
      console.error("[CameraMode] handleMotion error:", e);
    }
  }, [triggerWebhook, analysis, nightVision, takeSnapshot]);

  const handleSound = useCallback(async (soundClass: string) => {
    wakeUp();
    if (!userRef.current || !resolvedDeviceIdRef.current) return;

    // Increment unread alerts counter
    updateDoc(doc(db, "devices", resolvedDeviceIdRef.current), {
      unread_alerts: increment(1)
    }).catch(() => {});

    // If a video clip is already recording, extend it due to audio event
    if (activeRecorderRef.current) {
      console.log(`[CameraMode] Audio event (${soundClass}) — extending active recording.`);
      activeRecorderRef.current.extend();
    }

    const alertData = {
      device_id: resolvedDeviceIdRef.current,
      user_id: userRef.current.uid,
      type: `sound:${soundClass}`,
      viewed: false,
      created_at: serverTimestamp()
    };
    if (!isOnlineRef.current) {
      setPendingAlerts(prev => {
        const newPending = [...prev, { ...alertData, created_at: new Date().toISOString() } as any];
        localStorage.setItem("pending_cam_alerts", JSON.stringify(newPending));
        return newPending;
      });
    } else {
      addDoc(collection(db, "alerts"), alertData).catch(() => {});
      triggerWebhook(alertData);
    }
  }, [triggerWebhook]);

  const handleFall = useCallback(async (snapshot: string) => {
    wakeUp();
    if (!userRef.current || !resolvedDeviceIdRef.current) return;
    toast({ title: "FALL DETECTED", description: "Critical Health Alert Triggered!", variant: "destructive" });
    if (!sirenActive) toggleSiren();
    let summary: string | null = null;
    if (showNarrativeRef.current) {
       setIsAnalyzing(true);
       try { if (snapshot) summary = await generateImageSummary(snapshot); } catch (e) { } finally { setIsAnalyzing(false); }
    }

    const alertData = {
      device_id: resolvedDeviceIdRef.current,
      user_id: userRef.current.uid,
      type: "fall_detected",
      summary,
      viewed: false,
      created_at: serverTimestamp()
    };
    if (!isOnlineRef.current) {
      setPendingAlerts(prev => {
        const newPending = [...prev, { ...alertData, created_at: new Date().toISOString() } as any];
        localStorage.setItem("pending_cam_alerts", JSON.stringify(newPending));
        return newPending;
      });
    } else {
      addDoc(collection(db, "alerts"), alertData).catch(() => {});
      triggerWebhook(alertData);
    }
  }, [sirenActive, toggleSiren, toast, triggerWebhook]);

  const { videoRef, canvasRef, isActive, isMuted, flashOn, brightness, zoomLevel, zoomCenter, detectionZone, setDetectionZone, startCamera, stopCamera, restartCamera, toggleMute, toggleFlash, takeSnapshot, stream, error: cameraError } =
    useCamera({ onMotionDetected: handleMotion, onSoundDetected: handleSound, onFallDetected: handleFall, ignoreZones });

  const handleRemoteCommand = useCallback((msg: any) => {
    wakeUp();
    if (msg.type === 'COMMAND') {
      if (msg.action === 'TOGGLE_FLASH') {
        toggleFlash();
      }
      if (msg.action === 'TOGGLE_SIREN') {
        toggleSiren();
      }
      if (msg.action === 'TOGGLE_NIGHT_VISION') {
        setAutoNightVision(false);
        setNightVision((prev: boolean) => !prev);
      }
      if (msg.action === 'TAKE_SNAPSHOT') {
        takeSnapshot();
      }
      if (msg.action === 'TOGGLE_AI') {
        setShowNarrative((prev: boolean) => !prev);
      }
    }
  }, [toggleFlash, toggleSiren, takeSnapshot, setNightVision, setAutoNightVision, setShowNarrative]);

  const { isConnected: viewerConnected, sendData, isReceivingAudio } = useWebRTC({
    deviceId: resolvedDeviceId || "",
    role: "camera",
    localStream: stream,
    onDataMessage: handleRemoteCommand
  });

  // Auto-Wake on Viewer Connect
  useEffect(() => {
    if (viewerConnected) {
      wakeUp();
    }
  }, [viewerConnected, wakeUp]);

  // Ref to track last executed command and prevent infinite onSnapshot loops via local cache
  const lastExecutedCmdTimeRef = useRef<number>(0);
  const mountTime = useRef(Date.now()).current;

  // Sync settings for ignore_zones
  useEffect(() => {
    if (!resolvedDeviceId) return;
    const unsubscribe = onSnapshot(doc(db, "devices", resolvedDeviceId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIgnoreZones(data.settings?.ignore_zones || []);
        setDeviceName(data.name || "");
        if (data.settings?.ai_mode) aiOrchestrator.setMode(data.settings.ai_mode);
        
        // Handle fallback remote commands from Firestore
        if (data.last_command) {
          const cmd = data.last_command;
          // Avoid re-running old commands immediately on mount, 
          // check if timestamp is within the last 15 seconds.
          let cmdTime = 0;
          try {
             if (cmd.timestamp && typeof cmd.timestamp.toDate === 'function') {
                 cmdTime = cmd.timestamp.toDate().getTime();
             }
          } catch(e) {}
          
          if (Date.now() - cmdTime < 15000 && cmdTime > lastExecutedCmdTimeRef.current) {
            lastExecutedCmdTimeRef.current = cmdTime;
            console.log("[CameraMode] Received fallback command via Firestore:", cmd.action);
            handleRemoteCommand({ type: 'COMMAND', action: cmd.action });
            // Clear immediately to prevent duplicate triggers across re-mounts
            updateDoc(doc(db, "devices", resolvedDeviceId), { last_command: deleteField() }).catch(() => {});
          }
        }
        
        // Remote Reference Image Sync
        if (data.reference_image !== undefined) {
          if (data.reference_image !== referenceImage) {
            setReferenceImage(data.reference_image);
            if (data.reference_image) {
              localStorage.setItem("hguard_reference_image", data.reference_image);
            } else {
              localStorage.removeItem("hguard_reference_image");
            }
          }
        }
      }
    });
    return () => unsubscribe();
  }, [resolvedDeviceId, referenceImage, handleRemoteCommand]);

  const userRef = useRef(user);
  const isOnlineRef = useRef(isOnline);
  const resolvedDeviceIdRef = useRef(resolvedDeviceId);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { resolvedDeviceIdRef.current = resolvedDeviceId; }, [resolvedDeviceId]);

  const profileDataRef = useRef(profileData);
  useEffect(() => { profileDataRef.current = profileData; }, [profileData]);

  const showNarrativeRef = useRef(showNarrative);
  useEffect(() => { showNarrativeRef.current = showNarrative; }, [showNarrative]);

  const isPowerSaveModeRef = useRef(isPowerSaveMode);
  useEffect(() => { isPowerSaveModeRef.current = isPowerSaveMode; }, [isPowerSaveMode]);

  // Battery & Status Sync to Firestore
  useEffect(() => {
    if (!resolvedDeviceId || !battery.supported) return;
    
    const syncStatus = async () => {
      await updateDoc(doc(db, "devices", resolvedDeviceId), {
        battery_level: battery.level,
        is_charging: battery.isCharging,
        last_seen: serverTimestamp()
      }).catch(() => {});
    };

    // Sync every 5 minutes or on significant battery change
    syncStatus();
    const interval = setInterval(syncStatus, 300000);
    return () => clearInterval(interval);
  }, [resolvedDeviceId, battery.level, battery.isCharging]);

  const handleRename = async () => {
    const newName = prompt("Enter new camera name:", deviceName);
    if (newName && newName !== deviceName && resolvedDeviceId) {
      await updateDoc(doc(db, "devices", resolvedDeviceId), { name: newName });
    }
  };



  useEffect(() => {
    if (cameraError) toast({ title: "Camera Error", description: cameraError, variant: "destructive" });
  }, [cameraError]);

  useEffect(() => {
    if (autoNightVision && !flashOn) {
      if (brightness < 30 && !nightVision) setNightVision(true);
      if (brightness > 50 && nightVision) setNightVision(false);
    }
  }, [brightness, autoNightVision, nightVision, flashOn]);

  // AI Auto-Off Timer (60 seconds) to protect quota
  useEffect(() => {
    if (showNarrative) {
      const timer = setTimeout(() => {
        setShowNarrative(false);
        setAnalysis(null); // Clear the narrative box UI too
        toast({
          title: "AI Standby",
          description: "AI deactivated after 60s to conserve quota."
        });
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [showNarrative]);



  // 1. Camera Lifecycle (Start/Stop)
  useEffect(() => {
    setCameraStarted(false);
    setWatchdogError(null);
    startCamera();
    setCameraStarted(true);
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Watchdog: if camera never goes active within 10s, surface a useful error
  useEffect(() => {
    if (isActive) {
      setWatchdogError(null);
      return;
    }
    if (!cameraStarted) return;
    const timer = setTimeout(() => {
      if (!isActive) {
        setWatchdogError(
          "Camera stream could not start. Check that your browser has camera permission and a camera device is connected."
        );
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [isActive, cameraStarted]);

  // 2. AI Polling Interval
  const referenceImageRef = useRef(referenceImage);
  useEffect(() => { referenceImageRef.current = referenceImage; }, [referenceImage]);

  useEffect(() => {
    const executeScan = async () => {
      if (!isActive || !showNarrative) return;
      const snapshot = takeSnapshot();
      if (!snapshot) {
        console.warn("[CameraMode] AI Scan aborted: No snapshot available.");
        return;
      }

      console.log("[CameraMode] AI Scan running" + (referenceImageRef.current ? " (with reference)" : "") + "...");
      setIsAnalyzing(true);
      try {
        const result = await aiOrchestrator.identify(snapshot, referenceImageRef.current || undefined);
        console.log("[CameraMode] AI Result Received:", result);
        if (!result.detected_objects || result.detected_objects.length === 0) {
          console.log("[CameraMode] AI Result: No objects detected.");
        }
        setAnalysis(result);
        // Analysis persists for 15s to ensure the HUD is visible between scans
        setTimeout(() => {
          setAnalysis(prev => prev === result ? null : prev);
        }, 15000);
      } catch (e) {
        console.error("[CameraMode] AI Error:", e);
        toast({
          title: "AI Analysis Failed",
          description: "Check your API quota and internet connection.",
          variant: "destructive"
        });
      } finally {
        setIsAnalyzing(false);
      }
    };

    if (showNarrative) {
      // Immediate scan — no artificial delay
      executeScan();
    }

    const proactiveAI = setInterval(executeScan, 10000);
    return () => clearInterval(proactiveAI);
  }, [isActive, takeSnapshot, showNarrative]);

  // Stream Telemetry to Viewers
  useEffect(() => {
    if (viewerConnected) {
      sendData({
        type: 'TELEMETRY',
        data: {
          zoomLevel,
          zoomCenter,
          videoWidth: videoRef.current?.videoWidth || 640,
          videoHeight: videoRef.current?.videoHeight || 480,
          isFlashOn: flashOn,
          isSirenOn: sirenActive,
          isNightVision: nightVision,
          ambientBrightness: brightness,
          isAiActive: showNarrative
        }
      });
    }
  }, [zoomLevel, zoomCenter, viewerConnected, sendData, flashOn, sirenActive, nightVision, brightness]);

  // Stream AI Analysis to Viewers
  useEffect(() => {
    if (viewerConnected && analysis) {
      sendData({
        type: 'AI_ANALYSIS',
        data: analysis
      });
    }
  }, [analysis, viewerConnected, sendData]);

  const handleSnapshot = () => {
    if (takeSnapshot()) toast({ title: "Snapshot Captured", description: "Saved to your device." });
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none">
      {/* Edge-to-Edge Video */}
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-all duration-[2000ms] z-0 opacity-100",
          nightVision ? "brightness-[1.8] contrast-[1.3] sepia-[1] hue-rotate-[70deg] saturate-[2] invert-[0.05]" : ""
        )}
        style={{ transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`, transform: `scale(${zoomLevel})` }}
        autoPlay
        playsInline
        muted
      />

      {/* Deep Sleep Overlay */}
      <AnimatePresence>
        {isPowerSaveMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[45] bg-black flex flex-col items-center justify-center gap-6"
          >
            <div className="relative">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"
              />
              <Moon className="h-20 w-20 text-primary/40 relative z-10" />
            </div>
            
            <div className="text-center space-y-2 relative z-10">
              <h2 className="text-2xl font-black text-white/40 uppercase tracking-[0.3em]">Deep Sleep</h2>
              <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest animate-pulse">
                Motion Wake Active • Saving Power
              </p>
            </div>

            <Button 
              variant="outline"
              onClick={() => setIsPowerSaveMode(false)}
              className="mt-8 rounded-full border-white/10 bg-white/5 text-white/60 hover:bg-white/10 px-8 font-black uppercase tracking-widest text-[10px]"
            >
              WAKE SCREEN
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AIOverlays 
        isMonitoring={isMonitoring} 
        analysis={analysis} 
        canvasRef={canvasRef}
      />

      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Error Overlay */}
      {(cameraError || watchdogError) && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm px-8 text-center">
          <div className="flex flex-col items-center gap-6 max-w-sm">
            <div className="h-20 w-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <ShieldAlert className="h-10 w-10 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-tight">Camera Access Blocked</h2>
              <p className="text-sm text-white/60 leading-relaxed">{cameraError || watchdogError}</p>
            </div>
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">How to fix</p>
              <ol className="text-xs text-white/50 space-y-1 list-decimal list-inside">
                <li>Click the 🔒 lock icon in the browser address bar</li>
                <li>Set <strong className="text-white/80">Camera</strong> to <strong className="text-white/80">Allow</strong></li>
                <li>Reload the page or tap Retry below</li>
              </ol>
            </div>
            <Button
              onClick={() => { setWatchdogError(null); restartCamera(); }}
              className="w-full h-12 rounded-2xl bg-primary text-black font-black uppercase tracking-widest flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Camera
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="text-white/40 hover:text-white text-xs"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* Top HUD: Logo & Clock */}
      <div className="absolute top-6 left-0 right-0 px-6 flex items-center justify-between z-50 pointer-events-none landscape:top-4">
        <div className="flex items-center gap-4 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-3xl border border-white/20 text-white hover:bg-white/20 transition-all shadow-2xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link to="/dashboard">
            <Logo size="sm" className="h-8 opacity-90 drop-shadow-2xl" />
          </Link>
        </div>

        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          {/* Diagnostics & Manual Hardware Refresh */}
          <div className="flex items-center gap-2">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center shadow-lg">
              <span className="text-[9px] font-bold uppercase text-white/60 tracking-widest font-mono">
                CAM:{isActive ? 'RDY' : 'ERR'} | BR:{brightness}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={restartCamera}
              title="Force Hardware Restart"
              className="h-6 w-6 rounded-full bg-black/40 border border-white/10 hover:bg-white/20 transition-all shadow-lg text-white"
            >
              <RefreshCcw className="h-3 w-3 text-white/70" />
            </Button>
          </div>

          <div className="bg-black/40 backdrop-blur-3xl border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-black text-white tracking-widest font-mono">
              {formatTime(monitoringSeconds)}
            </span>
          </div>
          
          {!isOnline && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary/20 backdrop-blur-md border border-primary/30 px-3 py-1 rounded-full flex items-center gap-2"
            >
              <Zap className="h-3 w-3 text-primary animate-pulse" />
              <span className="text-[9px] font-black text-primary uppercase tracking-widest">Local AI Active</span>
            </motion.div>
          )}

          {isAnalyzing && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full flex items-center gap-2"
             >
               <RefreshCcw className="h-3 w-3 text-white animate-spin" />
               <span className="text-[9px] font-black text-white uppercase tracking-widest">AI Analyzing...</span>
             </motion.div>
          )}

          {isReceivingAudio && (
            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="bg-primary px-4 py-2 rounded-2xl flex items-center gap-3 shadow-[0_0_20px_rgba(var(--primary),0.4)]"
             >
               <Mic className="h-4 w-4 text-black animate-pulse" />
               <span className="text-[10px] font-black text-black uppercase tracking-widest">Viewer Speaking...</span>
             </motion.div>
          )}
        </div>
      </div>



      {/* Side Controls: Night Vision + AI Narrative Toggle + Reference Image */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            // Allows toggle without fighting auto-night-vision
            setAutoNightVision(false);
            setNightVision(!nightVision);
          }}
          className={cn(
            "h-12 w-12 rounded-full border-2 transition-all shadow-xl",
            nightVision ? "bg-green-500 text-black border-green-300 shadow-[0_0_20px_rgba(34,197,94,0.5)]" : "bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20"
          )}
        >
          {nightVision ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />}
        </Button>

        {/* AI Toggle */}
        <button
          onClick={() => setShowNarrative(!showNarrative)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-full border-2 transition-all shadow-xl text-[9px] font-black uppercase tracking-wider",
            showNarrative
              ? "bg-primary text-black border-primary shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
              : "bg-black/50 backdrop-blur-md border-white/20 text-white/50 hover:border-white/40"
          )}
        >
          <div className={cn(
            "h-1.5 w-1.5 rounded-full",
            showNarrative ? (isAnalyzing ? "bg-black animate-spin" : "bg-black animate-pulse") : "bg-white/30"
          )} />
          AI
        </button>

        {/* Reference Image Capture */}
        <button
          onClick={async () => {
            const snap = takeSnapshot();
            if (snap) {
              setReferenceImage(snap);
              localStorage.setItem("hguard_reference_image", snap);
              if (resolvedDeviceId) {
                await updateDoc(doc(db, "devices", resolvedDeviceId), {
                  reference_image: snap,
                  updated_at: serverTimestamp()
                });
              }
              setShowRefSavedToast(true);
              setTimeout(() => setShowRefSavedToast(false), 2500);
              toast({ title: "Reference Saved", description: "AI will now identify this person/object in future scans." });
            }
          }}
          title="Set AI Reference Image (long-press to clear)"
          onContextMenu={async (e) => {
            e.preventDefault();
            setReferenceImage(null);
            localStorage.removeItem("hguard_reference_image");
            if (resolvedDeviceId) {
              await updateDoc(doc(db, "devices", resolvedDeviceId), {
                reference_image: null,
                updated_at: serverTimestamp()
              });
            }
            toast({ title: "Reference Cleared", description: "AI will perform generic detection." });
          }}
          className={cn(
            "flex flex-col items-center gap-1 px-2.5 py-2 rounded-full border-2 transition-all shadow-xl text-[8px] font-black uppercase tracking-wider",
            referenceImage
              ? "bg-blue-500 text-white border-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              : "bg-black/50 backdrop-blur-md border-white/20 text-white/50 hover:border-white/40"
          )}
        >
          <div className="h-3 w-3 rounded-full border-2 border-current overflow-hidden flex items-center justify-center">
            {referenceImage
              ? <img src={referenceImage} className="h-full w-full object-cover" alt="ref" />
              : <div className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />}
          </div>
          REF
        </button>
      </div>

      {/* Bottom Action Bar — Flash | Snapshot | Siren | Mute — all independently toggleable */}
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
        batteryLevel={battery.level ?? 100}
        isCharging={battery.isCharging}
        isPowerSaveMode={isPowerSaveMode}
        togglePowerSave={() => setIsPowerSaveMode(!isPowerSaveMode)}
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
