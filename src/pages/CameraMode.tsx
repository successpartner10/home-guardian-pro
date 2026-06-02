// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
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
  Settings, Terminal, Clock, ShieldAlert, RefreshCw, Shield, Eye, EyeOff, Activity
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
import * as faceapi from "@vladmandic/face-api";

interface PendingAlert {
  type: string;
  thumbnail_url?: string | null;
  created_at: string;
}

// ActionBar removed per architecture shift - Camera is a dumb node

const CameraMode = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { user, profileData, relinkGoogle } = useAuth();
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
  const [showNarrative, setShowNarrative] = useState(true);
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
  const [showControls, setShowControls] = useState(false);
  const [ambientBrightness, setAmbientBrightness] = useState(100);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(localStorage.getItem("hguard_preferred_camera") || "");
  const [isBridgeMode, setIsBridgeMode] = useState(false);
  const isRecordingRef = useRef(false);
  const [cameraMode, setCameraMode] = useState<'select' | 'lite' | 'full'>(() => {
    return (localStorage.getItem("hguard_camera_mode") as 'select' | 'lite' | 'full') || 'full';
  });

  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [knownFaces, setKnownFaces] = useState<{name: string, descriptor: Float32Array}[]>([]);
  const lastFaceAlertRef = useRef(0);
  const [activeBolos, setActiveBolos] = useState<{id: string, label: string, descriptor: Float32Array}[]>([]);
  const lastBoloHitRef = useRef<Record<string, number>>({});
  const [civicMeshEnabled, setCivicMeshEnabled] = useState(false);

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

    // Samsung devices
    const samsungMatch = ua.match(/Samsung[- ]([^\s;)]+)/i) || ua.match(/SM-([A-Z0-9]+)/i);
    if (samsungMatch) {
      const smModel = samsungMatch[1].toUpperCase();
      const knownSamsung: Record<string, string> = {
        'G960': 'Samsung S9', 'G965': 'Samsung S9+',
        'G970': 'Samsung S10e', 'G973': 'Samsung S10', 'G975': 'Samsung S10+',
        'G980': 'Samsung S20', 'G988': 'Samsung S20 Ultra',
        'G991': 'Samsung S21', 'G998': 'Samsung S21 Ultra',
        'S901': 'Samsung S22', 'S908': 'Samsung S22 Ultra',
        'S911': 'Samsung S23', 'S918': 'Samsung S23 Ultra',
        'S921': 'Samsung S24', 'S928': 'Samsung S24 Ultra',
        'A515': 'Samsung A51', 'A525': 'Samsung A52', 'A536': 'Samsung A53',
        'A546': 'Samsung A54', 'A556': 'Samsung A55',
        'N975': 'Samsung Note 10+', 'N986': 'Samsung Note 20 Ultra',
      };
      const prefix = smModel.replace(/^SM-/, '').slice(0, 4);
      model = knownSamsung[prefix] || `Samsung ${smModel.replace(/^SM-/, '')}`;
    }
    // iPhone / iPad
    else if (/iPhone|iPad/i.test(ua)) {
      const isIPad = /iPad/i.test(ua);
      model = isIPad ? 'iPad' : 'iPhone';
    }
    // Google Pixel
    else if (/Pixel[- ]?(\d+[a-zA-Z]*)/i.test(ua)) {
      const pixelMatch = ua.match(/Pixel[- ]?(\d+[a-zA-Z]*)/i);
      model = pixelMatch ? `Google Pixel ${pixelMatch[1]}` : "Google Pixel";
    }
    // OnePlus
    else if (/OnePlus[- ]?([^\s;)]+)/i.test(ua)) {
      const opMatch = ua.match(/OnePlus[- ]?([^\s;)]+)/i);
      model = opMatch ? `OnePlus ${opMatch[1]}` : "OnePlus";
    }
    // Xiaomi / Redmi
    else if (/(Redmi|POCO|Mi)[- ]?([^\s;)]+)/i.test(ua)) {
      const xiaomiMatch = ua.match(/(Redmi|POCO|Mi)[- ]?([^\s;)]+)/i);
      model = xiaomiMatch ? `${xiaomiMatch[1]} ${xiaomiMatch[2]}` : "Xiaomi Device";
    }
    // Desktop fallbacks
    else if (/Windows/i.test(ua)) {
      model = 'Windows PC';
    } else if (/Macintosh/i.test(ua)) {
      model = 'Mac';
    } else if (/Linux/i.test(ua)) {
      model = 'Linux Device';
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
          // Do NOT overwrite name — preserve any custom name the user set
          await updateDoc(doc(db, "devices", existingDoc.id), {
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
      toast({ title: "Camera woke up", description: "Motion detected — live view is back on." });
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
            setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 120000);
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
    toast({ title: "Possible fall detected", variant: "destructive" });
    if (!sirenActive) toggleSiren();
    const alertData = { device_id: resolvedDeviceIdRef.current, user_id: userRef.current.uid, type: "fall_detected", viewed: false, created_at: serverTimestamp() };
    addDoc(collection(db, "alerts"), alertData).catch(() => {});
    triggerWebhook(alertData);
  }, [sirenActive, toggleSiren, wakeUp]);

  const { videoRef, canvasRef, isActive, isMuted, flashOn, brightness, zoomLevel, zoomCenter, detectionZone, setDetectionZone, startCamera, stopCamera, restartCamera, toggleMute, toggleFlash, takeSnapshot, stream, applyHardwareZoom, hardwareZoomRange, error: cameraError } =
    useCamera({
      onMotionDetected: cameraMode === 'full' ? handleMotion : undefined,
      onSoundDetected: cameraMode === 'full' ? handleSound : undefined,
      onFallDetected: cameraMode === 'full' ? handleFall : undefined,
      ignoreZones,
      deviceId: selectedCameraId,
      isScreenCapture: isBridgeMode
    });

  const handleRemoteCommand = useCallback((msg: any) => {
    wakeUp();
    if (msg.type === 'COMMAND') {
      if (msg.action === 'TOGGLE_FLASH') toggleFlash();
      if (msg.action === 'TOGGLE_SIREN') toggleSiren();
      if (msg.action === 'TOGGLE_NIGHT_VISION') { 
        setAutoNightVision(false); 
        setNightVision(prev => !prev); 
      }
      if (msg.action === 'TAKE_SNAPSHOT') takeSnapshot();
      if (msg.action === 'SET_ZOOM' && typeof msg.value === 'number') {
        applyHardwareZoom(msg.value);
      }
      if (msg.action === 'TOGGLE_POWER_SAVE') {
        setIsPowerSaveMode(prev => !prev);
      }
      if (msg.action === 'SWITCH_SOURCE') {
        setIsBridgeMode(prev => {
          setTimeout(restartCamera, 0);
          return !prev;
        });
      }
      if (msg.action === 'TOGGLE_AI') {
        if (cameraMode === 'full') {
          setShowNarrative(prev => !prev);
        } else {
          toast({
            title: "Command not available",
            description: "Turn on Full protection mode to use AI from the viewer."
          });
        }
      }
    }
  }, [toggleFlash, toggleSiren, takeSnapshot, applyHardwareZoom, wakeUp, cameraMode, toast]);

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
        if (data.settings?.ai_active !== undefined) setShowNarrative(data.settings.ai_active);
        if (data.settings?.auto_night_vision !== undefined) setAutoNightVision(data.settings.auto_night_vision);
        if (data.settings?.power_save !== undefined) setIsPowerSaveMode(data.settings.power_save);
        setCivicMeshEnabled(data.civic_mesh_enabled ?? false);
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
    if (autoNightVision) {
      if (ambientBrightness < 15 && !nightVision) {
        setNightVision(true);
      } else if (ambientBrightness > 30 && nightVision) {
        setNightVision(false);
      }
    }
  }, [ambientBrightness, autoNightVision, nightVision]);

  useEffect(() => {
    if (cameraMode !== 'select' && !cameraStarted) {
      startCamera();
      setCameraStarted(true);
    }
    return () => {
      if (cameraStarted) {
        stopCamera();
        setCameraStarted(false);
      }
    };
  }, [startCamera, stopCamera, cameraStarted, cameraMode]);

  // Load Face API models and identities
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const initFaceApi = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        if (mounted) setFaceModelsLoaded(true);

        const snap = await getDocs(collection(db, "profiles", user.uid, "faces"));
        if (mounted) {
          setKnownFaces(snap.docs.map(d => ({
            name: d.data().name,
            descriptor: new Float32Array(d.data().descriptor)
          })));
        }
      } catch (e) { console.error("FaceAPI Load Error:", e); }
    };
    initFaceApi();
    return () => { mounted = false; };
  }, [user]);

  // Listen for active BOLO alerts pushed from Sentinel Command Center
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bolo_alerts"), snap => {
      const bolos = snap.docs
        .filter(d => d.data().status === "active")
        .map(d => ({
          id: d.id,
          label: d.data().label,
          descriptor: new Float32Array(d.data().descriptor)
        }));
      setActiveBolos(bolos);
    });
    return () => unsub();
  }, []);

  // Edge Facial Recognition Loop (Personal + BOLO)
  useEffect(() => {
    if (!faceModelsLoaded || cameraMode !== 'full' || !isActive || isPowerSaveMode) return;
    let timeout: any;
    const detectFaces = async () => {
      try {
        if (videoRef.current) {
          const detections = await faceapi.detectAllFaces(videoRef.current)
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (detections.length > 0 && userRef.current && resolvedDeviceIdRef.current) {
            const now = Date.now();
            const deviceName = devices.find((d: any) => d.id === resolvedDeviceIdRef.current)?.name || "Unknown Camera";

            // — Personal identity matching —
            let names: string[] = [];
            detections.forEach(det => {
              let bestMatch = { name: "Unknown Person", distance: 1.0 };
              knownFaces.forEach(known => {
                const dist = faceapi.euclideanDistance(det.descriptor, known.descriptor);
                if (dist < bestMatch.distance) bestMatch = { name: known.name, distance: dist };
              });
              names.push(bestMatch.distance < 0.55 ? bestMatch.name : "Unknown Person");
            });
            if (now - lastFaceAlertRef.current > 15000) {
              lastFaceAlertRef.current = now;
              const alertData = {
                device_id: resolvedDeviceIdRef.current,
                user_id: userRef.current.uid,
                type: Array.from(new Set(names)).includes("Unknown Person") ? "unknown_face" : "known_face",
                message: `Faces detected: ${Array.from(new Set(names)).join(", ")}`,
                viewed: false,
                created_at: serverTimestamp()
              };
              addDoc(collection(db, "alerts"), alertData).catch(() => {});
              triggerWebhook(alertData);
              wakeUp();
            }

            // — BOLO / Sentinel matching — only if user opted into Civic Mesh —
            if (civicMeshEnabled && activeBolos.length > 0) {
              detections.forEach(det => {
                activeBolos.forEach(bolo => {
                  const dist = faceapi.euclideanDistance(det.descriptor, bolo.descriptor);
                  const confidence = Math.max(0, 1 - dist);
                  const lastHit = lastBoloHitRef.current[bolo.id] || 0;
                  
                  // Fire hit if confidence > 60% and not hit in last 20 seconds
                  if (confidence > 0.60 && now - lastHit > 20000) {
                    lastBoloHitRef.current[bolo.id] = now;

                    // Try to get GPS coords
                    const hitPayload: any = {
                      boloId: bolo.id,
                      boloLabel: bolo.label,
                      deviceId: resolvedDeviceIdRef.current,
                      deviceName,
                      confidence,
                      timestamp: serverTimestamp()
                    };

                    const fireHit = (payload: any) => {
                      addDoc(collection(db, "bolo_hits"), payload).catch(() => {});
                      // Also update hit count on the BOLO
                      updateDoc(doc(db, "bolo_alerts", bolo.id), { hitCount: (increment as any)(1) }).catch(() => {});
                      wakeUp();
                    };

                    if ("geolocation" in navigator) {
                      navigator.geolocation.getCurrentPosition(
                        pos => fireHit({ ...hitPayload, lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        () => fireHit(hitPayload),
                        { timeout: 3000 }
                      );
                    } else {
                      fireHit(hitPayload);
                    }
                  }
                });
              });
            }
          }
        }
      } catch (e) { }
      timeout = setTimeout(detectFaces, 2000); // Check every 2 seconds
    };
    detectFaces();
    return () => clearTimeout(timeout);
  }, [faceModelsLoaded, cameraMode, isActive, isPowerSaveMode, knownFaces, activeBolos, civicMeshEnabled, triggerWebhook, wakeUp, devices]);

  useEffect(() => {
    if (viewerConnected) {
      sendData({
        type: 'TELEMETRY',
        data: {
          zoomLevel, zoomCenter,
          isFlashOn: flashOn, isSirenOn: sirenActive, isNightVision: nightVision,
          ambientBrightness, isAiActive: showNarrative,
          hardwareZoomRange: hardwareZoomRange || null,
          isPowerSaveMode, isBridgeMode
        }
      });
    }
  }, [zoomLevel, zoomCenter, viewerConnected, sendData, flashOn, sirenActive, nightVision, ambientBrightness, showNarrative, hardwareZoomRange]);

  // AI Analysis Loop
  const aiErrorCountRef = useRef(0);
  useEffect(() => {
    let mounted = true;
    let timeout: any;

    const analyze = async () => {
      if (cameraMode !== 'full' || !showNarrative || !isActive || isPowerSaveMode) return;
      
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
  }, [showNarrative, isActive, isPowerSaveMode, takeSnapshot, viewerConnected, referenceImage, sendData, cameraMode]);

  useEffect(() => {
    (window as any).hguard_night_vision = nightVision;
  }, [nightVision]);

  const handleRename = () => {
    const newName = prompt("Enter new camera name:", deviceName);
    if (newName && resolvedDeviceId) updateDoc(doc(db, "devices", resolvedDeviceId), { name: newName });
  };

  return (
    <div className="relative h-screen w-screen bg-background overflow-hidden select-none">
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
      {showControls && isReceivingAudio && (
        <div className="absolute top-6 right-6 z-50 flex items-center gap-3 px-4 py-2 bg-red-600/90 backdrop-blur-md rounded-2xl animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.4)] border border-red-500/50">
          <Mic className="h-4 w-4 text-foreground" />
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Viewer is talking</span>
        </div>
      )}

      {/* Civic Mesh Badge — shown when opted in */}
      {showControls && civicMeshEnabled && activeBolos.length > 0 && (
        <div className="absolute top-6 left-6 z-50 flex items-center gap-2 px-3 py-1.5 bg-amber-500/90 backdrop-blur-md rounded-xl border border-amber-400/50 shadow-lg">
          <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-black">Civic Mesh Active</span>
        </div>
      )}

      {/* Header HUD */}
      {showControls && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
          <div className="px-4 py-2 rounded-2xl bg-background/40 backdrop-blur-3xl border border-border flex items-center gap-3 shadow-2xl">
            <div className={cn(
              "h-2 w-2 rounded-full animate-pulse",
              !resolvedDeviceId ? "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" : 
              viewerConnected ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" :
              "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
            )} />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/80">
              {!resolvedDeviceId ? "Setting up…" : viewerConnected ? "Someone is watching" : "Ready to watch"}
            </span>
          </div>

          {cameraMode !== 'select' && (
            <button
              onClick={async () => {
                const nextMode = cameraMode === 'lite' ? 'full' : 'lite';
                if (nextMode === 'full') {
                  const fullCameras = devices.filter(d => d.settings?.cloud_recording === true && d.id !== resolvedDeviceId);
                  if (fullCameras.length >= 4) {
                    toast({ title: "Limit Reached", description: "Maximum of 4 cameras can save to Google Drive simultaneously.", variant: "destructive" });
                    return;
                  }
                }
                setCameraMode(nextMode);
                localStorage.setItem("hguard_camera_mode", nextMode);
                if (resolvedDeviceId) await updateDoc(doc(db, "devices", resolvedDeviceId), { "settings.cloud_recording": nextMode === 'full' });
                toast({
                  title: `Switched to ${nextMode === 'lite' ? 'Watch only' : 'Full protection'}`,
                  description: nextMode === 'lite' 
                    ? "Streaming only — AI and cloud recording are off."
                    : "AI alerts and cloud recording are on."
                });
              }}
              className={cn(
                "px-3 py-2 rounded-2xl border backdrop-blur-3xl text-[9px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 transition-all shadow-2xl",
                cameraMode === 'lite' 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
                  : "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
              )}
            >
              {cameraMode === 'lite' ? (
                <>
                  <Eye className="h-3 w-3 animate-pulse" />
                  <span>Watch only</span>
                </>
              ) : (
                <>
                  <Shield className="h-3 w-3" />
                  <span>Full</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Camera is now a pure viewer node; all controls are managed remotely via WebRTC */}
      {showControls && (
        <div className="absolute top-6 left-6 z-50 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { localStorage.removeItem("hguard_role"); navigate("/dashboard"); }} className="h-12 w-12 rounded-2xl bg-muted/50 backdrop-blur-3xl border border-border text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
      )}

      {showControls && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
          <div className="px-4 py-2 rounded-2xl bg-background/40 backdrop-blur-3xl border border-border shadow-2xl flex items-center gap-3">
            <BatteryIcon className={cn("h-4 w-4", battery.isCharging ? "text-green-400" : "text-muted-foreground")} />
            <span className="text-[10px] font-black text-foreground/80">{battery.level}%</span>
            <div className="w-[1px] h-3 bg-white/20" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {deviceName || "Camera Node"}
            </span>
          </div>
        </div>
      )}

      {/* Floating Toggle HUD button */}
      <button
        onClick={() => setShowControls(p => !p)}
        className="absolute bottom-6 right-6 z-[70] h-12 w-12 rounded-2xl bg-background/50 hover:bg-background/80 backdrop-blur-3xl border border-border/80 flex items-center justify-center text-foreground hover:scale-105 transition-all shadow-2xl"
        title={showControls ? "Hide Controls" : "Show Controls"}
      >
        {showControls ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>

      <AnimatePresence>
        {isPowerSaveMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-background flex flex-col items-center justify-center cursor-pointer"
            onClick={() => setIsPowerSaveMode(false)}
          >
            <div className="flex flex-col items-center gap-6 opacity-40">
              <Padlock className="h-12 w-12 text-foreground" />
              <p className="text-foreground text-sm font-bold tracking-widest uppercase">Power-Saving Mode</p>
              <p className="text-muted-foreground text-xs text-center max-w-[250px]">
                Camera screen is off to save battery.<br/>Tap anywhere or use Viewer to wake.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CameraMode;
