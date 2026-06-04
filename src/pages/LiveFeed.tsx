// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wifi, WifiOff, Volume2, VolumeX, Camera, Maximize, RefreshCw, ChevronRight, Share2, Copy, Check, Maximize2, Moon, Sun, Mic, Brain, Thermometer, AlertTriangle, Zap, FlashlightOff, Flashlight, ScanSearch, X, Monitor, Smartphone, BatteryMedium } from "lucide-react";
import { getAIQuotaStatus, analyzeFrame } from "@/lib/gemini";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { AIOverlays } from "@/components/AIOverlays";
import { DrawerSection, DrawerBtn } from "@/components/CameraControls";

interface Device {
  id: string;
  name: string;
  status: string;
  settings?: any;
}

const LiveFeed = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [playAttempted, setPlayAttempted] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCenter, setZoomCenter] = useState({ x: 50, y: 50 });
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isSirenOn, setIsSirenOn] = useState(false);
  const [isNightVision, setIsNightVision] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);
  const [isPowerSaveMode, setIsPowerSaveMode] = useState(false);
  const [isBridgeMode, setIsBridgeMode] = useState(false);
  const [isThermal, setIsThermal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hardwareZoomRange, setHardwareZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [hwZoomValue, setHwZoomValue] = useState(1);
  const [superZoom, setSuperZoom] = useState<{ image: string; reading: string | null; loading: boolean } | null>(null);
  const [superZoomTab, setSuperZoomTab] = useState<"all" | "identifiers" | "people" | "vehicles" | "context">("all");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();
    if (isSpeakingRef.current) {
      // Was speaking — cancel is enough, toggle off
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    const cleanText = text
      .replace(/\[IDENTIFIERS\]:/gi, "")
      .replace(/\[PEOPLE\]:/gi, "")
      .replace(/\[VEHICLES\]:/gi, "")
      .replace(/\[CONTEXT\]:/gi, "")
      // Remove bare None / None. that pollute speech
      .replace(/\bNone\.?\s*/gi, "")
      .trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => { isSpeakingRef.current = false; setIsSpeaking(false); };
    utterance.onerror = () => { isSpeakingRef.current = false; setIsSpeaking(false); };
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    // Must be called synchronously within user gesture — no setTimeout
    window.speechSynthesis.speak(utterance);
  }, []);

  const closeSuperZoom = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setSuperZoom(null);
    setSuperZoomTab("all");
  }, []);

  const { toast } = useToast();

  const handleRemoteStream = useCallback((stream: MediaStream) => {
    setRemoteStream(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  }, []);

  const handleDataMessage = useCallback((msg: any) => {
    if (msg.type === "TELEMETRY") {
      const d = msg.data || msg;
      if (d.zoomLevel) setZoomLevel(d.zoomLevel);
      if (d.zoomCenter) setZoomCenter(d.zoomCenter);
      if (d.isFlashOn !== undefined) setIsFlashOn(d.isFlashOn);
      if (d.isSirenOn !== undefined) setIsSirenOn(d.isSirenOn);
      if (d.isNightVision !== undefined) setIsNightVision(d.isNightVision);
      if (d.isAiActive !== undefined) setIsAiActive(d.isAiActive);
      if (d.isPowerSaveMode !== undefined) setIsPowerSaveMode(d.isPowerSaveMode);
      if (d.isBridgeMode !== undefined) setIsBridgeMode(d.isBridgeMode);
      if (d.hardwareZoomRange) setHardwareZoomRange(d.hardwareZoomRange);
    } else if (msg.type === "AI_ANALYSIS") {
      setAiAnalysis(msg.data);
    }
  }, []);

  const { connectionState, isConnected, isChannelReady, connect, disconnect, sendData } = useWebRTC({
    deviceId: deviceId || "",
    role: "viewer",
    localStream,
    onRemoteStream: handleRemoteStream,
    onDataMessage: handleDataMessage,
  });

  const sendCommand = useCallback(async (action: string) => {
    if (!isConnected && !deviceId) return;

    // Optimistic UI updates
    switch (action) {
      case 'TOGGLE_FLASH': setIsFlashOn(prev => !prev); break;
      case 'TOGGLE_NIGHT_VISION': setIsNightVision(prev => !prev); break;
      case 'TOGGLE_SIREN': setIsSirenOn(prev => !prev); break;
      case 'TOGGLE_AI': setIsAiActive(prev => !prev); break;
      case 'TOGGLE_POWER_SAVE': setIsPowerSaveMode(prev => !prev); break;
      case 'SWITCH_SOURCE': setIsBridgeMode(prev => !prev); break;
    }

    // 1. Try WebRTC Data Channel for lowest latency
    sendData({ type: 'COMMAND', action });

    // 2. Guaranteed Delivery Fallback via Firebase
    try {
      if (deviceId) {
        await updateDoc(doc(db, "devices", deviceId), {
          last_command: {
            action,
            timestamp: serverTimestamp()
          }
        });
      }
    } catch (e) {
      console.error("[LiveFeed] Firebase command fallback failed:", e);
    }
  }, [isConnected, sendData, deviceId]);

  const startTalking = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      setLocalStream(stream);
      setIsTalking(true);
    } catch (e) {
      toast({ title: "Microphone Access Denied", description: "Cannot use two-way talk without microphone permission.", variant: "destructive" });
    }
  };

  const stopTalking = () => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    setIsTalking(false);
  };

  const repairConnection = useCallback(async () => {
    toast({ 
      title: "Reconnecting", 
      description: "Resetting the connection — this may take a few seconds.",
      duration: 5000
    });
    
    disconnect();
    
    try {
      // Clear all signaling data for this device to ensure a clean slate
      const q = query(collection(db, "signaling"), where("deviceId", "==", deviceId));
      const snap = await getDocs(q);
      const batchPromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(batchPromises);
      console.log(`[LiveFeed] Purged ${snap.size} signaling documents for repair.`);
    } catch (e) { 
      console.error("Signaling purge failed during repair:", e); 
    }

    // Small delay to allow Firestore to propagate the deletions
    setTimeout(() => {
      console.log("[LiveFeed] Restarting connection after repair...");
      connect();
    }, 2000);
  }, [deviceId, disconnect, connect, toast]);

  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateShareLink = async (durationMinutes: number) => {
    if (!deviceId) return;
    setShareLoading(true);
    try {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

      const currentSettings = (device?.settings) || {};

      await updateDoc(doc(db, "devices", deviceId), {
        settings: {
          ...currentSettings,
          share_token: token,
          share_expires_at: expiresAt
        }
      });

      const url = `${window.location.origin}/shared/${token}`;
      setShareUrl(url);
    } catch (e) {
      toast({ title: "Error", description: "Failed to generate share link", variant: "destructive" });
    }
    setShareLoading(false);
  };

  const pairWithTV = async (code: string) => {
    if (!shareUrl) {
      toast({ title: "Generate Link First", description: "You need a share link before pairing.", variant: "destructive" });
      return;
    }
    const token = shareUrl.split("/").pop();
    try {
      await addDoc(collection(db, "pairing"), {
        code: code.toUpperCase(),
        token,
        created_at: serverTimestamp()
      });
      toast({ title: "Pairing Sent!", description: "Check your TV screen." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to send pairing code", variant: "destructive" });
    }
  };

  const copyToClipboard = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "Link copied to clipboard" });
    }
  };

  useEffect(() => {
    if (!deviceId) return;

    const docRef = doc(db, "devices", deviceId);

    // Initial fetch
    getDoc(docRef).then(snap => {
      if (snap.exists()) setDevice({ id: snap.id, ...snap.data() } as Device);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to load device:", err);
      setLoading(false);
    });

    // Safety timeout: stop spinner after 10 seconds even if Firebase hangs
    const safetyTimer = setTimeout(() => setLoading(false), 10000);

    // Real-time listener
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDevice({ id: snap.id, ...data } as Device);
        
        // Reset unread alerts if count is > 0
        if (data.unread_alerts > 0) {
          updateDoc(docRef, { unread_alerts: 0 }).catch(() => {});
        }
      }
    }, (err) => {
      console.error("LiveFeed real-time listener error:", err);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [deviceId]);

  const handleRename = async () => {
    const newName = prompt("Enter new camera name:", device?.name);
    if (newName && newName !== device?.name && deviceId) {
      await updateDoc(doc(db, "devices", deviceId), { name: newName });
    }
  };

  // Auto-connect with exponential backoff: waits for device online + signaling channel
  useEffect(() => {
    const isOnline = device?.status === "online" || device?.status === "recording";
    const isTerminal = connectionState === "failed" || connectionState === "disconnected";
    const isNew = connectionState === "new" || connectionState === "closed";

    if (connectionState === "connected") {
      // Successfully connected — reset backoff
      setReconnectAttempt(0);
      setIsReconnecting(false);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      return;
    }

    if (!isOnline || !isChannelReady) return;

    if (isNew) {
      // First connection attempt — minimal delay for fast start
      const timer = setTimeout(() => connect(), 150);
      return () => clearTimeout(timer);
    }

    if (isTerminal) {
      // Exponential backoff: 2s, 4s, 8s, 10s (capped)
      const attempt = reconnectAttempt + 1;
      const backoff = Math.min(2000 * Math.pow(2, reconnectAttempt), 10000);
      setReconnectAttempt(attempt);
      setIsReconnecting(true);
      console.log(`[LiveFeed] Reconnect attempt ${attempt} in ${backoff}ms...`);
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, backoff);
      return () => { if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); };
    }
  }, [device?.status, connectionState, connect, isChannelReady]);

  // Attach stream to video element when ref is ready
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      const video = remoteVideoRef.current;
      if (video.srcObject !== remoteStream) {
        console.log("[LiveFeed] Attaching remote stream. Tracks:", remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}`));
        video.srcObject = remoteStream;
        video.setAttribute('playsinline', 'true');

        const playVideo = () => {
          video.play()
            .then(() => {
              console.log("[LiveFeed] Remote video playback started.");
              setPlayAttempted(true);
            })
            .catch(e => {
              console.warn("[LiveFeed] Remote play failed, retrying...", e);
              setTimeout(() => {
                video.play()
                  .then(() => setPlayAttempted(true))
                  .catch(p => console.error("[LiveFeed] Final remote play failed:", p));
              }, 1000);
            });
        };

        if (video.readyState >= 2) playVideo();
        else video.onloadedmetadata = playVideo;
      }
    }
  }, [remoteStream, isConnected]);

  const toggleMute = () => {
    setMuted(!muted);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !muted;
    }
  };

  const toggleFullscreen = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.requestFullscreen?.();
    }
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.5, 1));

  const handlePlayRequest = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.play().catch(e => console.warn("[LiveFeed] Play request blocked:", e));
      setPlayAttempted(true);
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (remoteVideoRef.current && document.pictureInPictureEnabled) {
        await remoteVideoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      toast({ title: "Picture-in-Picture failed", variant: "destructive" });
    }
  };

  // ── Super Zoom Capture: grab frame → unsharp mask → AI read ──────────────
  const superZoomCapture = useCallback(async () => {
    const video = remoteVideoRef.current;
    if (!video || (!isConnected && !video.srcObject)) return;

    // 1. Capture raw frame to canvas at native resolution
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. Crop to the zoomed region (current zoomCenter + zoomLevel)
    if (zoomLevel > 1) {
      const cw = Math.round(canvas.width / zoomLevel);
      const ch = Math.round(canvas.height / zoomLevel);
      const sx = Math.max(0, Math.min(canvas.width - cw, Math.round((zoomCenter.x / 100) * canvas.width - cw / 2)));
      const sy = Math.max(0, Math.min(canvas.height - ch, Math.round((zoomCenter.y / 100) * canvas.height - ch / 2)));
      const cropped = document.createElement("canvas");
      cropped.width = canvas.width;
      cropped.height = canvas.height;
      const cctx = cropped.getContext("2d")!;
      cctx.drawImage(canvas, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
      canvas.getContext("2d")!.drawImage(cropped, 0, 0);
    }

    // 3. Unsharp mask: draw → blur copy → blend (sharpen)
    const sharp = document.createElement("canvas");
    sharp.width = canvas.width;
    sharp.height = canvas.height;
    const sctx = sharp.getContext("2d")!;
    // Original
    sctx.drawImage(canvas, 0, 0);
    const original = sctx.getImageData(0, 0, sharp.width, sharp.height);
    // Blurred (box blur approx)
    sctx.filter = "blur(1.5px) contrast(1.15) brightness(1.05)";
    sctx.drawImage(canvas, 0, 0);
    const blurred = sctx.getImageData(0, 0, sharp.width, sharp.height);
    // Blend: out = original + amount * (original - blurred)
    const amount = 2.2;
    const out = sctx.createImageData(sharp.width, sharp.height);
    for (let i = 0; i < original.data.length; i += 4) {
      out.data[i]   = Math.max(0, Math.min(255, original.data[i]   + amount * (original.data[i]   - blurred.data[i])));
      out.data[i+1] = Math.max(0, Math.min(255, original.data[i+1] + amount * (original.data[i+1] - blurred.data[i+1])));
      out.data[i+2] = Math.max(0, Math.min(255, original.data[i+2] + amount * (original.data[i+2] - blurred.data[i+2])));
      out.data[i+3] = 255;
    }
    sctx.filter = "none";
    sctx.putImageData(out, 0, 0);

    const enhanced = sharp.toDataURL("image/jpeg", 0.95);
    setSuperZoom({ image: enhanced, reading: null, loading: true });

    // 4. Send to AI Vision to read plate / identify content
    try {
      const result = await analyzeFrame(
        enhanced.split(",")[1] // pass just base64
      );
      setSuperZoom(prev => prev ? {
        ...prev,
        loading: false,
        reading: result.exhausted
          ? `AI quota reset ${result.retryIn}`
          : (result.text || "Could not read text in this frame.")
      } : null);
    } catch {
      setSuperZoom(prev => prev ? { ...prev, loading: false, reading: "AI unavailable." } : null);
    }
  }, [remoteVideoRef, isConnected, zoomLevel, zoomCenter]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-glow" />
            <div className="space-y-4 text-center">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.5em]">Connecting to camera…</p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[8px] uppercase tracking-widest text-foreground/20 hover:text-muted-foreground"
                onClick={() => window.location.reload()}
              >
                Force Hard Reload
              </Button>
            </div>
        </div>
      </div>
    );
  }

  const isOnline = device?.status === "online" || device?.status === "recording";

  const connectionLabel = {
    new: "Starting…",
    connecting: "Connecting…",
    connected: "Live",
    disconnected: "Reconnecting…",
    failed: "Couldn't connect",
    closed: "Offline",
  }[connectionState] || connectionState;

  return (
    <div className="relative flex min-h-screen flex-col bg-background overflow-hidden" onClick={handlePlayRequest}>
      {/* Video area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {isConnected && remoteStream ? (
          <>
            <div
              className="relative w-full h-full flex items-center justify-center overflow-hidden transition-transform duration-700 ease-out"
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`
              }}
            >
              <video
                ref={remoteVideoRef}
                className={cn(
                  "h-full w-full object-contain transition-all duration-700 ease-out",
                  isNightVision ? "brightness-[1.8] contrast-[1.4] sepia-[1] hue-rotate-[70deg] saturate-[2.5] invert-[0.05] drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]" : "",
                  zoomLevel > 1.5 && "brightness-[1.05] contrast-[1.1] saturate-[1.05]"
                )}
                style={{ 
                  transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`,
                  imageRendering: zoomLevel > 2 ? 'crisp-edges' : 'auto'
                }}
                autoPlay
                playsInline
                muted={muted}
              />

              {/* Stream AI Analysis Full HUD */}
              {aiAnalysis ? (
                <AIOverlays 
                isMonitoring={isAiActive} 
                analysis={aiAnalysis} 
                isThermal={isThermal}
              />
) : isAiActive ? (
                <div className="absolute top-24 inset-x-4 z-40 max-w-2xl mx-auto" style={{ transform: `scale(${1/zoomLevel})` }}>
                  <div className="mx-auto w-fit bg-background/80 backdrop-blur-3xl border border-purple-500/30 px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(168,85,247,0.3)] animate-pulse">
                    <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs tracking-wide font-bold text-purple-300">Looking for people and objects…</span>
                  </div>
                </div>
              ) : null}
            </div>
            
            <AnimatePresence>
                {!playAttempted && (
                    <motion.div
                        key="tap-to-play"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/40 backdrop-blur-sm cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); handlePlayRequest(); }}
                    >
                        <div className="h-20 w-20 rounded-full bg-muted/50 border border-border flex items-center justify-center backdrop-blur-2xl shadow-2xl animate-pulse">
                            <Maximize2 className="h-8 w-8 text-foreground" />
                        </div>
                        <span className="absolute bottom-32 text-[10px] font-bold text-muted-foreground tracking-wide">Tap to watch</span>
                    </motion.div>
                )}
            </AnimatePresence>
          </>
        ) : isOnline ? (
          <div className="flex h-full items-center justify-center w-full absolute inset-0 text-center space-y-3 z-10">
            {connectionState === "failed" || (isReconnecting && !isConnected) ? (
              <div className="flex flex-col items-center gap-3 p-8 bg-background/60 backdrop-blur-md rounded-3xl border border-border shadow-2xl">
                {isReconnecting ? (
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                ) : (
                  <WifiOff className="h-9 w-9 text-red-400" />
                )}
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className="text-sm font-black text-foreground">
                    {isReconnecting ? `Reconnecting… (attempt ${reconnectAttempt})` : "Connection lost"}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[200px]">
                    {isReconnecting
                      ? "Waiting for camera to become reachable. This happens automatically."
                      : "Make sure the camera app is open and online, then try again."}
                  </p>
                </div>
                <Button onClick={repairConnection} variant="outline" className="gap-2 bg-background/50 backdrop-blur-md border-border/50 mt-1 h-9 text-xs font-bold rounded-xl">
                  <RefreshCw className="h-3.5 w-3.5" /> Force Retry
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 p-8 bg-background/50 backdrop-blur-md rounded-3xl border border-border">
                <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                    {connectionState === "new" ? "Finding camera…" : "Connecting…"}
                  </p>
                  <p className="text-sm text-foreground/70">
                    {connectionState === "new" ? "Open the camera app on your other device if you haven't yet." : "Video should appear in a moment."}
                  </p>
                  <span className="text-[10px] uppercase tracking-widest text-foreground/30 mt-1">{device?.name}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center w-full absolute inset-0 z-10">
            <div className="text-center space-y-3 bg-card/10 p-8 rounded-3xl backdrop-blur-md border border-border">
              <WifiOff className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-xl font-medium text-foreground tracking-tight">{device?.name}</p>
              <p className="text-sm text-muted-foreground">Camera is offline</p>
            </div>
          </div>
        )}

        {/* Top bar — minimal: back + device pill + share */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-3 pt-4 pb-10 z-40 bg-gradient-to-b from-black/70 to-transparent">
          {/* Back */}
          <button onClick={() => navigate("/dashboard")} className="flex h-9 w-9 items-center justify-center rounded-full bg-background/50 hover:bg-white/20 border border-border backdrop-blur-md transition-colors">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>

          {/* Center: device name + live status */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-background/50 border border-border rounded-full backdrop-blur-md">
            {isConnected ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            ) : (
              <div className="h-2 w-2 rounded-full bg-zinc-600" />
            )}
            <span className="text-[11px] font-bold text-foreground/80 max-w-[120px] truncate">{device?.name || "Camera"}</span>
            <span className="text-[10px] text-foreground/30">·</span>
            <span className="text-[10px] font-bold text-muted-foreground">{isConnected ? "Live" : connectionLabel}</span>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-muted/50 hover:bg-white/20 border border-border backdrop-blur-md transition-colors shadow-lg">
                <Share2 className="h-5 w-5 text-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background border border-zinc-800 text-foreground rounded-3xl max-w-[380px] w-[95vw] max-h-[90vh] overflow-y-auto custom-scrollbar overflow-x-hidden">
              <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
                <DialogTitle className="text-xl font-black uppercase tracking-tighter">Share Stream</DialogTitle>
                <DialogDescription className="text-zinc-400 font-medium text-xs">
                  Create a temporary link for others to view this camera.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-2">
                {!shareUrl ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Access Duration</label>
                      <Select onValueChange={(val) => generateShareLink(parseInt(val))}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 rounded-xl text-foreground h-12">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-foreground">
                          <SelectItem value="5">5 Minutes</SelectItem>
                          <SelectItem value="60">1 Hour</SelectItem>
                          <SelectItem value="1440">24 Hours</SelectItem>
                          <SelectItem value="10080">1 Week</SelectItem>
                          <SelectItem value="43200">1 Month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {shareLoading && (
                      <div className="flex justify-center py-4">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-300">
                    <div className="p-3 bg-white rounded-2xl shadow-2xl">
                      <QRCodeSVG value={shareUrl} size={140} />
                    </div>

                    <div className="w-full space-y-5">
                      <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                        <p className="text-[10px] font-mono text-zinc-400 truncate flex-1">{shareUrl}</p>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400" onClick={copyToClipboard}>
                          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>

                      <div className="space-y-3 bg-muted p-4 rounded-2xl border border-border w-full overflow-hidden">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Pair with TV</label>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            id="tv-code"
                            placeholder="Enter 6-digit code"
                            className="bg-background/40 border border-border rounded-xl px-4 h-12 text-sm flex-1 text-foreground focus:outline-none focus:border-primary placeholder:text-zinc-600 text-center tracking-[0.2em] font-black"
                            maxLength={6}
                            onKeyUp={(e) => {
                              if (e.key === 'Enter') pairWithTV((e.target as HTMLInputElement).value);
                            }}
                          />
                          <Button
                            className="bg-white text-black hover:bg-zinc-200 rounded-xl h-12 px-6 font-black text-[11px] uppercase shrink-0"
                            onClick={() => pairWithTV((document.getElementById('tv-code') as HTMLInputElement).value)}
                          >
                            Pair
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          className="bg-[#25D366] hover:bg-[#128C7E] h-12 text-foreground rounded-xl font-black uppercase tracking-widest text-[9px]"
                          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Watch my security camera live: ' + shareUrl)}`, '_blank')}
                        >
                          WhatsApp
                        </Button>
                        <Button
                          className="bg-primary hover:bg-primary/90 h-12 text-foreground rounded-xl font-black uppercase tracking-widest text-[9px]"
                          onClick={() => window.open(`sms:?body=${encodeURIComponent('Watch my security camera live: ' + shareUrl)}`)}
                        >
                          SMS
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        className="w-full text-zinc-300 text-[10px] font-black uppercase hover:bg-transparent hover:text-foreground"
                        onClick={() => setShareUrl(null)}
                      >
                        New Link
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

        </div>

        {/* Slide-out Controls Drawer */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 z-50 flex items-center"
          onClick={e => e.stopPropagation()}
        >
          {/* Sliding Panel */}
          <AnimatePresence>
            {isDrawerOpen && (
              <motion.div
                key="drawer-panel"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="bg-background/85 backdrop-blur-2xl border border-border rounded-2xl p-2 flex flex-col gap-0.5 shadow-2xl w-52 max-h-[78vh] overflow-y-auto mr-1"
              >
                <DrawerSection label="View">
                  <div className="flex items-center justify-between px-2 py-1">
                    <button onClick={handleZoomOut} disabled={zoomLevel <= 1} className="h-8 w-8 rounded-xl bg-muted/50 text-foreground hover:bg-white/25 disabled:opacity-25 transition-all flex items-center justify-center font-bold text-lg">−</button>
                    <span className="text-xs font-black text-muted-foreground">{zoomLevel.toFixed(1)}×</span>
                    <button onClick={handleZoomIn} disabled={zoomLevel >= 4} className="h-8 w-8 rounded-xl bg-muted/50 text-foreground hover:bg-white/25 disabled:opacity-25 transition-all flex items-center justify-center font-bold text-lg">+</button>
                  </div>

                  {/* Hardware optical zoom slider */}
                  {hardwareZoomRange && (
                    <div className="px-2 py-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold text-primary/80 uppercase tracking-wider">📡 Optical Zoom</span>
                        <span className="text-[9px] font-black text-muted-foreground">{hwZoomValue.toFixed(1)}×</span>
                      </div>
                      <input
                        type="range"
                        min={hardwareZoomRange.min}
                        max={hardwareZoomRange.max}
                        step={hardwareZoomRange.step}
                        value={hwZoomValue}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setHwZoomValue(v);
                          sendData({ type: 'COMMAND', action: 'SET_ZOOM', value: v });
                        }}
                        className="w-full h-1.5 rounded-full accent-primary cursor-pointer"
                      />
                      <div className="flex justify-between">
                        <span className="text-[7px] text-foreground/25">{hardwareZoomRange.min}×</span>
                        <span className="text-[7px] text-foreground/25">{hardwareZoomRange.max}×</span>
                      </div>
                    </div>
                  )}

                  <DrawerBtn icon={<ScanSearch className="h-4 w-4" />} label="Super Zoom Capture" onClick={superZoomCapture} disabled={!isConnected && !remoteStream} />
                  <DrawerBtn icon={<Maximize className="h-4 w-4" />} label="Fullscreen" onClick={toggleFullscreen} />
                  <DrawerBtn icon={<Maximize2 className="h-4 w-4" />} label="Picture-in-Picture" onClick={togglePiP} />
                </DrawerSection>

                <DrawerSection label="Camera">
                  <DrawerBtn icon={isBridgeMode ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />} label={isBridgeMode ? "Mode: Screen Share" : "Mode: Camera"} active={isBridgeMode} activeClass="bg-blue-500/20 text-blue-300 border border-blue-400/30" onClick={() => sendCommand('SWITCH_SOURCE')} disabled={!isConnected} />
                  <DrawerBtn icon={isPowerSaveMode ? <BatteryMedium className="h-4 w-4 text-green-400" /> : <BatteryMedium className="h-4 w-4" />} label={isPowerSaveMode ? "Camera is Asleep" : "Sleep Camera"} active={isPowerSaveMode} activeClass="bg-green-500/20 text-green-400 border border-green-400/30" onClick={() => sendCommand('TOGGLE_POWER_SAVE')} disabled={!isConnected} />
                  <DrawerBtn icon={isFlashOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />} label="Flashlight" active={isFlashOn} activeClass="bg-yellow-400/20 text-yellow-300 border border-yellow-400/30" onClick={() => sendCommand('TOGGLE_FLASH')} disabled={!isConnected} />
                  <DrawerBtn icon={isNightVision ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} label="Night Mode" active={isNightVision} activeClass="bg-green-500/20 text-green-400 border border-green-400/30" onClick={() => sendCommand('TOGGLE_NIGHT_VISION')} disabled={!isConnected} />
                  <DrawerBtn icon={<Camera className="h-4 w-4" />} label="Take Snapshot" onClick={() => sendData({ type: 'COMMAND', action: 'TAKE_SNAPSHOT' })} disabled={!isConnected} />
                </DrawerSection>

                <DrawerSection label="Audio">
                  <DrawerBtn icon={muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} label={muted ? "Tap to Unmute" : "Mute Audio"} active={!muted} activeClass="bg-blue-500/20 text-blue-300 border border-blue-400/30" onClick={toggleMute} />
                  <DrawerBtn
                    icon={<Mic className={cn("h-4 w-4", isTalking && "animate-pulse")} />}
                    label={isTalking ? "Talking — release" : "Hold to Talk"}
                    active={isTalking}
                    activeClass="bg-red-500/20 text-red-400 border border-red-400/30"
                    onPointerDown={startTalking}
                    onPointerUp={stopTalking}
                    onPointerLeave={stopTalking}
                    disabled={!isConnected}
                  />
                </DrawerSection>

                <DrawerSection label="AI & Detection">
                  {(() => {
                    const quota = getAIQuotaStatus();
                    return quota.allExhausted ? (
                      <div className="mx-2 my-1 px-2 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-red-400" />
                        <span className="text-[9px] text-red-300 font-bold">AI quota reset {quota.retryIn}</span>
                      </div>
                    ) : quota.available !== "gemini" ? (
                      <div className="mx-2 my-1 px-2 py-1 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                        <span className="text-[8px] text-yellow-300">Using {quota.available?.toUpperCase()} (Gemini full)</span>
                      </div>
                    ) : null;
                  })()}
                  <DrawerBtn icon={<Brain className={cn("h-4 w-4", isAiActive && "animate-pulse")} />} label="AI Detection" active={isAiActive} activeClass="bg-purple-500/20 text-purple-400 border border-purple-400/30" onClick={() => sendCommand('TOGGLE_AI')} disabled={!isConnected} />
                  <DrawerBtn icon={<Thermometer className="h-4 w-4" />} label="Thermal View" active={isThermal} activeClass="bg-orange-500/20 text-orange-400 border border-orange-400/30" onClick={() => setIsThermal(!isThermal)} />
                  <DrawerBtn icon={<AlertTriangle className="h-4 w-4" />} label="Alarm" active={isSirenOn} activeClass="bg-red-500/20 text-red-400 border border-red-400/30 animate-pulse" onClick={() => sendCommand('TOGGLE_SIREN')} disabled={!isConnected} />
                </DrawerSection>

                <DrawerSection label="Connection" isLast>
                  <DrawerBtn icon={<RefreshCw className="h-4 w-4" />} label="Reconnect" onClick={repairConnection} />
                </DrawerSection>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pull Tab */}
          <button
            onClick={() => setIsDrawerOpen(p => !p)}
            className="h-32 w-9 bg-background/60 backdrop-blur-md border border-border border-r-0 rounded-l-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground/80 transition-all shadow-2xl"
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform duration-300", isDrawerOpen && "rotate-180")} />
            <span
              className="text-[8px] uppercase tracking-widest font-bold"
              style={{ writingMode: 'vertical-rl' }}
            >Controls</span>
          </button>
        </div>
      </div>

      {/* ── Super Zoom Overlay ── */}
      <AnimatePresence>
        {superZoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-background/80 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <ScanSearch className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-black text-foreground uppercase tracking-widest">Super Zoom Detail</span>
              </div>
              <button
                onClick={closeSuperZoom}
                className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/20 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sharpened image — fills screen */}
            <div className="flex-1 relative overflow-hidden">
              <img
                src={superZoom.image}
                alt="Super zoom capture"
                className="absolute inset-0 w-full h-full object-contain"
                style={{ imageRendering: "auto" }}
              />
              {/* Sharpening badge */}
              <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-primary/20 border border-primary/40 backdrop-blur-md">
                <span className="text-[9px] font-bold text-primary uppercase tracking-wider">
                  ✦ Unsharp mask applied
                </span>
              </div>
            </div>

            {/* AI Reading panel */}
            <div className="shrink-0 border-t border-border bg-background px-4 py-4 space-y-3">
              {/* Header section with voice readout button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">AI Visual Analysis</span>
                </div>
                {!superZoom.loading && superZoom.reading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const rawText = superZoom.reading || "";
                      const parseAI = (txt: string) => {
                        const clean = (s: string) => s.trim().replace(/^[:\-\s]+/, "").replace(/None\.?$/i, "None detected");
                        const idMatch = txt.match(/\[IDENTIFIERS\]:([\s\S]*?)(?=\[PEOPLE\]|\[VEHICLES\]|\[CONTEXT\]|$)/i);
                        const peopleMatch = txt.match(/\[PEOPLE\]:([\s\S]*?)(?=\[IDENTIFIERS\]|\[VEHICLES\]|\[CONTEXT\]|$)/i);
                        const vehicleMatch = txt.match(/\[VEHICLES\]:([\s\S]*?)(?=\[IDENTIFIERS\]|\[PEOPLE\]|\[CONTEXT\]|$)/i);
                        const contextMatch = txt.match(/\[CONTEXT\]:([\s\S]*?)(?=\[IDENTIFIERS\]|\[PEOPLE\]|\[VEHICLES\]|$)/i);
                        return {
                          all: txt.replace(/\[IDENTIFIERS\]:|\[PEOPLE\]:|\[VEHICLES\]:|\[CONTEXT\]:/gi, "").trim(),
                          identifiers: idMatch ? clean(idMatch[1]) : "",
                          people: peopleMatch ? clean(peopleMatch[1]) : "",
                          vehicles: vehicleMatch ? clean(vehicleMatch[1]) : "",
                          context: contextMatch ? clean(contextMatch[1]) : ""
                        };
                      };
                      const parsed = parseAI(rawText);
                      const speakVal = superZoomTab === "all" ? parsed.all : (parsed[superZoomTab] || "None detected");
                      speakText(speakVal);
                    }}
                    className={cn(
                      "h-7 px-2.5 rounded-lg border border-border text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                      isSpeaking ? "bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse" : "bg-muted/30 hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    {isSpeaking ? "Mute" : "Listen"}
                  </Button>
                )}
              </div>

              {superZoom.loading ? (
                <div className="flex items-center gap-3 py-2">
                  <div className="h-4 w-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin shrink-0" />
                  <p className="text-xs text-muted-foreground italic">Analyzing what's visible in this frame…</p>
                </div>
              ) : (
                <>
                  {/* Category Filter Tabs - scrollable horizontally on mobile, saving space */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none shrink-0">
                    {[
                      { id: "all", label: "All", emoji: "👁️" },
                      { id: "identifiers", label: "Text/Plates", emoji: "📌" },
                      { id: "people", label: "People", emoji: "👥" },
                      { id: "vehicles", label: "Vehicles", emoji: "🚗" },
                      { id: "context", label: "Context", emoji: "📍" },
                    ].map((tab) => {
                      const isActive = superZoomTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setSuperZoomTab(tab.id as any);
                            if (isSpeaking && 'speechSynthesis' in window) {
                              window.speechSynthesis.cancel();
                              setIsSpeaking(false);
                            }
                          }}
                          className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border",
                            isActive
                              ? "bg-purple-500/10 border-purple-500/35 text-purple-300 shadow-sm"
                              : "bg-muted/20 border-border/40 text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          {tab.emoji} {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dynamic description box - Capped/Compact scrollable content area */}
                  <div className="bg-muted/30 border border-border/40 rounded-xl p-3 max-h-32 overflow-y-auto">
                    {(() => {
                      const rawText = superZoom.reading || "";
                      const parseAI = (txt: string) => {
                        const clean = (s: string) => s.trim().replace(/^[:\-\s]+/, "").replace(/None\.?$/i, "");
                        const idMatch = txt.match(/\[IDENTIFIERS\]:([\s\S]*?)(?=\[PEOPLE\]|\[VEHICLES\]|\[CONTEXT\]|$)/i);
                        const peopleMatch = txt.match(/\[PEOPLE\]:([\s\S]*?)(?=\[IDENTIFIERS\]|\[VEHICLES\]|\[CONTEXT\]|$)/i);
                        const vehicleMatch = txt.match(/\[VEHICLES\]:([\s\S]*?)(?=\[IDENTIFIERS\]|\[PEOPLE\]|\[CONTEXT\]|$)/i);
                        const contextMatch = txt.match(/\[CONTEXT\]:([\s\S]*?)(?=\[IDENTIFIERS\]|\[PEOPLE\]|\[VEHICLES\]|$)/i);
                        return {
                          all: txt.replace(/\[IDENTIFIERS\]:|\[PEOPLE\]:|\[VEHICLES\]:|\[CONTEXT\]:/gi, "").trim(),
                          identifiers: idMatch ? clean(idMatch[1]) : "",
                          people: peopleMatch ? clean(peopleMatch[1]) : "",
                          vehicles: vehicleMatch ? clean(vehicleMatch[1]) : "",
                          context: contextMatch ? clean(contextMatch[1]) : ""
                        };
                      };

                      const parsed = parseAI(rawText);
                      // For "all" tab, strip bare None. lines so only real content shows
                      const allCleaned = parsed.all
                        .split(/(?<=[.!?])\s+/)
                        .map(s => s.trim())
                        .filter(s => s && !/^none\.?$/i.test(s))
                        .join(" ");
                      const currentVal = superZoomTab === "all" ? allCleaned : parsed[superZoomTab];

                      if (!currentVal || currentVal.toLowerCase() === "none" || currentVal.trim() === "") {
                        return (
                          <div className="flex flex-col items-center justify-center py-4 text-center">
                            <span className="text-[14px]">📭</span>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">No indicators found</p>
                            <p className="text-[8px] text-muted-foreground/60 uppercase">AI registered no elements for this category.</p>
                          </div>
                        );
                      }

                      if (superZoomTab === "identifiers") {
                        return (
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase text-purple-400 tracking-wider">Detected Text/Characters:</span>
                            <p className="text-sm text-foreground font-black tracking-wide font-mono bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                              {currentVal}
                            </p>
                          </div>
                        );
                      }

                      // Split into individual sentences for readability
                      const sentences = currentVal
                        .split(/(?<=[.!?])\s+/)
                        .map(s => s.trim())
                        .filter(Boolean);
                      return (
                        <div className="space-y-1.5">
                          {sentences.map((sentence, i) => (
                            <p key={i} className="text-[12px] leading-relaxed text-foreground/90 font-medium">
                              {sentence}
                            </p>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* Action trigger footer buttons */}
              <div className="pt-1 flex gap-2">
                <Button
                  onClick={superZoomCapture}
                  className="flex-1 h-9 rounded-xl bg-primary text-black hover:bg-primary/90 text-[10px] font-bold uppercase tracking-wider"
                >
                  <ScanSearch className="h-3.5 w-3.5 mr-1.5" /> Capture Again
                </Button>
                <Button
                  onClick={closeSuperZoom}
                  variant="outline"
                  className="flex-1 h-9 rounded-xl border-border text-[10px] font-bold uppercase tracking-wider"
                >
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default LiveFeed;
