import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTC } from "@/hooks/useWebRTC";
import { RadarOverlay, BoundingBoxesOverlay, filterObjects, type CategoryId } from "@/components/AIOverlays";
import { Wifi, WifiOff, Volume2, VolumeX, Maximize, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PublicView = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [device, setDevice] = useState<any>(null);
    const [muted, setMuted] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
    const [zoomCenter, setZoomCenter] = useState({ x: 50, y: 50 });
    const [zoomLevel, setZoomLevel] = useState(1);
    const activeCategories = new Set<CategoryId>(["all"]);

    const handleRemoteStream = useCallback((stream: MediaStream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
        }
    }, []);

    const handleDataMessage = useCallback((data: any) => {
        if (data.type === "TELEMETRY") {
            if (data.detectedObjects) setDetectedObjects(data.detectedObjects);
            if (data.zoomLevel) setZoomLevel(data.zoomLevel);
            if (data.zoomCenter) setZoomCenter(data.zoomCenter);
        }
    }, []);

    const { connectionState, isConnected, isChannelReady, connect } = useWebRTC({
        deviceId: device?.id || "",
        role: "viewer",
        onRemoteStream: handleRemoteStream,
        onDataMessage: handleDataMessage,
    });

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setError("Invalid link");
                setLoading(false);
                return;
            }

            // Find device with this token in settings
            const { data, error: fetchError } = await supabase
                .from("devices")
                .select("*")
                .filter("settings->share_token", "eq", token)
                .single();

            if (fetchError || !data) {
                setError("This link has expired or is invalid.");
                setLoading(false);
                return;
            }

            const settings = data.settings as any;
            const expiresAt = settings?.share_expires_at;
            if (expiresAt && new Date(expiresAt) < new Date()) {
                setError("This link has expired.");
                setLoading(false);
                return;
            }

            setDevice(data);
            setLoading(false);
        };

        validateToken();
    }, [token]);

    useEffect(() => {
        if (device && isChannelReady && connectionState === "new") {
            connect();
        }
    }, [device, isChannelReady, connectionState, connect]);

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

                        <RadarOverlay
                            detectedObjects={detectedObjects}
                            videoWidth={remoteVideoRef.current?.videoWidth || 640}
                            videoHeight={remoteVideoRef.current?.videoHeight || 480}
                        />

                        <BoundingBoxesOverlay
                            detectedObjects={detectedObjects}
                            filteredObjects={filterObjects(detectedObjects, activeCategories)}
                            activeCategories={activeCategories}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-sm font-bold text-white/40 uppercase tracking-widest">Connecting to secured stream...</p>
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

                {/* Footer info */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40">
                    <div className="px-6 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Secure End-to-End Encryption Active</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicView;
