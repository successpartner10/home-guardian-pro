import React, { useEffect, useRef, useState, useCallback } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Wifi, WifiOff, Maximize, RefreshCw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Device = Tables<"devices">;

interface LiveCameraStreamProps {
    device: Device;
    onFullscreen?: (deviceId: string) => void;
}

export const LiveCameraStream: React.FC<LiveCameraStreamProps> = ({ device, onFullscreen }) => {
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const handleRemoteStream = useCallback((stream: MediaStream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
        }
    }, []);

    const { connectionState, isConnected, isChannelReady, connect, disconnect } = useWebRTC({
        deviceId: device.id,
        role: "viewer",
        onRemoteStream: handleRemoteStream,
    });

    // Auto-connect when device is online
    useEffect(() => {
        const isOnline = device.status === "online" || device.status === "recording";
        if (isOnline && connectionState === "new" && isChannelReady) {
            connect();
        }
    }, [device.status, connectionState, connect, isChannelReady]);

    // Attach stream to video element when ref is ready
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, isConnected]);

    const isOnline = device.status === "online" || device.status === "recording";

    const handleFullscreenInternal = () => {
        if (onFullscreen) {
            onFullscreen(device.id);
        } else if (containerRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                containerRef.current.requestFullscreen();
            }
        }
    };

    const connectionLabel = {
        new: "Waiting...",
        connecting: "Connecting...",
        connected: "Live",
        disconnected: "Disconnected",
        failed: "Connection failed",
        closed: "Closed",
    }[connectionState] || connectionState;

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black rounded-[1.8rem] overflow-hidden border-2 border-border/10 group shadow-xl">
            {/* Video Area */}
            {isConnected && remoteStream ? (
                <video
                    ref={remoteVideoRef}
                    className="h-full w-full object-cover"
                    autoPlay
                    playsInline
                    muted // Default to true in grid to avoid audio feedback loops
                />
            ) : isOnline ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/10 z-10 backdrop-blur-sm">
                    {connectionState === "failed" ? (
                        <div className="flex flex-col items-center">
                            <p className="text-xs text-destructive font-medium mb-2">Connection failed</p>
                            <Button onClick={() => { disconnect(); setTimeout(connect, 500); }} variant="outline" size="sm" className="gap-2 bg-background/50 h-8 text-[10px] uppercase font-bold tracking-widest">
                                <RefreshCw className="h-3 w-3" /> Retry
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Connecting</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/10 z-10">
                    <WifiOff className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Offline</p>
                </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

            {/* Top Bar Overlay */}
            <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start z-20">
                <h3 className="text-sm font-black text-white uppercase tracking-tighter truncate max-w-[60%] drop-shadow-md">
                    {device.name}
                </h3>

                <div className="flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-2 py-1 backdrop-blur-md shadow-lg">
                    {isConnected ? (
                        <>
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span className="text-[8px] font-black tracking-widest text-white uppercase">{connectionLabel}</span>
                        </>
                    ) : isOnline ? (
                        <>
                            <Wifi className="h-2.5 w-2.5 text-primary animate-pulse" />
                            <span className="text-[8px] font-black tracking-widest text-white uppercase">{connectionLabel}</span>
                        </>
                    ) : (
                        <>
                            <WifiOff className="h-2.5 w-2.5 text-white/50" />
                            <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest">Offline</span>
                        </>
                    )}
                </div>
            </div>

            {/* Controls Overlay (Hover visible) */}
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFullscreenInternal}
                    className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-xl"
                >
                    <Maximize2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};
