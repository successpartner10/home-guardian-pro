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
  serverTimestamp
} from "firebase/firestore";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wifi, WifiOff, Volume2, VolumeX, Camera, Maximize, RefreshCw, Box, Flashlight, FlashlightOff, AlertTriangle, Users, RotateCw, ChevronRight, Share2, Copy, Check, Maximize2, Moon, Sun, Mic, Brain } from "lucide-react";
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
import { Logo } from "@/components/Logo";
import { AIOverlays } from "@/components/AIOverlays";

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

  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCenter, setZoomCenter] = useState({ x: 50, y: 50 });
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isSirenOn, setIsSirenOn] = useState(false);
  const [isNightVision, setIsNightVision] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
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
      
      // TELEMETRY from camera overrides our optimistic state (truth from camera)
      if (d.isFlashOn !== undefined) setIsFlashOn(d.isFlashOn);
      if (d.isSirenOn !== undefined) setIsSirenOn(d.isSirenOn);
      if (d.isNightVision !== undefined) setIsNightVision(d.isNightVision);
      if (d.isAiActive !== undefined) setIsAiActive(d.isAiActive);
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
    }).catch((err) => {
      console.error("LiveFeed fetch error:", err);
      setLoading(false);
    });

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

    return () => unsubscribe();
  }, [deviceId]);

  const handleRename = async () => {
    const newName = prompt("Enter new camera name:", device?.name);
    if (newName && newName !== device?.name && deviceId) {
      await updateDoc(doc(db, "devices", deviceId), { name: newName });
    }
  };

  // Auto-connect: wait for both device online + signaling channel ready
  useEffect(() => {
    const isOnline = device?.status === "online" || device?.status === "recording";
    if (isOnline && isChannelReady && (connectionState === "new" || connectionState === "closed")) {
      const timer = setTimeout(() => connect(), 300);
      return () => clearTimeout(timer);
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
            .then(() => console.log("[LiveFeed] Remote video playback started."))
            .catch(e => {
              console.warn("[LiveFeed] Remote play failed, retrying...", e);
              setTimeout(() => video.play().catch(p => console.error("[LiveFeed] Final remote play failed:", p)), 1000);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isOnline = device?.status === "online" || device?.status === "recording";

  const connectionLabel = {
    new: "Waiting...",
    connecting: "Connecting...",
    connected: "Live",
    disconnected: "Disconnected",
    failed: "Connection failed",
    closed: "Closed",
  }[connectionState] || connectionState;

  return (
    <div className="relative flex min-h-screen flex-col bg-black overflow-hidden" onClick={handlePlayRequest}>
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
                  isNightVision ? "contrast-[1.2] brightness-[1.8] sepia-[1] hue-rotate-[70deg] saturate-[2]" : "",
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
                <AIOverlays isMonitoring={true} analysis={aiAnalysis} />
              ) : isAiActive ? (
                <div className="absolute top-24 inset-x-4 z-40 max-w-2xl mx-auto" style={{ transform: `scale(${1/zoomLevel})` }}>
                  <div className="mx-auto w-fit bg-black/80 backdrop-blur-3xl border border-purple-500/30 px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(168,85,247,0.3)] animate-pulse">
                    <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs uppercase tracking-widest font-bold text-purple-300">AI Scanning Area...</span>
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
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); handlePlayRequest(); }}
                    >
                        <div className="h-20 w-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-2xl shadow-2xl animate-pulse">
                            <Maximize2 className="h-8 w-8 text-white" />
                        </div>
                        <span className="absolute bottom-32 text-[10px] font-bold text-white/50 uppercase tracking-[0.4em]">Tap To View Stream</span>
                    </motion.div>
                )}
            </AnimatePresence>
          </>
        ) : isOnline ? (
          <div className="flex h-full items-center justify-center w-full absolute inset-0 text-center space-y-3 z-10">
            {connectionState === "failed" ? (
              <div className="flex flex-col items-center">
                <p className="text-sm text-destructive font-medium mb-2">Connection failed</p>
                <Button onClick={() => { disconnect(); setTimeout(connect, 500); }} variant="outline" className="gap-2 bg-background/50 backdrop-blur-md border-border/50">
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
                <p className="text-sm text-muted-foreground">Connecting... {connectionLabel}</p>
                <span className="text-[10px] uppercase tracking-widest text-white/30">{device?.name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center w-full absolute inset-0 z-10">
            <div className="text-center space-y-3 bg-card/10 p-8 rounded-3xl backdrop-blur-md border border-white/5">
              <WifiOff className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-xl font-medium text-foreground tracking-tight">{device?.name}</p>
              <p className="text-sm text-muted-foreground">Camera is offline</p>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4 z-40 bg-gradient-to-b from-black/80 to-transparent pt-6 pb-12">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-colors shadow-lg">
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <Link to="/dashboard">
              <Logo size="sm" className="h-8 opacity-90 drop-shadow-2xl" />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {device && (
              <div className="flex flex-col items-end gap-1 px-4 py-2 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleRename}
                    className="text-[10px] font-black text-white/60 hover:text-white uppercase tracking-widest transition-colors"
                  >
                    {device.name || "Camera"}
                  </button>
                  <div className="h-1 w-1 rounded-full bg-white/20" />
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    (device as any).is_charging ? "text-green-400" : (device as any).battery_level < 20 ? "text-red-500" : "text-white/60"
                  )}>
                    {(device as any).battery_level ?? 100}% {(device as any).is_charging ? "Charging" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">
                    {(device as any).unread_alerts || 0} New Alerts
                  </span>
                  <span className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">
                    {(device as any).total_clips || 0} Clips
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 rounded-full bg-black/40 border border-white/10 px-4 py-2 backdrop-blur-md shadow-2xl h-10">
              {isConnected ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                  <span className="text-sm font-semibold tracking-wide text-white uppercase leading-none">Live</span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="text-sm font-medium text-white/50 uppercase tracking-widest leading-none">{connectionLabel}</span>
                </div>
              )}
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-colors shadow-lg">
                <Share2 className="h-5 w-5 text-white" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-3xl max-w-[380px] w-[95vw] max-h-[90vh] overflow-y-auto custom-scrollbar overflow-x-hidden">
              <DialogHeader className="sticky top-0 bg-zinc-950 z-10 pb-4">
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
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 rounded-xl text-white h-12">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
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

                      <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10 w-full overflow-hidden">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Pair with TV</label>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            id="tv-code"
                            placeholder="Enter 6-digit code"
                            className="bg-black/40 border border-white/10 rounded-xl px-4 h-12 text-sm flex-1 text-white focus:outline-none focus:border-primary placeholder:text-zinc-600 text-center tracking-[0.2em] font-black"
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
                          className="bg-[#25D366] hover:bg-[#128C7E] h-12 text-white rounded-xl font-black uppercase tracking-widest text-[9px]"
                          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Watch my security camera live: ' + shareUrl)}`, '_blank')}
                        >
                          WhatsApp
                        </Button>
                        <Button
                          className="bg-primary hover:bg-primary/90 h-12 text-white rounded-xl font-black uppercase tracking-widest text-[9px]"
                          onClick={() => window.open(`sms:?body=${encodeURIComponent('Watch my security camera live: ' + shareUrl)}`)}
                        >
                          SMS
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        className="w-full text-zinc-300 text-[10px] font-black uppercase hover:bg-transparent hover:text-white"
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

        {/* Zoom Controls */}
        {isConnected && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40">
            <div className="flex flex-col items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1.5 shadow-2xl">
              <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoomLevel >= 4} className="h-10 w-10 rounded-full text-white hover:bg-white/20 disabled:opacity-30">
                <span className="text-xl leading-none">+</span>
              </Button>
              <span className="text-[10px] font-bold text-white/70 py-1">{zoomLevel.toFixed(1)}x</span>
              <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoomLevel <= 1} className="h-10 w-10 rounded-full text-white hover:bg-white/20 disabled:opacity-30">
                <span className="text-xl leading-none">-</span>
              </Button>
            </div>
            <div className="flex flex-col items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-1.5 shadow-2xl mt-2">
              <Button variant="ghost" size="icon" onClick={togglePiP} className="h-10 w-10 rounded-full text-white hover:bg-white/20">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            <Button
            variant="ghost"
            size="icon"
            onPointerDown={startTalking}
            onPointerUp={stopTalking}
            onPointerLeave={stopTalking}
            className={cn(
              "h-16 w-16 rounded-full transition-all border-2",
              isTalking ? "bg-primary text-black border-primary scale-110 shadow-[0_0_30px_rgba(var(--primary),0.6)]" : "bg-black/60 border-white/20 text-white hover:bg-white/10"
            )}
          >
            <Mic className={cn("h-6 w-6", isTalking ? "animate-pulse" : "")} />
          </Button>

          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 shadow-2xl mt-2">
              <Maximize className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Action Bar: Responsive 3x2 Grid on Mobile, 6-col on Laptop */}
      <div className="relative z-40 flex items-end justify-center pb-8 pt-20 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="bg-black/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-3 shadow-2xl max-w-lg w-full mx-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <ControlBtn
              icon={<Brain className={cn("h-5 w-5", isAiActive && "animate-pulse")} />}
              label="AI"
              active={isAiActive}
              activeClass="bg-purple-500/10 text-purple-400 border-purple-400/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
              onClick={() => sendCommand('TOGGLE_AI')}
              disabled={!isConnected}
            />

            <ControlBtn
              icon={<Mic className={cn("h-5 w-5", isTalking && "animate-pulse")} />}
              label="Talk"
              active={isTalking}
              activeClass="bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              onPointerDown={startTalking}
              onPointerUp={stopTalking}
              onPointerLeave={stopTalking}
              disabled={!isConnected}
              isTouch
            />

            <ControlBtn
              icon={isFlashOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
              label="Light"
              active={isFlashOn}
              activeClass="bg-yellow-400 text-black border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.3)]"
              onClick={() => sendCommand('TOGGLE_FLASH')}
              disabled={!isConnected}
            />

            <ControlBtn
              icon={isNightVision ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              label="Night"
              active={isNightVision}
              activeClass="bg-green-500/10 text-green-400 border-green-400/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
              onClick={() => sendCommand('TOGGLE_NIGHT_VISION')}
              disabled={!isConnected}
            />

            <ControlBtn
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Alarm"
              active={isSirenOn}
              activeClass="bg-red-500 text-white border-red-400 animate-pulse shadow-[0_0_25px_rgba(220,38,38,0.5)]"
              onClick={() => sendCommand('TOGGLE_SIREN')}
              disabled={!isConnected}
            />

            <ControlBtn
              icon={<Camera className="h-5 w-5" />}
              label="Snap"
              active={false}
              onClick={() => sendData({ type: 'COMMAND', action: 'TAKE_SNAPSHOT' })}
              disabled={!isConnected}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ControlBtn = ({ 
  icon, 
  label, 
  active, 
  activeClass, 
  onClick, 
  onPointerDown, 
  onPointerUp, 
  onPointerLeave, 
  disabled, 
  isTouch = false 
}: any) => (
  <button
      onClick={(e) => { e.stopPropagation(); !isTouch && onClick && onClick(); }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      disabled={disabled}
      className={cn(
          "cam-ctrl-btn",
          active ? activeClass : "cam-ctrl-btn-off"
      )}
  >
      {icon}
      <span className="text-[9px] font-bold text-inherit uppercase">{label}</span>
  </button>
);

export default LiveFeed;
