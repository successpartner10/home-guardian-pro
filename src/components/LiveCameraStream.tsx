import React, { useEffect, useRef, useState, useCallback } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Wifi, WifiOff, Maximize, RefreshCw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { RadarOverlay, BoundingBoxesOverlay, type CategoryId } from "@/components/AIOverlays";

type Device = Tables<"devices">;

interface LiveCameraStreamProps {
    device: Device;
    onFullscreen?: (deviceId: string) => void;
    localStream?: MediaStream | null;
}

export const LiveCameraStream: React.FC<LiveCameraStreamProps> = ({ device, onFullscreen, localStream }) => {
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    // AI Telemetry State
    const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [zoomCenter, setZoomCenter] = useState({ x: 50, y: 50 });
    const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
    const [activeCategories] = useState<Set<CategoryId>>(new Set(["all"]));

    const handleRemoteStream = useCallback((stream: MediaStream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
        }
    }, []);

    const handleDataMessage = useCallback((msg: any) => {
        if (msg.type === 'TELEMETRY') {
            setDetectedObjects(msg.detectedObjects || []);
            setZoomLevel(msg.zoomLevel || 1);
            setZoomCenter(msg.zoomCenter || { x: 50, y: 50 });
            if (msg.videoWidth && msg.videoHeight) {
                setVideoDimensions({ width: msg.videoWidth, height: msg.videoHeight });
            }
        }
    }, []);

    const { connectionState, isConnected, isChannelReady, connect, disconnect } = useWebRTC({
        deviceId: device.id,
        role: "viewer",
        localStream: localStream,
        onRemoteStream: handleRemoteStream,
        onDataMessage: handleDataMessage,
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
                <>
                    <video
                        ref={remoteVideoRef}
                        className="absolute inset-0 h-full w-full object-cover transition-all duration-300"
                        style={{ transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`, transform: `scale(${zoomLevel})` }}
                        autoPlay
                        playsInline
                        muted // Default to true in grid to avoid audio feedback loops
                    />
                    {/* Telemetry Overlays */}
                    {detectedObjects.length > 0 && (
                        <>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-150 opacity-20 hidden group-hover:block">
                                <RadarOverlay
                                    detectedObjects={detectedObjects}
                                    videoWidth={videoDimensions.width}
                                    videoHeight={videoDimensions.height}
                                />
                            </div>
                            <BoundingBoxesOverlay
                                detectedObjects={detectedObjects}
                                filteredObjects={detectedObjects}
                                activeCategories={activeCategories}
                            />
                        </>
                    )}
                </>
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

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none z-10" />

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
