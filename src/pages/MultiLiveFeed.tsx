import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    getDocs,
    deleteDoc,
    doc
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutGrid, Maximize, Mic, MicOff, Share2, Trash2 } from "lucide-react";
import LiveCameraStream from "@/components/LiveCameraStream";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { RefreshCw, ChevronRight, Flashlight, AlertTriangle, Moon, Sun, Brain, Thermometer, Camera } from "lucide-react";
import { DrawerSection, DrawerBtn } from "@/components/CameraControls";
import { updateDoc, serverTimestamp } from "firebase/firestore";

interface Device {
    id: string;
    name: string;
    status: string;
    type: string;
    user_id: string;
    created_at?: any;
    isShared?: boolean;
}

const MultiLiveFeed = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [cameras, setCameras] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [fullscreenCameraId, setFullscreenCameraId] = useState<string | null>(null);
    const [micStream, setMicStream] = useState<MediaStream | null>(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [gridSize, setGridSize] = useState<number | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const sendGlobalCommand = async (action: string) => {
        if (cameras.length === 0) return;
        
        console.log(`[MultiLiveFeed] Broadcasting ${action} to ${cameras.length} cameras`);
        const promises = cameras.map(cam => 
            updateDoc(doc(db, "devices", cam.id), {
                last_command: {
                    action,
                    timestamp: serverTimestamp()
                }
            })
        );
        
        try {
            await Promise.all(promises);
        } catch (e) {
            console.error("Global broadcast failed:", e);
        }
    };

    useEffect(() => {
        alert("MULTILIVEFEED MOUNTED");
        if (!user || !user.email) return;

        // Query owned devices
        const qOwned = query(
            collection(db, "devices"),
            where("user_id", "==", user.uid)
        );

        // Query shared devices
        const qShared = query(
            collection(db, "devices"),
            where("shared_with", "array-contains", user.email)
        );

        const processDocs = (snapshot: any, isShared: boolean) => {
            return snapshot.docs
                .map((doc: any) => ({
                    id: doc.id,
                    ...doc.data(),
                    isShared
                }))
                .filter((d: any) => d.type === "camera") as Device[];
        };

        let owned: Device[] = [];
        let shared: Device[] = [];

        const updateCameras = () => {
            const merged = [...owned, ...shared].sort((a, b) => {
                const dateA = a.created_at?.seconds || 0;
                const dateB = b.created_at?.seconds || 0;
                return dateB - dateA;
            });

            const now = Date.now();
            const onlineThreshold = 300 * 1000; // 5 minutes
            
            const filtered = merged.filter(d => {
                const ts = d.last_seen || d.updated_at || d.created_at;
                const lastSeen = ts?.toDate ? ts.toDate().getTime() : 
                               ts?.seconds ? ts.seconds * 1000 : 0;
                return (now - lastSeen) < onlineThreshold;
            });

            const unique = Array.from(new Map(filtered.map(d => [d.name, d])).values());
            setCameras(unique);
            setLoading(false);
        };

        const unsubOwned = onSnapshot(qOwned, (snap) => {
            owned = processDocs(snap, false);
            updateCameras();
        }, (err) => {
            console.error("MultiLiveFeed owned error:", err);
            setLoading(false);
        });

        const unsubShared = onSnapshot(qShared, (snap) => {
            shared = processDocs(snap, true);
            updateCameras();
        }, (err) => {
            console.error("MultiLiveFeed shared error:", err);
            setLoading(false);
        });

        return () => {
            unsubOwned();
            unsubShared();
        };
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

    const purgeAllDevices = async () => {
        if (!user) return;
        try {
            const q = query(collection(db, "devices"), where("user_id", "==", user.uid));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
                await deleteDoc(doc(db, "devices", d.id));
            }
            setCameras([]);
            console.log(`[Viewer] Purged ${snap.size} device records`);
        } catch (e) {
            console.error("Purge failed:", e);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-black flex-col">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
                <h1 className="text-white mt-8 text-2xl font-bold">LOADING VIEWER...</h1>
                <p className="text-white/50 mt-4">If this screen never goes away, the database connection is stuck.</p>
                <div className="mt-8 text-red-500 font-mono text-xs">
                    User: {user?.email} <br/>
                    UID: {user?.uid}
                </div>
            </div>
        );
    }

    const effectiveGridSize = gridSize || (
        cameras.length === 1 ? 1 :
            cameras.length === 2 ? 2 :
                cameras.length <= 4 ? 4 : 6
    );

    const gridClass =
        effectiveGridSize === 1 ? "grid-cols-1" :
            effectiveGridSize === 2 ? "grid-cols-1 landscape:grid-cols-2" :
                effectiveGridSize === 4 ? "grid-cols-2" :
                    "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

    return (
        <div className="relative flex min-h-screen flex-col bg-black overflow-hidden select-none">
            <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-6 z-40 bg-gradient-to-b from-black via-black/40 to-transparent pt-8 pb-16">
                <div className="flex items-center gap-5">
                    <button
                        onClick={() => {
                            if (fullscreenCameraId) {
                                setFullscreenCameraId(null);
                            } else {
                                navigate("/dashboard");
                            }
                        }}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-3xl transition-all shadow-2xl active:scale-90"
                    >
                        <ArrowLeft className="h-6 w-6 text-white" />
                    </button>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <div 
                                onClick={() => navigate("/dashboard")} 
                                className="flex items-center gap-3 group cursor-pointer pointer-events-auto"
                            >
                              <Logo size="sm" className="h-8 transition-transform group-hover:scale-110" />
                              <span className="text-xl font-black text-white uppercase tracking-tighter">HGUARD</span>
                            </div>
                            <div className="h-4 w-[1.5px] bg-primary/40 rounded-full" />
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Matrix v2</span>
                        </div>
                        <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">{cameras.length} Active Cameras</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-primary transition-all"
                        title="Force Refresh Mesh"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>

                    {!fullscreenCameraId && (
                        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                            {[1, 2, 4, 6].map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setGridSize(size)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        effectiveGridSize === size ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-white/30 hover:text-white"
                                    )}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={purgeAllDevices}
                        title="Delete all device records"
                        className="h-9 w-9 rounded-xl bg-black/40 border border-white/10 backdrop-blur-md text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
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

            {/* Global Broadcast Tactical Drawer */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 z-50 flex items-center"
              onClick={e => e.stopPropagation()}
            >
              <AnimatePresence>
                {isDrawerOpen && (
                  <motion.div
                    key="global-drawer"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    className="bg-black/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-0.5 shadow-2xl w-48 max-h-[75vh] overflow-y-auto mr-1"
                  >
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="px-2 py-2 mb-1"
                    >
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Global Broadcast</span>
                        <p className="text-[7px] text-white/30 uppercase font-bold">Commands all {cameras.length} nodes</p>
                    </motion.div>

                    <DrawerSection label="Tactical">
                      <DrawerBtn icon={<Flashlight className="h-4 w-4" />} label="All Flashlights" onClick={() => sendGlobalCommand('TOGGLE_FLASH')} />
                      <DrawerBtn icon={<Moon className="h-4 w-4" />} label="All Night Mode" onClick={() => sendGlobalCommand('TOGGLE_NIGHT_VISION')} />
                      <DrawerBtn icon={<AlertTriangle className="h-4 w-4" />} label="All Sirens" onClick={() => sendGlobalCommand('TOGGLE_SIREN')} />
                    </DrawerSection>

                    <DrawerSection label="Vision">
                      <DrawerBtn icon={<Brain className="h-4 w-4" />} label="All AI Detection" onClick={() => sendGlobalCommand('TOGGLE_AI')} />
                      <DrawerBtn icon={<Camera className="h-4 w-4" />} label="Take All Snapshots" onClick={() => sendGlobalCommand('TAKE_SNAPSHOT')} />
                    </DrawerSection>

                    <DrawerSection label="Mesh" isLast>
                      <DrawerBtn icon={<RefreshCw className="h-4 w-4" />} label="Force Sync Mesh" onClick={() => window.location.reload()} />
                    </DrawerSection>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setIsDrawerOpen(p => !p)}
                className="h-24 w-8 bg-black/60 backdrop-blur-md border border-white/10 border-r-0 rounded-l-2xl flex flex-col items-center justify-center gap-2 text-white/40 hover:bg-white/10 hover:text-white/80 transition-all shadow-2xl"
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform duration-300", isDrawerOpen && "rotate-180")} />
                <span
                  className="text-[7px] uppercase tracking-widest font-bold"
                  style={{ writingMode: 'vertical-rl' }}
                >Matrix</span>
              </button>
            </div>

            {/* Walkie Talkie floating UI */}
            {cameras.length > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 pointer-events-auto select-none touch-none">
                    <AnimatePresence>
                        {isBroadcasting && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="px-4 py-1.5 bg-red-500 rounded-full shadow-2xl border border-red-400"
                            >
                                <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] animate-pulse">Broadcasting to Mesh</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <Button
                        onClick={() => isBroadcasting ? stopIntercom() : startIntercom()}
                        className={`h-20 w-20 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] border-4 transition-all duration-300 flex flex-col items-center justify-center -ml-0 ${isBroadcasting
                            ? 'bg-primary border-primary/50 text-white scale-110 shadow-[0_0_50px_hsl(var(--primary))]'
                            : 'bg-black/80 border-white/20 text-white backdrop-blur-md hover:bg-black hover:border-white/40'
                            }`}
                        title={isBroadcasting ? "Tap to Stop" : "Tap to Broadcast to All"}
                    >
                        {isBroadcasting ? <Mic className="h-8 w-8 animate-pulse text-white fill-white" /> : <MicOff className="h-8 w-8 opacity-50" />}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default MultiLiveFeed;
