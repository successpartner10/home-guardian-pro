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

  const { connectionState, isConnected, connect, disconnect } = useWebRTC({
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
    if (isOnline && connectionState === "new") {
      connect();
    }
  }, [device?.status, connectionState, connect]);

  // Attach stream to video element when ref is ready
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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
    <div className="relative flex min-h-screen flex-col bg-black">
      {/* Video area */}
      <div className="relative flex-1">
        {isConnected && remoteStream ? (
          <video
            ref={remoteVideoRef}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            muted={muted}
          />
        ) : isOnline ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-3">
              {connectionState === "failed" ? (
                <>
                  <p className="text-sm text-destructive font-medium">Connection failed</p>
                  <Button onClick={() => { disconnect(); setTimeout(connect, 500); }} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Retry
                  </Button>
                </>
              ) : (
                <>
                  <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">Connecting to {device?.name}...</p>
                  <p className="text-xs text-muted-foreground/60">Establishing peer connection</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-3">
              <WifiOff className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">{device?.name}</p>
              <p className="text-sm text-muted-foreground">Camera is offline</p>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4">
          <button onClick={() => navigate("/dashboard")} className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50 backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2 rounded-full bg-background/50 px-3 py-1.5 backdrop-blur-sm">
            {isConnected ? (
              <>
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-medium text-foreground">{connectionLabel}</span>
              </>
            ) : isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-foreground">{connectionLabel}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Offline</span>
              </>
            )}
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Controls */}
      {isOnline && (
        <div className="flex items-center justify-center gap-6 bg-background/80 p-6 backdrop-blur-sm">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="h-14 w-14 rounded-full">
            {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </Button>
          <Button size="icon" className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90">
            <Camera className="h-7 w-7" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-14 w-14 rounded-full">
            <Maximize className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default LiveFeed;
