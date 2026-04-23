import React, { useEffect, useRef, useState, useCallback } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Wifi, WifiOff, Maximize, RefreshCw, Maximize2, Flashlight, FlashlightOff, AlertTriangle, Mic, Moon, Sun, Camera, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AIOverlays } from "@/components/AIOverlays";
import { useToast } from "@/hooks/use-toast";

interface Device {
    id: string;
    name: string;
    status: string;
    type: string;
    user_id: string;
    battery_level?: number;
    is_charging?: boolean;
    unread_alerts?: number;
    total_clips?: number;
}

interface LiveCameraStreamProps {
    device: Device;
    onFullscreen?: (deviceId: string) => void;
    localStream?: MediaStream | null;
}

export const LiveCameraStream: React.FC<LiveCameraStreamProps> = ({ device, onFullscreen, localStream }) => {
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const { toast } = useToast();

    const [zoomLevel, setZoomLevel] = useState(1);
    const [zoomCenter, setZoomCenter] = useState({ x: 50, y: 50 });
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [micStream, setMicStream] = useState<MediaStream | null>(null);
    const [isTalkActive, setIsTalkActive] = useState(false);

    // ── Optimistic local toggle states ──────────────────────────────────────────
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [isNightVision, setIsNightVision] = useState(false);
    const [isSirenOn, setIsSirenOn] = useState(false);
    const [isAiActive, setIsAiActive] = useState(false);
    // ────────────────────────────────────────────────────────────────────────────

    const handleRemoteStream = useCallback((stream: MediaStream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            remoteVideoRef.current.setAttribute('playsinline', 'true');
            remoteVideoRef.current.setAttribute('webkit-playsinline', 'true');
        }
    }, []);

    const handleDataMessage = useCallback((msg: any) => {
        if (msg.type === 'TELEMETRY') {
            const d = msg.data || msg;
            setZoomLevel(d.zoomLevel || 1);
            setZoomCenter(d.zoomCenter || { x: 50, y: 50 });
            // TELEMETRY from camera overrides our optimistic state (truth from camera)
            if (d.isFlashOn !== undefined) setIsFlashOn(d.isFlashOn);
            if (d.isNightVision !== undefined) setIsNightVision(d.isNightVision);
            if (d.isSirenOn !== undefined) setIsSirenOn(d.isSirenOn);
            if (d.isAiActive !== undefined) setIsAiActive(d.isAiActive);
        }
        if (msg.type === 'AI_ANALYSIS') {
            console.log("[Viewer] AI data received:", msg.data);
            setAiAnalysis(msg.data);
            setTimeout(() => setAiAnalysis((prev: any) => prev === msg.data ? null : prev), 30000);
        }
    }, []);

    const { connectionState, isConnected, isChannelReady, connect, disconnect, sendData } = useWebRTC({
        deviceId: device.id,
        role: "viewer",
        localStream: micStream || localStream,
        onRemoteStream: handleRemoteStream,
        onDataMessage: handleDataMessage,
    });

    const startTalk = async (e: React.PointerEvent) => {
        e.stopPropagation();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }, 
                video: false 
            });
            setMicStream(stream);
            setIsTalkActive(true);
        } catch (err) {
            console.error("Mic access denied:", err);
        }
    };

    const endTalk = (e: React.PointerEvent) => {
        e.stopPropagation();
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
            setMicStream(null);
        }
        setIsTalkActive(false);
    };

    // Optimistic command: flip local state immediately, then send command
    const sendCommand = useCallback((action: string) => {
        if (!isConnected) return;
        // Optimistic UI updates
        switch (action) {
            case 'TOGGLE_FLASH':
                setIsFlashOn(prev => !prev);
                break;
            case 'TOGGLE_NIGHT_VISION':
                setIsNightVision(prev => !prev);
                break;
            case 'TOGGLE_SIREN':
                setIsSirenOn(prev => !prev);
                break;
            case 'TOGGLE_AI':
                setIsAiActive(prev => !prev);
                break;
        }
        sendData({ type: 'COMMAND', action });
    }, [isConnected, sendData]);

    // Auto-connect when channel is ready
    useEffect(() => {
        const isOnline = device.status === "online" || device.status === "recording";
        if (isOnline && isChannelReady && (connectionState === "new" || connectionState === "failed" || connectionState === "disconnected")) {
            console.log(`[Viewer] Auto-connecting to ${device.id} (state: ${connectionState})`);
            const delay = connectionState === "new" ? 200 : 2000; // Faster initial connect
            const timer = setTimeout(() => connect(), delay);
            return () => clearTimeout(timer);
        }
    }, [device.status, connectionState, connect, isChannelReady]);

    // Attach stream to video element when ref is ready
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {});
            
            // Reset unread alerts on connection
            if (device.unread_alerts && device.unread_alerts > 0) {
              const { db } = require("@/lib/firebase");
              const { doc, updateDoc } = require("firebase/firestore");
              updateDoc(doc(db, "devices", device.id), { unread_alerts: 0 }).catch(() => {});
            }
        }
    }, [remoteStream, isConnected, device.id, device.unread_alerts]);

    const handleRename = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const newName = prompt("Enter new camera name:", device.name);
        if (newName && newName !== device.name) {
          const { db } = require("@/lib/firebase");
          const { doc, updateDoc } = require("firebase/firestore");
          await updateDoc(doc(db, "devices", device.id), { name: newName });
        }
    };

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
        failed: "Failed",
        closed: "Closed",
    }[connectionState] || connectionState;

    const [playAttempted, setPlayAttempted] = useState(false);

    const handlePlayRequest = () => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(e => console.warn("[Viewer] Auto-play blocked:", e));
            setPlayAttempted(true);
        }
    };

    return (
        <div
            ref={containerRef}
            onClick={handlePlayRequest}
            className="relative w-full h-full bg-neutral-950 rounded-[2rem] overflow-hidden border border-white/5 group shadow-2xl cursor-pointer"
        >
            {isConnected && remoteStream ? (
                <>
                    <video
                        ref={remoteVideoRef}
                        className={cn(
                          "absolute inset-0 h-full w-full object-cover transition-all duration-700 gpu-accelerated",
                          zoomLevel > 1.5 && "brightness-[1.05] contrast-[1.1] saturate-[1.05]"
                        )}
                        style={{ 
                          transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`, 
                          transform: `scale(${zoomLevel})`,
                          imageRendering: zoomLevel > 2 ? 'crisp-edges' : 'auto'
                        }}
                        autoPlay
                        playsInline
                        muted
                    />

                    <AIOverlays isMonitoring={isAiActive} analysis={aiAnalysis} canvasRef={canvasRef} />

                    <AnimatePresence>
                        {!playAttempted && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm group-hover:bg-black/20 transition-all"
                            >
                                <div className="h-20 w-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-2xl shadow-2xl animate-pulse">
                                    <Maximize2 className="h-8 w-8 text-white" />
                                </div>
                                <span className="absolute bottom-12 text-[10px] font-bold text-white/50 uppercase tracking-[0.4em]">Initialize Stream</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            ) : isOnline ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/50 z-10 backdrop-blur-xl">
                    {connectionState === "failed" ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-3 bg-destructive/10 rounded-2xl text-destructive">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-white">Connection Interrupted</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Retry protocol required</p>
                            </div>
                            <Button onClick={() => { disconnect(); setTimeout(connect, 500); }} variant="outline" size="sm" className="bg-white/5 border-white/10 rounded-xl h-9 px-6 text-[10px] uppercase font-bold tracking-widest hover:bg-white/10">
                                <RefreshCw className="h-3 w-3 mr-2" /> Reconnect
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="h-10 w-10 border-2 border-primary/20 rounded-full animate-ping absolute inset-0" />
                                <div className="h-10 w-10 border-2 border-primary rounded-full border-t-transparent animate-spin" />
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-bold">{connectionLabel}</p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/40 z-10">
                    <div className="p-4 bg-white/5 rounded-3xl border border-white/5 mb-4">
                        <WifiOff className="h-8 w-8 text-white/20" />
                    </div>
                    <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.4em]">Signal Lost</p>
                </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none z-10" />

            {/* Top Bar: Minimal Info */}
            <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-start z-20 pointer-events-none">
                <div className="flex flex-col gap-2 pointer-events-auto">
                    <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/5 flex items-center gap-2.5">
                        <div className="relative flex h-2 w-2">
                           {isConnected ? (
                               <>
                                 <div className="animate-ping absolute inset-0 rounded-full bg-red-500 opacity-75" />
                                 <div className="relative rounded-full h-2 w-2 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                               </>
                           ) : isOnline ? (
                               <div className="rounded-full h-2 w-2 bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                           ) : (
                               <div className="rounded-full h-2 w-2 bg-white/20" />
                           )}
                        </div>
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">{isConnected ? "Live" : connectionLabel}</span>
                        {device.battery_level !== undefined && (
                          <>
                            <div className="h-2 w-[1px] bg-white/10" />
                            <span className={cn(
                              "text-[9px] font-black tracking-widest",
                              device.is_charging ? "text-green-400" : (device.battery_level < 20 ? "text-red-500" : "text-white/60")
                            )}>
                              {device.battery_level}%{device.is_charging ? "⚡" : ""}
                            </span>
                          </>
                        )}
                    </div>
                    <div className="flex flex-col gap-1 px-1">
                      <button 
                        onClick={handleRename}
                        className="text-sm font-bold text-white tracking-tight drop-shadow-lg truncate max-w-[180px] hover:text-primary transition-colors text-left"
                      >
                          {device.name}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary">
                          {device.unread_alerts || 0} New
                        </span>
                        <div className="h-1 w-1 rounded-full bg-white/10" />
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">
                          {device.total_clips || 0} Clips
                        </span>
                      </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar: Clean Controls */}
            {isOnline && (
                <div className="absolute bottom-0 left-0 right-0 p-4 z-30 transition-transform duration-500 translate-y-2 group-hover:translate-y-0">
                    <div className="bg-black/60 backdrop-blur-3xl border border-white/5 rounded-3xl p-2.5 shadow-2xl">
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                            <ControlBtn
                                icon={<Brain className={cn("h-4 w-4", isAiActive && "animate-pulse")} />}
                                label="AI"
                                active={isAiActive}
                                activeClass="bg-purple-500/10 text-purple-400 border-purple-400/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                                onClick={() => sendCommand('TOGGLE_AI')}
                                disabled={!isConnected}
                            />
                            <ControlBtn
                                icon={<Mic className={cn("h-4 w-4", isTalkActive && "animate-pulse")} />}
                                label="Talk"
                                active={isTalkActive}
                                activeClass="bg-red-500 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                                onClick={() => isTalkActive ? endTalk({ stopPropagation: () => {} } as any) : startTalk({ stopPropagation: () => {} } as any)}
                                disabled={!isConnected}
                            />
                            <ControlBtn
                                icon={isFlashOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />}
                                label="Light"
                                active={isFlashOn}
                                activeClass="bg-yellow-400 text-black border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                                onClick={() => sendCommand('TOGGLE_FLASH')}
                                disabled={!isConnected}
                            />
                            <ControlBtn
                                icon={isNightVision ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                                label="Night"
                                active={isNightVision}
                                activeClass="bg-green-500/10 text-green-400 border-green-400/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                                onClick={() => sendCommand('TOGGLE_NIGHT_VISION')}
                                disabled={!isConnected}
                            />
                            <ControlBtn
                                icon={<AlertTriangle className="h-4 w-4" />}
                                label="Alarm"
                                active={isSirenOn}
                                activeClass="bg-destructive text-white border-destructive hover:bg-destructive/90 animate-pulse"
                                onClick={() => sendCommand('TOGGLE_SIREN')}
                                disabled={!isConnected}
                            />
                            <ControlBtn
                                icon={<Camera className="h-4 w-4" />}
                                label="Snap"
                                active={false}
                                onClick={() => sendCommand('TAKE_SNAPSHOT')}
                                disabled={!isConnected}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Button */}
            <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity z-40">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleFullscreenInternal}
                    className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 text-white transition-all shadow-xl"
                >
                    <Maximize className="h-4 w-4" />
                </Button>
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
        <span className="text-[9px] font-bold text-inherit">{label}</span>
    </button>
);
