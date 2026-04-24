import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    limit
} from "firebase/firestore";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Wifi, WifiOff, Volume2, VolumeX, Maximize, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, ZoomIn, ZoomOut } from "lucide-react";
import { Slider } from "@/components/ui/slider";

const PublicView = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [device, setDevice] = useState<any>(null);
    const [muted, setMuted] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(null);
    const [isTalking, setIsTalking] = useState(false);
    const [zoomCenter, setZoomCenter] = useState({ x: 50, y: 50 });
    const [zoomLevel, setZoomLevel] = useState(1);

    const handleRemoteStream = useCallback((stream: MediaStream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
        }
    }, []);

    const handleDataMessage = useCallback((data: any) => {
        if (data.type === "TELEMETRY") {
            if (data.zoomLevel) setZoomLevel(data.zoomLevel);
            if (data.zoomCenter) setZoomCenter(data.zoomCenter);
        }
    }, []);

    const { connectionState, isConnected, isChannelReady, connect, disconnect } = useWebRTC({
        deviceId: device?.id || "",
        role: "viewer",
        localStream: localMicStream,
        onRemoteStream: handleRemoteStream,
        onDataMessage: handleDataMessage,
    });

    const startTalking = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalMicStream(stream);
            setIsTalking(true);
        } catch (e) {
            console.error("Mic access failed:", e);
        }
    };

    const stopTalking = () => {
        if (localMicStream) {
            localMicStream.getTracks().forEach(t => t.stop());
            setLocalMicStream(null);
        }
        setIsTalking(false);
    };

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setError("Invalid link");
                setLoading(false);
                return;
            }

            try {
                // Find device with this token in settings
                const q = query(
                    collection(db, "devices"),
                    where("settings.share_token", "==", token),
                    limit(1)
                );

                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setError("This link has expired or is invalid.");
                    setLoading(false);
                    return;
                }

                const docSnap = querySnapshot.docs[0];
                const data = { id: docSnap.id, ...docSnap.data() } as any;

                const settings = data.settings;
                const expiresAt = settings?.share_expires_at;
                if (expiresAt && new Date(expiresAt) < new Date()) {
                    setError("This link has expired.");
                    setLoading(false);
                    return;
                }

                setDevice(data);
            } catch (e) {
                console.error("Token validation error:", e);
                setError("An error occurred while validating the link.");
            }
            setLoading(false);
        };

        validateToken();
    }, [token]);

    useEffect(() => {
        if (!device || !isChannelReady) return;
        const shouldConnect = connectionState === "new" || connectionState === "closed" || connectionState === "failed" || connectionState === "disconnected";
        if (shouldConnect) {
            const delay = connectionState === "new" ? 300 : 2000;
            const timer = setTimeout(() => connect(), delay);
            return () => clearTimeout(timer);
        }
    }, [device, isChannelReady, connectionState, connect]);

    const isConnectionBad =
        connectionState === "failed" ||
        connectionState === "disconnected" ||
        connectionState === "closed";

    const retry = async () => {
        try {
            disconnect();
            setRemoteStream(null);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            await new Promise((r) => setTimeout(r, 500));
            connect();
        } catch (e) {
            console.warn("[PublicView] Retry failed:", e);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-black">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center">
                <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Access Denied</h1>
                <p className="text-zinc-400 max-w-sm mb-8">{error}</p>
                <button
                    onClick={() => navigate("/login")}
                    className="px-8 py-3 bg-white text-black rounded-full font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-colors"
                >
                    Go to Login
                </button>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen flex-col bg-black overflow-hidden">
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
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center space-y-6 px-6">
                        {isConnectionBad ? (
                            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
                                <WifiOff className="h-8 w-8 text-destructive" />
                            </div>
                        ) : (
                            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_20px_rgba(var(--primary),0.3)]" />
                        )}

                        <div className="space-y-2">
                            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                                {isConnectionBad ? `Connection ${connectionState}` : 'Connecting to secured stream...'}
                            </h2>
                            <p className="text-xs text-white/40 max-w-[200px] leading-relaxed">
                                {isConnectionBad
                                    ? 'The connection attempt failed. Tap retry to reconnect.'
                                    : 'Establishing a peer-to-peer encrypted tunnel to your camera.'}
                            </p>
                        </div>

                        <Button
                            onClick={retry}
                            variant="outline"
                            className="bg-white/5 border-white/10 text-white hover:bg-white/20 rounded-full px-8 py-6 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95"
                        >
                            {isConnectionBad ? 'Retry Now' : 'Cancel & Re-connect'}
                        </Button>

                        {!isConnectionBad && connectionState === 'connecting' && (
                           <p className="text-[9px] text-white/20 uppercase tracking-widest animate-pulse">Attempting NAT Traversal...</p>
                        )}
                    </div>
                )}

                {/* Top bar */}
                <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-6 z-40 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="flex flex-col">
                        <h1 className="text-lg font-black text-white uppercase tracking-tighter shadow-sm flex items-center gap-2">
                            Shared Feed <Badge variant="outline" className="text-[8px] border-primary text-primary px-1.5 py-0">Guest</Badge>
                        </h1>
                        <p className="text-[10px] text-white/50 uppercase font-bold tracking-widest">{device?.name}</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onMouseDown={startTalking}
                                onMouseUp={stopTalking}
                                onTouchStart={startTalking}
                                onTouchEnd={stopTalking}
                                className={cn(
                                    "h-14 px-6 flex items-center gap-3 rounded-2xl transition-all duration-300 font-black uppercase text-[10px] tracking-widest",
                                    isTalking 
                                        ? "bg-primary text-black scale-110 shadow-[0_0_30px_rgba(var(--primary),0.5)]" 
                                        : "bg-white/10 backdrop-blur-md border border-white/10 text-white"
                                )}
                            >
                                {isTalking ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4 opacity-50" />}
                                {isTalking ? "Speaking..." : "Hold to Talk"}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMuted(!muted)}
                                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white"
                            >
                                {muted ? <VolumeX className="h-5 w-5 opacity-40" /> : <Volume2 className="h-5 w-5 text-primary" />}
                            </button>
                            <button
                                onClick={() => remoteVideoRef.current?.requestFullscreen()}
                                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white"
                            >
                                <Maximize className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer info & Zoom */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-4 w-full max-w-xs">
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-4 w-full flex flex-col gap-3">
                         <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/60">
                            <span className="flex items-center gap-2"><ZoomOut className="h-3 w-3" /> 1X</span>
                            <span>Digital Zoom</span>
                            <span className="flex items-center gap-2 text-primary">4X <ZoomIn className="h-3 w-3" /></span>
                         </div>
                         <Slider 
                            value={[zoomLevel]} 
                            min={1} 
                            max={4} 
                            step={0.1} 
                            onValueChange={(vals) => setZoomLevel(vals[0])}
                            className="w-full"
                         />
                    </div>
                    <div className="px-6 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Secure End-to-End Encryption Active</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicView;
