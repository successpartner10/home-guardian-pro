import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wifi, WifiOff, Volume2, VolumeX, Camera, Maximize, RefreshCw, Box, Flashlight, AlertTriangle, Users, RotateCw, ChevronRight, Share2, Copy, Check } from "lucide-react";
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
import { RadarOverlay, BoundingBoxesOverlay, filterObjects, type CategoryId, DETECTION_CATEGORIES } from "@/components/AIOverlays";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Device = Tables<"devices">;

const LiveFeed = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCenter, setZoomCenter] = useState({ x: 50, y: 50 });
  const [activeCategories, setActiveCategories] = useState<Set<CategoryId>>(new Set(["all"]));
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isSirenOn, setIsSirenOn] = useState(false);
  const { toast } = useToast();

  const toggleCategory = (catId: CategoryId) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (catId === "all") return new Set(["all"]);
      next.delete("all");
      if (next.has(catId)) {
        next.delete(catId);
        if (next.size === 0) return new Set(["all"]);
      } else {
        next.add(catId);
        const specificCats = DETECTION_CATEGORIES.filter(c => c.id !== "all");
        if (specificCats.every(c => next.has(c.id))) return new Set(["all"]);
      }
      return next;
    });
  };

  const handleRemoteStream = useCallback((stream: MediaStream) => {
    setRemoteStream(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  }, []);

  const handleDataMessage = useCallback((data: any) => {
    if (data.type === "TELEMETRY" && data.data) {
      const telemetry = data.data;
      if (telemetry.detectedObjects) setDetectedObjects(telemetry.detectedObjects);
      if (telemetry.zoomLevel) setZoomLevel(telemetry.zoomLevel);
      if (telemetry.zoomCenter) setZoomCenter(telemetry.zoomCenter);
      if (telemetry.isFlashOn !== undefined) setIsFlashOn(telemetry.isFlashOn);
      if (telemetry.isSirenOn !== undefined) setIsSirenOn(telemetry.isSirenOn);
    }
  }, []);

  const { connectionState, isConnected, isChannelReady, connect, disconnect, sendData } = useWebRTC({
    deviceId: deviceId || "",
    role: "viewer",
    onRemoteStream: handleRemoteStream,
    onDataMessage: handleDataMessage,
  });

  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateShareLink = async (durationMinutes: number) => {
    setShareLoading(true);
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

    const currentSettings = (device?.settings as any) || {};

    const { error } = await supabase
      .from("devices")
      .update({
        settings: {
          ...currentSettings,
          share_token: token,
          share_expires_at: expiresAt
        }
      })
      .eq("id", deviceId);

    if (error) {
      toast({ title: "Error", description: "Failed to generate share link", variant: "destructive" });
    } else {
      const url = `${window.location.origin}/shared/${token}`;
      setShareUrl(url);
    }
    setShareLoading(false);
  };

  const pairWithTV = async (code: string) => {
    if (!shareUrl) {
      toast({ title: "Generate Link First", description: "You need a share link before pairing.", variant: "destructive" });
      return;
    }
    const token = shareUrl.split("/").pop();
    const channel = supabase.channel(`pairing:${code.toUpperCase()}`);
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event: 'pair',
          payload: { token }
        });
        toast({ title: "Pairing Sent!", description: "Check your TV screen." });
        supabase.removeChannel(channel);
      }
    });
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

    const fetchDevice = async () => {
      const { data } = await supabase.from("devices").select("*").eq("id", deviceId).single();
      if (data) setDevice(data);
      setLoading(false);
    };
    fetchDevice();

    const channel = supabase
      .channel(`device-${deviceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "devices", filter: `id=eq.${deviceId}` }, (payload) => {
        setDevice(payload.new as Device);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [deviceId]);

  // Auto-connect when device is online
  useEffect(() => {
    const isOnline = device?.status === "online" || device?.status === "recording";
    if (isOnline && connectionState === "new" && isChannelReady) {
      connect();
    }
  }, [device?.status, connectionState, connect, isChannelReady]);

  // Attach stream to video element when ref is ready
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
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
    <div className="relative flex min-h-screen flex-col bg-black overflow-hidden">
      {/* Video area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {isConnected && remoteStream ? (
          <div
            className="relative w-full h-full flex items-center justify-center overflow-hidden transition-transform duration-700 ease-out"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`
            }}
          >
            <video
              ref={remoteVideoRef}
              className="h-full w-full object-contain"
              autoPlay
              playsInline
              muted={muted}
            />

            {/* AI Overlays */}
            <div className="absolute inset-0 pointer-events-none scale-[0.6] opacity-30">
              <RadarOverlay
                detectedObjects={detectedObjects}
                videoWidth={remoteVideoRef.current?.videoWidth || 640}
                videoHeight={remoteVideoRef.current?.videoHeight || 480}
              />
            </div>

            <BoundingBoxesOverlay
              detectedObjects={detectedObjects}
              filteredObjects={filterObjects(detectedObjects, activeCategories)}
              activeCategories={activeCategories}
            />
          </div>
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
          <button onClick={() => navigate("/dashboard")} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-colors shadow-lg">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>

          <div className="flex items-center gap-3 rounded-full bg-black/40 border border-white/10 px-4 py-2 backdrop-blur-md shadow-2xl">
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
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Access Duration</label>
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
                        className="w-full text-zinc-600 text-[10px] font-black uppercase hover:bg-transparent hover:text-white"
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

          {/* AI Category Pills */}
          <div className="absolute top-[88px] left-0 right-0 px-4 flex justify-end pointer-events-none">
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap justify-end gap-1.5 p-1.5 rounded-[2rem] bg-black/40 backdrop-blur-xl border border-white/5 pointer-events-auto max-w-[280px] sm:max-w-none"
              >
                {DETECTION_CATEGORIES.map(cat => {
                  const isActive = activeCategories.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-200",
                        isActive ? "text-white" : "text-white/40 hover:text-white/70"
                      )}
                      style={isActive ? { backgroundColor: cat.color + '40', border: `1px solid ${cat.color}` } : {}}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
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
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 shadow-2xl mt-2">
              <Maximize className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="relative z-40 flex items-end justify-center pb-8 pt-20 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="flex items-center justify-center gap-6 sm:gap-10 bg-black/40 border border-white/10 px-8 py-5 rounded-full backdrop-blur-2xl shadow-2xl">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="h-14 w-14 rounded-full text-white hover:bg-white/10 transition-all">
            {muted ? <VolumeX className="h-6 w-6 opacity-60" /> : <Volume2 className="h-6 w-6 text-primary" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              sendData({ type: 'COMMAND', action: 'TOGGLE_FLASH' });
              toast({
                title: isFlashOn ? "Flash OFF" : "Flash ON",
                description: isFlashOn ? "Turning off camera flash..." : "Turning on camera flash..."
              });
            }}
            className={cn(
              "h-14 w-14 rounded-full transition-all border-2",
              isFlashOn ? "bg-yellow-400 text-black border-yellow-200 shadow-[0_0_25px_rgba(250,204,21,0.5)]" : "bg-white/10 text-white border-transparent hover:bg-white/20"
            )}
          >
            <Flashlight className="h-6 w-6" />
          </Button>

          {/* Siren with Confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-14 w-14 rounded-full transition-all border-2",
                  isSirenOn ? "bg-destructive text-white border-red-400 animate-pulse shadow-[0_0_25px_rgba(220,38,38,0.5)]" : "bg-white/10 text-white border-transparent hover:bg-destructive hover:text-white"
                )}
              >
                <AlertTriangle className="h-6 w-6" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-[2.5rem] max-w-[340px] w-[90vw]">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">
                  {isSirenOn ? "Deactivate Siren?" : "Trigger Siren?"}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400 font-medium">
                  {isSirenOn
                    ? "Stop the loud alarm on the camera device."
                    : "This will activate a loud alarm on the camera device to deter intruders."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-8 flex flex-col gap-3">
                <AlertDialogAction
                  onClick={() => {
                    sendData({ type: 'COMMAND', action: 'TOGGLE_SIREN' });
                  }}
                  className={cn(
                    "w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-xs",
                    isSirenOn ? "bg-white text-black hover:bg-zinc-200" : "bg-destructive hover:bg-destructive/90 text-white"
                  )}
                >
                  {isSirenOn ? "Stop Alarm" : "Activate"}
                </AlertDialogAction>
                <AlertDialogCancel className="w-full bg-transparent border-none text-zinc-500 hover:text-white hover:bg-transparent font-black uppercase tracking-widest text-[10px]">
                  Cancel
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="ghost" size="icon" className="h-14 w-14 rounded-full text-white hover:bg-white/10 transition-all">
            <Camera className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LiveFeed;
