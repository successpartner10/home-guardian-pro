import React, { useEffect, useRef, useState, useCallback } from "react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Wifi, WifiOff, Maximize, RefreshCw, Maximize2, Flashlight, FlashlightOff, AlertTriangle, Mic, Moon, Sun, Camera, Brain, Thermometer, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AIOverlays } from "@/components/AIOverlays";
import { useToast } from "@/hooks/use-toast";
import { DrawerSection, DrawerBtn } from "@/components/CameraControls";

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

const LiveCameraStream: React.FC<LiveCameraStreamProps> = ({ device, onFullscreen, localStream }) => {
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
    const [isThermal, setIsThermal] = useState(false);

    const [isFlashOn, setIsFlashOn] = useState(false);
    const [isNightVision, setIsNightVision] = useState(false);
    const [isSirenOn, setIsSirenOn] = useState(false);
    const [isAiActive, setIsAiActive] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [muted, setMuted] = useState(true);
    const [playAttempted, setPlayAttempted] = useState(false);

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
            if (d.isFlashOn !== undefined) setIsFlashOn(d.isFlashOn);
            if (d.isNightVision !== undefined) setIsNightVision(d.isNightVision);
            if (d.isSirenOn !== undefined) setIsSirenOn(d.isSirenOn);
            if (d.isAiActive !== undefined) setIsAiActive(d.isAiActive);
        }
        if (msg.type === 'AI_ANALYSIS') {
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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
            setMicStream(stream);
            setIsTalkActive(true);
        } catch (err) {
            console.error("Mic access denied:", err);
        }
    };

    const endTalk = (e: React.PointerEvent) => {
        e.stopPropagation();
        if (micStream) { micStream.getTracks().forEach(t => t.stop()); setMicStream(null); }
        setIsTalkActive(false);
    };

    const sendCommand = useCallback((action: string) => {
        if (!isConnected) return;
        switch (action) {
            case 'TOGGLE_FLASH': setIsFlashOn(prev => !prev); break;
            case 'TOGGLE_NIGHT_VISION': setIsNightVision(prev => !prev); break;
            case 'TOGGLE_SIREN': setIsSirenOn(prev => !prev); break;
            case 'TOGGLE_AI': setIsAiActive(prev => !prev); break;
        }
        sendData({ type: 'COMMAND', action });
    }, [isConnected, sendData]);

    useEffect(() => {
        const isOnline = device.status === "online" || device.status === "recording";
        if (isOnline && isChannelReady && (connectionState === "new" || connectionState === "failed" || connectionState === "disconnected")) {
            const delay = connectionState === "new" ? 200 : 2000;
            const timer = setTimeout(() => connect(), delay);
            return () => clearTimeout(timer);
        }
    }, [device.status, connectionState, connect, isChannelReady]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {});
            if (device.unread_alerts && device.unread_alerts > 0) {
              import("@/lib/firebase").then(({ db }) => {
                import("firebase/firestore").then(({ doc, updateDoc }) => {
                  updateDoc(doc(db, "devices", device.id), { unread_alerts: 0 }).catch(() => {});
                });
              });
            }
        }
    }, [remoteStream, isConnected, device.id, device.unread_alerts]);

    const handleFullscreenInternal = () => {
        if (onFullscreen) {
            onFullscreen(device.id);
        } else if (containerRef.current) {
            document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen();
        }
    };

    const isOnline = device.status === "online" || device.status === "recording";

    const handlePlayRequest = () => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
            setPlayAttempted(true);
        }
    };

    return (
        <div
            ref={containerRef}
            onClick={handlePlayRequest}
            className="relative w-full h-full bg-neutral-950 rounded-[2rem] overflow-hidden border border-white/5 group shadow-2xl cursor-pointer"
        >
            {/* ── Video / Status ── */}
            {isConnected && remoteStream ? (
                <>
                    <video
                        ref={remoteVideoRef}
                        className={cn(
                          "absolute inset-0 h-full w-full object-cover transition-all duration-700",
                          isNightVision ? "brightness-[1.8] contrast-[1.4] sepia-[1] hue-rotate-[70deg] saturate-[2.5] invert-[0.05]" : "",
                          zoomLevel > 1.5 && "brightness-[1.05] contrast-[1.1] saturate-[1.05]"
                        )}
                        style={{
                          transformOrigin: `${zoomCenter.x}% ${zoomCenter.y}%`,
                          transform: `scale(${zoomLevel})`,
                          imageRendering: zoomLevel > 2 ? 'crisp-edges' : 'auto'
                        }}
                        autoPlay playsInline muted
                    />
                    <AIOverlays isMonitoring={isAiActive} analysis={aiAnalysis} canvasRef={canvasRef} isThermal={isThermal} />

                    {/* Person pill — tiny, bottom-left */}
                    {aiAnalysis?.detected_objects?.some((obj: any) => obj.label?.toLowerCase().includes('person')) && (
                      <div className="absolute bottom-3 left-3 z-40 pointer-events-none">
                        <span className="bg-red-600/90 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full animate-pulse">
                          Person
                        </span>
                      </div>
                    )}
                </>
            ) : isOnline ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/60 z-10 backdrop-blur-sm">
                    {connectionState === "failed" ? (
                        <div className="flex flex-col items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            <p className="text-[10px] text-white/50">Connection lost</p>
                            <Button onClick={() => { disconnect(); setTimeout(connect, 500); }} variant="ghost" size="sm" className="h-7 px-4 text-[10px] rounded-full border border-white/10 hover:bg-white/10">
                                <RefreshCw className="h-3 w-3 mr-1.5" /> Retry
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <p className="text-[9px] text-white/30 uppercase tracking-widest">
                                {connectionState === "new" ? "Finding…" : "Connecting…"}
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/40 z-10 gap-2">
                    <WifiOff className="h-5 w-5 text-white/10" />
                    <p className="text-[9px] text-white/20 tracking-wide">Offline</p>
                </div>
            )}

            {/* ── Hover-only gradient ── */}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

            {/* ── Hover-only top info bar ── */}
            <div className="absolute top-2.5 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none flex items-center gap-1.5">
                <div className="relative flex h-1.5 w-1.5">
                    {isConnected ? (
                        <>
                          <div className="animate-ping absolute inset-0 rounded-full bg-red-500 opacity-75" />
                          <div className="relative rounded-full h-1.5 w-1.5 bg-red-500" />
                        </>
                    ) : isOnline ? (
                        <div className="rounded-full h-1.5 w-1.5 bg-primary animate-pulse" />
                    ) : (
                        <div className="rounded-full h-1.5 w-1.5 bg-white/20" />
                    )}
                </div>
                <span className="text-[9px] font-semibold text-white/60 drop-shadow truncate max-w-[130px]">{device.name}</span>
                {device.battery_level !== undefined && (
                  <span className={cn("text-[9px] font-bold", device.is_charging ? "text-green-400" : device.battery_level < 20 ? "text-red-400" : "text-white/30")}>
                    {device.battery_level}%{device.is_charging ? "⚡" : ""}
                  </span>
                )}
            </div>

            {/* ── Unread alert badge (always visible) ── */}
            {(device.unread_alerts || 0) > 0 && (
              <div className="absolute top-2 right-2 z-30 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center pointer-events-none shadow-lg">
                <span className="text-[7px] font-black text-white">{device.unread_alerts}</span>
              </div>
            )}

            {/* ── Controls drawer (hover-only tab) ── */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 z-50 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onClick={e => e.stopPropagation()}
            >
              <AnimatePresence>
                {isDrawerOpen && (
                  <motion.div
                    key="drawer-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ type: "spring", damping: 28, stiffness: 340 }}
                    className="bg-black/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-0.5 shadow-2xl w-48 max-h-[75vh] overflow-y-auto mr-1"
                  >
                    <DrawerSection label="View">
                      <div className="flex items-center justify-between px-2 py-1">
                        <button onClick={(e) => { e.stopPropagation(); setZoomLevel(prev => Math.max(prev - 0.5, 1)); }} disabled={zoomLevel <= 1} className="h-8 w-8 rounded-xl bg-white/10 text-white hover:bg-white/25 disabled:opacity-25 transition-all flex items-center justify-center font-bold text-lg">−</button>
                        <span className="text-xs font-black text-white/60">{zoomLevel.toFixed(1)}×</span>
                        <button onClick={(e) => { e.stopPropagation(); setZoomLevel(prev => Math.min(prev + 0.5, 4)); }} disabled={zoomLevel >= 4} className="h-8 w-8 rounded-xl bg-white/10 text-white hover:bg-white/25 disabled:opacity-25 transition-all flex items-center justify-center font-bold text-lg">+</button>
                      </div>
                      <DrawerBtn icon={<Maximize className="h-4 w-4" />} label="Fullscreen" onClick={handleFullscreenInternal} />
                    </DrawerSection>
                    <DrawerSection label="Camera">
                      <DrawerBtn icon={isFlashOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />} label="Flashlight" active={isFlashOn} activeClass="bg-yellow-400/20 text-yellow-300 border border-yellow-400/30" onClick={() => sendCommand('TOGGLE_FLASH')} disabled={!isConnected} />
                      <DrawerBtn icon={isNightVision ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} label="Night Mode" active={isNightVision} activeClass="bg-green-500/20 text-green-400 border border-green-400/30" onClick={() => sendCommand('TOGGLE_NIGHT_VISION')} disabled={!isConnected} />
                      <DrawerBtn icon={<Camera className="h-4 w-4" />} label="Take Snapshot" onClick={() => sendData({ type: 'COMMAND', action: 'TAKE_SNAPSHOT' })} disabled={!isConnected} />
                    </DrawerSection>
                    <DrawerSection label="Audio">
                      <DrawerBtn icon={muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} label={muted ? "Tap to Unmute" : "Mute Audio"} active={!muted} activeClass="bg-blue-500/20 text-blue-300 border border-blue-400/30" onClick={() => setMuted(!muted)} />
                      <DrawerBtn icon={<Mic className={cn("h-4 w-4", isTalkActive && "animate-pulse")} />} label={isTalkActive ? "Talking..." : "Hold to Talk"} active={isTalkActive} activeClass="bg-red-500/20 text-red-400 border border-red-400/30" onPointerDown={startTalk} onPointerUp={endTalk} onPointerLeave={endTalk} disabled={!isConnected} />
                    </DrawerSection>
                    <DrawerSection label="AI & Detection">
                      <DrawerBtn icon={<Brain className={cn("h-4 w-4", isAiActive && "animate-pulse")} />} label="AI Detection" active={isAiActive} activeClass="bg-purple-500/20 text-purple-400 border border-purple-400/30" onClick={() => sendCommand('TOGGLE_AI')} disabled={!isConnected} />
                      <DrawerBtn icon={<Thermometer className="h-4 w-4" />} label="Thermal View" active={isThermal} activeClass="bg-orange-500/20 text-orange-400 border border-orange-400/30" onClick={() => setIsThermal(!isThermal)} />
                      <DrawerBtn icon={<AlertTriangle className="h-4 w-4" />} label="Alarm" active={isSirenOn} activeClass="bg-red-500/20 text-red-400 border border-red-400/30 animate-pulse" onClick={() => sendCommand('TOGGLE_SIREN')} disabled={!isConnected} />
                    </DrawerSection>
                    <DrawerSection label="Connection" isLast>
                      <DrawerBtn icon={<RefreshCw className="h-4 w-4" />} label="Reconnect" onClick={() => { disconnect(); setTimeout(connect, 500); }} />
                    </DrawerSection>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Slim tab — visible on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); setIsDrawerOpen(p => !p); }}
                className="h-14 w-5 bg-black/50 backdrop-blur-md border border-white/10 border-r-0 rounded-l-xl flex items-center justify-center text-white/25 hover:bg-white/10 hover:text-white/60 transition-all"
              >
                <ChevronRight className={cn("h-3 w-3 transition-transform duration-200", isDrawerOpen && "rotate-180")} />
              </button>
            </div>
        </div>
    );
};

export default React.memo(LiveCameraStream);
