import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wifi, WifiOff, Volume2, VolumeX, Camera, Maximize, RefreshCw } from "lucide-react";
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

  const handleRemoteStream = useCallback((stream: MediaStream) => {
    setRemoteStream(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  }, []);

  const { connectionState, isConnected, isChannelReady, connect, disconnect } = useWebRTC({
    deviceId: deviceId || "",
    role: "viewer",
    onRemoteStream: handleRemoteStream,
  });

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

  const [zoomLevel, setZoomLevel] = useState(1);
  const [isHD, setIsHD] = useState(true);
  const [isTalking, setIsTalking] = useState(false);

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
  const toggleHD = () => setIsHD(!isHD);

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
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden transition-transform duration-300 ease-out" style={{ transform: `scale(${zoomLevel})` }}>
            <video
              ref={remoteVideoRef}
              className="h-full w-full object-contain"
              autoPlay
              playsInline
              muted={muted}
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
                <p className="text-sm text-muted-foreground">Connecting to {device?.name}...</p>
                <p className="text-xs text-muted-foreground/50">Establishing secure peer connection</p>
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

        {/* Top bar (Glassmorphism) */}
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
                <span className="text-sm font-semibold tracking-wide text-white uppercase">{connectionLabel}</span>
              </>
            ) : isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-semibold tracking-wide text-white uppercase">{connectionLabel}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-white/50" />
                <span className="text-sm font-medium text-white/50 uppercase tracking-wide">Offline</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleHD}
              className={`rounded-full shadow-lg backdrop-blur-md border-white/10 transition-all ${isHD ? 'bg-primary/20 text-primary border-primary/30 glow-primary' : 'bg-black/40 text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              HD
            </Button>
          </div>
        </div>

        {/* Right side floating controls (Zoom/Tools) */}
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

      {/* Bottom Controls */}
      {isOnline && (
        <div className="relative z-40 flex items-end justify-center pb-8 pt-24 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="flex items-center justify-center gap-8 bg-black/40 border border-white/10 px-8 py-4 rounded-full backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="h-14 w-14 rounded-full text-white hover:bg-white/10 hover:scale-105 transition-all">
              {muted ? <VolumeX className="h-6 w-6 opacity-60" /> : <Volume2 className="h-6 w-6 text-primary glow-primary" />}
            </Button>

            {/* Hold to Speak Button */}
            <div className="flex flex-col items-center -mt-8">
              <Button
                size="icon"
                className={`h-20 w-20 rounded-full transition-all duration-300 shadow-2xl ${isTalking ? 'bg-primary scale-95 shadow-[0_0_30px_hsl(var(--primary)/0.6)]' : 'bg-primary/90 hover:bg-primary hover:scale-105'}`}
                onMouseDown={async () => {
                  setIsTalking(true);
                  if (typeof (window as any).startTwoWayAudio === "function") {
                    await (window as any).startTwoWayAudio();
                  }
                }}
                onMouseUp={() => {
                  setIsTalking(false);
                  if (typeof (window as any).stopTwoWayAudio === "function") {
                    (window as any).stopTwoWayAudio();
                  }
                }}
                onMouseLeave={() => {
                  if (isTalking) {
                    setIsTalking(false);
                    if (typeof (window as any).stopTwoWayAudio === "function") {
                      (window as any).stopTwoWayAudio();
                    }
                  }
                }}
                onTouchStart={async (e) => {
                  e.preventDefault(); // prevent mouse emulation
                  setIsTalking(true);
                  if (typeof (window as any).startTwoWayAudio === "function") {
                    await (window as any).startTwoWayAudio();
                  }
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setIsTalking(false);
                  if (typeof (window as any).stopTwoWayAudio === "function") {
                    (window as any).stopTwoWayAudio();
                  }
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isTalking ? 'animate-pulse' : ''}>
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </Button>
              <span className="text-[10px] font-medium text-white/60 tracking-widest uppercase mt-3">Hold to Speak</span>
            </div>

            <Button variant="ghost" size="icon" className="h-14 w-14 rounded-full text-white hover:bg-white/10 hover:scale-105 transition-all relative overflow-hidden group">
              <Camera className="h-6 w-6 group-hover:text-primary transition-colors" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveFeed;
