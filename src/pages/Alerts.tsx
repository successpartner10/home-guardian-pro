import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Check, Trash2, AlertTriangle, X, Play, Share2, Download, Pause, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { localFileSystem } from "@/lib/localFileSystem";
import { googleDrive } from "@/lib/googleDrive";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  user_id: string;
  device_id: string;
  type: string;
  thumbnail_url?: string | null;
  summary?: string | null;
  viewed: boolean;
  starred?: boolean;
  created_at: any;
  device_name?: string;
}

/** Build a playable blob URL from a Local Storage file */
const useVideoBlob = (filename: string | null | undefined, providerToken?: string) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filename) return;

    // If it's a legacy Drive URL or a full URL, just use it directly
    if (filename.startsWith("http")) {
      setBlobUrl(filename);
      return;
    }

    let cancelled = false;
    const fetchBlob = async () => {
      setLoading(true);
      try {
        if (providerToken) {
          const fileId = await googleDrive.getFileIdByName(filename, providerToken);
          if (fileId) {
            const blob = await googleDrive.downloadFile(fileId, providerToken);
            if (blob && !cancelled) {
              setBlobUrl(URL.createObjectURL(blob));
              return;
            }
          }
        }

        const isReady = await localFileSystem.init();
        if (!isReady) throw new Error("Local Storage Hub not connected");

        const files = await localFileSystem.listFiles();
        const file = files.find(f => f.name === filename);
        if (!file) throw new Error(`File ${filename} not found in Local Storage or Google Drive`);

        const handle = await file.handle.getFile();
        if (!cancelled) setBlobUrl(URL.createObjectURL(handle));
      } catch (e) {
        console.error("Local video fetch error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBlob();
    return () => { cancelled = true; };
  }, [filename]);

  return { blobUrl, loading };
};

const VideoThumbnail = ({ url, onClick, providerToken }: { url: string | null | undefined; onClick: () => void; providerToken?: string }) => {
  const { blobUrl, loading } = useVideoBlob(url, providerToken);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!url) {
    return (
      <div className="h-full w-full flex items-center justify-center cursor-pointer" onClick={onClick}>
        <AlertTriangle className="h-8 w-8 text-muted-foreground/20" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full cursor-pointer group/thumb" onClick={onClick}>
      {loading ? (
        <div className="h-full w-full flex items-center justify-center bg-zinc-900/80">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : blobUrl ? (
        <video
          ref={videoRef}
          src={blobUrl}
          className="h-full w-full object-cover"
          muted
          preload="metadata"
          onLoadedMetadata={() => {
            if (videoRef.current) videoRef.current.currentTime = 1;
          }}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/20" />
        </div>
      )}
      {/* Play Icon Overlay */}
      <div className="absolute inset-0 bg-zinc-900/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
        <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
          <Play className="text-white w-7 h-7 ml-1" fill="white" />
        </div>
      </div>
    </div>
  );
};

const VideoModal = ({ alert, onClose, providerToken }: { alert: Alert; onClose: () => void; providerToken?: string }) => {
  const { blobUrl, loading } = useVideoBlob(alert.thumbnail_url, providerToken);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const shareAlert = async () => {
    const shareData: ShareData = {
      title: `hGuard Security Alert`,
      text: `Alert from ${alert.device_name || "Camera"}: ${alert.type.includes('motion') ? 'Motion' : 'Sound'} detected at ${new Date(alert.created_at?.toDate ? alert.created_at.toDate() : alert.created_at).toLocaleString()}.`,
      url: alert.thumbnail_url || window.location.origin
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url!);
      }
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  const downloadVideo = () => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `hguard-alert-${alert.id}.webm`;
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 bg-zinc-950/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative max-w-5xl w-full aspect-video bg-zinc-950 rounded-[2.5rem] overflow-hidden shadow-2xl border-2 border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white/70">
            <div className="h-12 w-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-black uppercase tracking-widest">Loading Video...</p>
          </div>
        ) : blobUrl ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={blobUrl}
              className="w-full h-full object-contain"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              controls={false}
            />
            {/* Custom Play/Pause overlay */}
            {!isPlaying && (
              <div
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                onClick={togglePlay}
              >
                <div className="h-24 w-24 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border-2 border-white/20 hover:bg-white/20 transition-all">
                  <Play className="text-white w-12 h-12 ml-2" fill="white" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white/60">
            <AlertTriangle className="w-20 h-20" />
            <p className="text-xl font-black uppercase tracking-widest">Video unavailable</p>
          </div>
        )}

        <div className="absolute top-6 right-6 flex gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-2xl bg-zinc-900/70 border-2 border-white/20 hover:bg-white/10 hover:border-white/40 text-white backdrop-blur-md"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-2">Security Event Log</p>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                {alert.type.includes('motion') ? 'Motion' : 'Sound'} Detected
              </h2>
              <p className="text-lg font-bold text-white/60 tracking-tight">
                {alert.device_name || "Unknown Camera"} · {new Date(alert.created_at?.toDate ? alert.created_at.toDate() : alert.created_at).toLocaleString()}
              </p>
              {alert.summary && (
                <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-2xl backdrop-blur-md max-w-2xl">
                  <p className="text-sm font-bold text-primary/90 leading-relaxed italic">
                    "{alert.summary}"
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-14 px-6 rounded-2xl font-black uppercase tracking-widest bg-white/5 border-2 border-white/10 hover:bg-white/10 text-white"
                onClick={shareAlert}
              >
                <Share2 className="h-5 w-5" />
              </Button>
              <Button
                className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest bg-white text-black hover:bg-white/80"
                onClick={downloadVideo}
              >
                <Download className="h-5 w-5 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Alerts = () => {
  const { user } = useAuth();
  // providerToken fallback - might need better way to persist this across sessions if needed
  const providerToken = localStorage.getItem("google_drive_token") || undefined;
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    if (!user) return;

    // Single-field query to avoid composite index requirement  
    const alertsQuery = query(
      collection(db, "alerts"),
      where("user_id", "==", user.uid)
    );

    const unsubscribe = onSnapshot(alertsQuery, async (snapshot) => {
      const alertList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));

      // Sort client-side (newest first)
      alertList.sort((a, b) => {
        const timeA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
        const timeB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
        return timeB.getTime() - timeA.getTime();
      });

      // Fetch device names for each alert
      const deviceIds = Array.from(new Set(alertList.map(a => a.device_id)));
      const deviceMap: Record<string, string> = {};

      for (const dId of deviceIds) {
        if (!dId) continue;
        try {
          const { getDoc: getDocById } = await import('firebase/firestore');
          const deviceSnap = await getDocById(doc(db, "devices", dId));
          if (deviceSnap.exists()) {
            deviceMap[dId] = deviceSnap.data().name;
          }
        } catch (e) {
          console.warn("Could not fetch device name for", dId);
        }
      }

      const enrichedAlerts = alertList.map(a => ({
        ...a,
        device_name: deviceMap[a.device_id] || "Unknown Camera"
      }));

      setAlerts(enrichedAlerts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "alerts", id), { viewed: true });
    } catch (e) {
      console.error("Failed to mark as read", e);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const allQuery = query(collection(db, "alerts"), where("user_id", "==", user.uid));
    const snapshot = await getDocs(allQuery);
    const unreadDocs = snapshot.docs.filter(d => d.data().viewed === false);

    for (let i = 0; i < unreadDocs.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = unreadDocs.slice(i, i + 500);
      chunk.forEach(d => batch.update(d.ref, { viewed: true }));
      await batch.commit();
    }
  };

  const deleteAllAlerts = async () => {
    if (!user || allAlerts.length === 0) return;
    if (!confirm("Are you sure you want to delete all events? This will permanently remove all video recordings from your storage.")) return;

    toast({ title: "Cleaning up...", description: "Removing files and records. Please wait." });

    try {
      // 1. Identify all file names to delete
      const fileNames = Array.from(new Set(allAlerts.map(a => a.thumbnail_url).filter(Boolean))) as string[];

      // 2. Delete from Local File System (Full Wipe for clean slate)
      await localFileSystem.init();
      if (localFileSystem.isReady()) {
        const allLocalFiles = await localFileSystem.listFiles();
        const names = allLocalFiles.map(f => f.name);
        if (names.length > 0) {
          console.log("[Alerts] Wiping all local files:", names.length);
          await localFileSystem.deleteFiles(names);
        }
      }

      // 3. Delete from Google Drive if possible (Database-driven for safety)
      if (providerToken && fileNames.length > 0) {
        console.log("[Alerts] Deleting Google Drive files...");
        for (const name of fileNames) {
          const fileId = await googleDrive.getFileIdByName(name, providerToken);
          if (fileId) await googleDrive.deleteFile(fileId, providerToken);
        }
      }

      // 4. Delete Firestore records in batches of 500
      const allQuery = query(collection(db, "alerts"), where("user_id", "==", user.uid));
      const snapshot = await getDocs(allQuery);

      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      toast({ title: "History Cleared", description: `Successfully deleted ${docs.length} events and associated videos.` });
    } catch (e) {
      console.error("Failed to delete all alerts", e);
      toast({ title: "Partial Success", description: "Some records or files could not be deleted.", variant: "destructive" });
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await deleteDoc(doc(db, "alerts", id));
    } catch (e) {
      console.error("Failed to delete alert", e);
    }
  };

  const shareAlert = async (alert: Alert) => {
    const alertTime = alert.created_at?.toDate ? alert.created_at.toDate() : alert.created_at;
    const shareData: ShareData = {
      title: `hGuard Security Alert`,
      text: `Alert from ${alert.device_name || "Camera"}: ${alert.type.includes('motion') ? 'Motion' : 'Sound'} detected at ${new Date(alertTime).toLocaleString()}.`,
      url: alert.thumbnail_url || window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url!);
        toast({ title: "Link Copied", description: "Alert link copied to clipboard." });
      }
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  // Merge pending cam alerts with db alerts
  const [pendingAlerts] = useState<any[]>(() => {
    const saved = localStorage.getItem("pending_cam_alerts");
    return saved ? JSON.parse(saved) : [];
  });

  const allAlerts = [...pendingAlerts, ...alerts].sort(
    (a, b) => {
      const timeA = a.created_at?.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at).getTime();
      const timeB = b.created_at?.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at).getTime();
      return timeB - timeA;
    }
  );

  return (
    <AppLayout>
      <div className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Events</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest opacity-60">Security Timeline</p>
          </div>
          <div className="flex gap-2">
            {allAlerts.some((a) => !a.viewed) && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-2 h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                <Check className="h-4 w-4" /> All Read
              </Button>
            )}
            {allAlerts.length > 0 && (
              <Button variant="outline" size="sm" onClick={deleteAllAlerts} className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-2 h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse bg-card/40 border-border/50 rounded-3xl h-24" />
            ))}
          </div>
        ) : allAlerts.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted/50 border border-dashed border-border/50 shadow-inner">
              <BellOff className="h-10 w-10 text-muted-foreground opacity-30" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold uppercase tracking-tight">Safe & Sound</h2>
              <p className="text-sm text-muted-foreground max-w-[200px] uppercase font-bold text-[10px] tracking-widest opacity-70">No activity detected.</p>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <Card
                    className={cn(
                      "group overflow-hidden border-2 transition-all duration-300 rounded-[2rem]",
                      !alert.viewed ? "bg-primary/5 border-primary/20 shadow-lg shadow-primary/10" : "bg-card/40 border-border/40 backdrop-blur-sm"
                    )}
                  >
                    <CardContent className="p-0 flex flex-col sm:flex-row items-stretch">
                      {/* Video Thumbnail Container */}
                      <div
                        className="relative w-full sm:w-40 aspect-video sm:aspect-auto bg-zinc-950 shrink-0 overflow-hidden"
                      >
                        <VideoThumbnail url={alert.thumbnail_url} onClick={() => setSelectedAlert(alert)} providerToken={providerToken} />
                      </div>

                      {/* Info Container */}
                      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              {!alert.viewed && <span className="h-2 w-2 rounded-full bg-primary" />}
                            <p className="text-sm font-black uppercase tracking-tight text-foreground/80">
                                {alert.summary || (alert.type.includes('motion') ? 'Motion Detected' : 'Sound Detected')}
                              </p>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60 truncate">
                              {alert.device_name || "Unknown Device"}
                            </p>
                            {alert.summary && (
                              <p className="text-xs font-bold text-muted-foreground italic mt-2 line-clamp-2">
                                "{alert.summary}"
                              </p>
                            )}
                          </div>
                          <span className="text-[9px] whitespace-nowrap font-black text-muted-foreground uppercase opacity-70 tracking-widest">
                            {formatDistanceToNow(alert.created_at?.toDate ? alert.created_at.toDate() : new Date(alert.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/10 sm:border-0 sm:mt-0 sm:pt-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-9 w-9 rounded-xl transition-colors border-2 border-transparent",
                              alert.starred ? "text-yellow-400 hover:text-yellow-300" : "text-muted-foreground hover:text-yellow-400 hover:border-yellow-400/20"
                            )}
                            onClick={async () => {
                              const { toggleStarAlert } = await import("@/hooks/useDriveStorage");
                              await toggleStarAlert(alert.id, !!alert.starred);
                            }}
                          >
                            <Star className={cn("h-4 w-4", alert.starred ? "fill-yellow-400" : "")} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary transition-colors border-2 border-transparent hover:border-primary/20"
                            onClick={() => shareAlert(alert)}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors border-2 border-transparent hover:border-primary/20"
                            onClick={() => markAsRead(alert.id)}
                            disabled={alert.viewed}
                          >
                            <Check className="h-3.5 w-3.5 mr-1.5" /> {alert.viewed ? 'Read' : 'Mark Read'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAlert(alert.id)}
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all border-2 border-transparent hover:border-destructive/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Video Detail Modal */}
      <AnimatePresence>
        {selectedAlert && <VideoModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} providerToken={providerToken} />}
      </AnimatePresence>
    </AppLayout>
  );
};

export default Alerts;
