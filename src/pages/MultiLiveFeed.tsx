import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutGrid, Maximize, Mic, MicOff } from "lucide-react";
import { LiveCameraStream } from "@/components/LiveCameraStream";
import type { Tables } from "@/integrations/supabase/types";

type Device = Tables<"devices">;

const MultiLiveFeed = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [cameras, setCameras] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [fullscreenCameraId, setFullscreenCameraId] = useState<string | null>(null);
    const [micStream, setMicStream] = useState<MediaStream | null>(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchCameras = async () => {
            console.log("[MultiLiveFeed] Fetching cameras for user:", user.id);
            const { data, error } = await supabase
                .from("devices")
                .select("*")
                .eq("user_id", user.id)
                .eq("type", "camera")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("[MultiLiveFeed] Fetch error:", error);
            }
            console.log(`[MultiLiveFeed] Found ${data?.length || 0} cameras raw.`, data);
            if (data) setCameras(data);
            setLoading(false);
        };

        fetchCameras();

        const channel = supabase
            .channel("multi-feed-cameras")
            .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `user_id=eq.${user.id}` }, (payload) => {
                if (payload.eventType === "UPDATE") {
                    setCameras((prev) => prev.map((d) => (d.id === (payload.new as Device).id ? (payload.new as Device) : d)).filter(d => d.type === 'camera'));
                } else if (payload.eventType === "INSERT") {
                    const newDevice = payload.new as Device;
                    if (newDevice.type === 'camera') {
                        setCameras((prev) => [newDevice, ...prev]);
                    }
                } else if (payload.eventType === "DELETE") {
                    setCameras((prev) => prev.filter((d) => d.id !== (payload.old as any).id));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const startIntercom = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setMicStream(stream);
            setIsBroadcasting(true);
        } catch (e) {
            console.error("Microphone access denied:", e);
        }
    };

    const stopIntercom = () => {
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            setMicStream(null);
        }
        setIsBroadcasting(false);
    };

    useEffect(() => {
        return () => {
            if (micStream) {
                micStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [micStream]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-black">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    // Determine grid layout based on number of cameras
    const gridClass =
        cameras.length === 1 ? "grid-cols-1" :
            cameras.length === 2 ? "grid-cols-1 md:grid-cols-2" :
                cameras.length <= 4 ? "grid-cols-1 md:grid-cols-2" :
                    cameras.length <= 6 ? "grid-cols-2 md:grid-cols-3" :
                        "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

    return (
        <div className="relative flex min-h-screen flex-col bg-black overflow-hidden">
            {/* Top bar */}
            <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4 z-40 bg-gradient-to-b from-black/90 to-transparent pt-6 pb-12">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            if (fullscreenCameraId) {
                                setFullscreenCameraId(null);
                            } else {
                                navigate("/dashboard");
                            }
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-colors shadow-lg"
                    >
                        <ArrowLeft className="h-5 w-5 text-white" />
                    </button>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-black text-white uppercase tracking-tighter shadow-sm">
                            {fullscreenCameraId ? "Spotlight View" : "Security Matrix"}
                        </h1>
                        <p className="text-[10px] text-primary uppercase font-bold tracking-widest">{cameras.length} Active Feeds</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!fullscreenCameraId && (
                        <div className="flex items-center gap-2 rounded-full bg-black/40 border border-white/10 px-3 py-1.5 backdrop-blur-md">
                            <LayoutGrid className="h-4 w-4 text-white/70" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Grid View</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 w-full h-full pt-20 p-4 sm:p-6 sm:pt-24 z-10 overflow-auto">
                {cameras.length === 0 ? (
                    <div className="h-full w-full flex flex-col items-center justify-center text-center">
                        <LayoutGrid className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h2 className="text-xl font-bold uppercase tracking-tighter text-white">No Cameras Available</h2>
                        <p className="text-sm text-muted-foreground">Add cameras from another device to monitor them here.</p>
                    </div>
                ) : fullscreenCameraId ? (
                    // Spotlight Mode (Single camera full-screen)
                    <div className="w-full h-[calc(100vh-140px)] animate-in fade-in zoom-in-95 duration-300">
                        {cameras.filter(c => c.id === fullscreenCameraId).map(camera => (
                            <LiveCameraStream
                                key={camera.id}
                                device={camera}
                                localStream={micStream}
                                onFullscreen={(id) => setFullscreenCameraId(null)}
                            />
                        ))}
                    </div>
                ) : (
                    // Matrix Mode (Grid layout)
                    <div className={`grid gap-4 w-full h-[calc(100vh-140px)] ${gridClass} animate-in fade-in duration-500`}>
                        {cameras.map((camera) => (
                            <div key={camera.id} className="w-full h-full min-h-[250px]">
                                <LiveCameraStream
                                    device={camera}
                                    localStream={micStream}
                                    onFullscreen={(id) => setFullscreenCameraId(id)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Walkie Talkie floating UI */}
            {cameras.length > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center pointer-events-auto select-none touch-none">
                    <Button
                        onPointerDown={startIntercom}
                        onPointerUp={stopIntercom}
                        onPointerLeave={stopIntercom}
                        className={`h-20 w-20 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] border-4 transition-all duration-300 flex flex-col items-center justify-center -ml-0 ${isBroadcasting
                                ? 'bg-primary border-primary/50 text-white scale-110 shadow-[0_0_50px_hsl(var(--primary))]'
                                : 'bg-black/80 border-white/20 text-white backdrop-blur-md hover:bg-black hover:border-white/40'
                            }`}
                        title="Hold to broadcast to all cameras"
                    >
                        {isBroadcasting ? <Mic className="h-8 w-8 animate-pulse text-white fill-white" /> : <MicOff className="h-8 w-8 opacity-50" />}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default MultiLiveFeed;
