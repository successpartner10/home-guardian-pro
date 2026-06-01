import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
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
import { ArrowLeft, LayoutGrid, Maximize, Mic, MicOff, RefreshCw, ChevronRight, Flashlight, AlertTriangle, Moon, Brain, Camera } from "lucide-react";
import LiveCameraStream from "@/components/LiveCameraStream";
import { cn } from "@/lib/utils";
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
    const [searchParams] = useSearchParams();
    const filterIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];
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

            // If user selected specific cameras via ?ids= param, filter
            let final = unique;
            if (filterIds.length > 0) {
              final = unique.filter(d => filterIds.includes(d.id));
            }
            setCameras(final);
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
            <div className="flex min-h-screen items-center justify-center bg-background flex-col">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
                <h1 className="text-foreground mt-8 text-2xl font-bold">Loading your cameras…</h1>
                <p className="text-muted-foreground mt-4">This is taking a while. Check your internet connection and try refreshing.</p>
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
        <div className="relative flex min-h-screen flex-col bg-background overflow-hidden select-none">
            {/* Minimal top bar — no logo, just back + count + grid toggle */}
            <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 pt-4 pb-10 z-40 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (fullscreenCameraId) setFullscreenCameraId(null);
                            else navigate("/dashboard");
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-background/50 hover:bg-white/20 border border-border backdrop-blur-md transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 text-foreground" />
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-background/50 border border-border rounded-full backdrop-blur-md">
                        <LayoutGrid className="h-3 w-3 text-primary" />
                        <span className="text-[11px] font-bold text-foreground/80">{cameras.length} Camera{cameras.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.location.reload()}
                        className="h-9 w-9 flex items-center justify-center rounded-full bg-background/50 border border-border text-muted-foreground hover:text-foreground transition-all"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>

                    {!fullscreenCameraId && (
                        <div className="flex items-center gap-1 p-1 rounded-full bg-background/50 border border-border backdrop-blur-md">
                            {[1, 2, 4].map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setGridSize(size)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all",
                                        effectiveGridSize === size ? "bg-primary text-black" : "text-foreground/30 hover:text-foreground"
                                    )}
                                >
                                    {size === 1 ? '1' : size === 2 ? '2' : '4'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 w-full h-full pt-20 p-4 sm:p-6 sm:pt-24 z-10 overflow-auto">
                {cameras.length === 0 ? (
                    <div className="h-full w-full flex flex-col items-center justify-center text-center">
                        <LayoutGrid className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h2 className="text-xl font-bold tracking-tight text-foreground">No cameras online</h2>
                        <p className="text-sm text-muted-foreground">Open HGUARD on a phone or tablet, tap Use as camera, then come back here to watch.</p>
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
                    className="bg-background/85 backdrop-blur-2xl border border-border rounded-2xl p-2 flex flex-col gap-0.5 shadow-2xl w-48 max-h-[75vh] overflow-y-auto mr-1"
                  >
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="px-2 py-2 mb-1"
                    >
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">All cameras</span>
                        <p className="text-[7px] text-foreground/30 font-bold">Controls every camera at once</p>
                    </motion.div>

                    <DrawerSection label="Camera controls">
                      <DrawerBtn icon={<Flashlight className="h-4 w-4" />} label="All flashlights" onClick={() => sendGlobalCommand('TOGGLE_FLASH')} />
                      <DrawerBtn icon={<Moon className="h-4 w-4" />} label="All night mode" onClick={() => sendGlobalCommand('TOGGLE_NIGHT_VISION')} />
                      <DrawerBtn icon={<AlertTriangle className="h-4 w-4" />} label="All alarms" onClick={() => sendGlobalCommand('TOGGLE_SIREN')} />
                    </DrawerSection>

                    <DrawerSection label="Smart features">
                      <DrawerBtn icon={<Brain className="h-4 w-4" />} label="All AI detection" onClick={() => sendGlobalCommand('TOGGLE_AI')} />
                      <DrawerBtn icon={<Camera className="h-4 w-4" />} label="Snapshot all" onClick={() => sendGlobalCommand('TAKE_SNAPSHOT')} />
                    </DrawerSection>

                    <DrawerSection label="More" isLast>
                      <DrawerBtn icon={<RefreshCw className="h-4 w-4" />} label="Refresh all" onClick={() => window.location.reload()} />
                    </DrawerSection>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setIsDrawerOpen(p => !p)}
                className="h-24 w-8 bg-background/60 backdrop-blur-md border border-border border-r-0 rounded-l-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground/80 transition-all shadow-2xl"
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform duration-300", isDrawerOpen && "rotate-180")} />
                <span
                  className="text-[7px] uppercase tracking-widest font-bold"
                  style={{ writingMode: 'vertical-rl' }}
                >Controls</span>
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
                                <span className="text-[10px] font-black text-foreground uppercase tracking-[0.3em] animate-pulse">Talking to all cameras</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <Button
                        onClick={() => isBroadcasting ? stopIntercom() : startIntercom()}
                        className={`h-20 w-20 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] border-4 transition-all duration-300 flex flex-col items-center justify-center -ml-0 ${isBroadcasting
                            ? 'bg-primary border-primary/50 text-foreground scale-110 shadow-[0_0_50px_hsl(var(--primary))]'
                            : 'bg-background/80 border-border text-foreground backdrop-blur-md hover:bg-background hover:border-white/40'
                            }`}
                        title={isBroadcasting ? "Stop talking" : "Talk to all cameras"}
                    >
                        {isBroadcasting ? <Mic className="h-8 w-8 animate-pulse text-foreground fill-white" /> : <MicOff className="h-8 w-8 opacity-50" />}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default MultiLiveFeed;
