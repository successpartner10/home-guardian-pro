// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
import React, { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  collection, doc, setDoc, getDocs, onSnapshot,
  deleteDoc, serverTimestamp, addDoc, query, orderBy, limit
} from "firebase/firestore";
import {
  ShieldAlert, Upload, X, Radio, MapPin, Camera,
  Clock, CheckCircle, AlertTriangle, Loader2, Trash2,
  Eye, Users, Zap, ScanFace, Target, Activity, FileText,
  Volume2, ShieldAlert as AlertIcon, ShieldCheck, Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as faceapi from "@vladmandic/face-api";

interface BoloAlert {
  id: string;
  label: string;
  descriptor: number[];
  imageUrl: string;
  status: "active" | "resolved";
  issuedAt: string;
  hitCount: number;
}

interface MeshHit {
  id: string;
  boloId: string;
  boloLabel: string;
  deviceName: string;
  confidence: number;
  imageUrl?: string;
  lat?: number;
  lng?: number;
  timestamp: any;
}

const SentinelPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [activeBolos, setActiveBolos] = useState<BoloAlert[]>([]);
  const [recentHits, setRecentHits] = useState<MeshHit[]>([]);
  const [isIssuing, setIsIssuing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [boloLabel, setBoloLabel] = useState("");
  const [selectedDescriptor, setSelectedDescriptor] = useState<Float32Array | null>(null);
  const [meshStats, setMeshStats] = useState({ totalCameras: 0, activeCameras: 0 });
  const [isEulaAccepted, setIsEulaAccepted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  
  // Track already-notified hits to avoid duplicate sound/push triggers
  const notifiedHitsRef = useRef<Set<string>>(new Set());

  // Check EULA on mount
  useEffect(() => {
    const accepted = localStorage.getItem("hguard_sentinel_eula_accepted");
    if (accepted === "true") {
      setIsEulaAccepted(true);
    }
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Web Audio API Synthesized Sonar Ping
  const playSonarPing = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      // High-pitched tactical sonar frequency sweeping downward
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 1.0);
      
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 1.0);
    } catch (e) {
      console.warn("Audio context failed", e);
    }
  };

  // Trigger HTML5 Native Notification
  const triggerPushNotification = (hit: MeshHit) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const confidencePercent = Math.round(hit.confidence * 100);
      new Notification(`🎯 CRITICAL BOLO HIT: ${hit.boloLabel}`, {
        body: `Match found on ${hit.deviceName} with ${confidencePercent}% confidence score. Location tracked.`,
        icon: "/favicon.ico"
      });
    }
  };

  // Load face-api models
  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        setModelsLoaded(true);
      } catch (e) {
        console.error("Model load error:", e);
      }
    };
    load();
  }, []);

  // Live BOLO feed
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "bolo_alerts"), snap => {
      setActiveBolos(snap.docs.map(d => ({ id: d.id, ...d.data() } as BoloAlert)));
    });
    return () => unsub();
  }, [user]);

  // Live mesh hits with Ranked Alarm system
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "bolo_hits"), orderBy("timestamp", "desc"), limit(100));
    const unsub = onSnapshot(q, snap => {
      const hits = snap.docs.map(d => ({ id: d.id, ...d.data() } as MeshHit));
      setRecentHits(hits);

      // Check if there's any new hit we haven't seen in this session
      let hasNewCriticalHit = false;
      hits.forEach(hit => {
        if (!notifiedHitsRef.current.has(hit.id)) {
          notifiedHitsRef.current.add(hit.id);
          hasNewCriticalHit = true;
          // Trigger push notification
          triggerPushNotification(hit);
        }
      });

      if (hasNewCriticalHit) {
        playSonarPing();
        toast({
          title: "🎯 CRITICAL BOLO TARGET IDENTIFIED",
          description: "A camera node has reported a matching face descriptor above 60% confidence.",
          variant: "destructive"
        });
      }
    });
    return () => unsub();
  }, [user]);

  // Mesh stats
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "devices"), snap => {
      const all = snap.docs.map(d => d.data());
      const cameras = all.filter(d => d.type === "camera");
      const active = cameras.filter(d => d.status === "online");
      setMeshStats({ totalCameras: cameras.length, activeCameras: active.length });
    });
    return () => unsub();
  }, [user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modelsLoaded) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewImage(dataUrl);

      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        try {
          const detection = await faceapi.detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            toast({ title: "No face detected", description: "Please upload a clear, front-facing photo.", variant: "destructive" });
            setPreviewImage(null);
            return;
          }
          setSelectedDescriptor(detection.descriptor);
          toast({ title: "Face signature extracted", description: "Ready to issue BOLO alert to the mesh." });
        } catch (e) {
          toast({ title: "Scan failed", variant: "destructive" });
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleIssueBolo = async () => {
    if (!user || !selectedDescriptor || !boloLabel.trim() || !previewImage) return;
    setIsIssuing(true);
    try {
      const boloId = `bolo_${Date.now()}`;
      await setDoc(doc(db, "bolo_alerts", boloId), {
        label: boloLabel.trim(),
        descriptor: Array.from(selectedDescriptor),
        imageUrl: previewImage,
        status: "active",
        issuedBy: user.uid,
        issuedAt: new Date().toISOString(),
        hitCount: 0,
      });

      toast({ title: "⚡ BOLO Alert Issued", description: `Pushing "${boloLabel}" to all ${meshStats.activeCameras} active cameras in real-time.` });
      setPreviewImage(null);
      setSelectedDescriptor(null);
      setBoloLabel("");
    } catch (e) {
      toast({ title: "Failed to issue BOLO", variant: "destructive" });
    }
    setIsIssuing(false);
  };

  const handleResolveBolo = async (id: string) => {
    await deleteDoc(doc(db, "bolo_alerts", id));
    toast({ title: "BOLO Resolved", description: "Alert has been cleared from all camera nodes." });
  };

  const acceptEula = () => {
    localStorage.setItem("hguard_sentinel_eula_accepted", "true");
    setIsEulaAccepted(true);
    playSonarPing();
  };

  const formatTime = (ts: any) => {
    if (!ts) return "Just now";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Group and sort hits by Confidence Score % (highest first)
  const sortedAndGroupedHits = recentHits.sort((a, b) => b.confidence - a.confidence);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24">

        {/* EULA Legal Lock & Privacy Guard Modal */}
        <AnimatePresence>
          {!isEulaAccepted && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-xl p-4 overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative"
              >
                <div className="flex items-center gap-3 text-amber-500">
                  <ShieldCheck className="h-8 w-8 shrink-0" />
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-foreground">Proprietary IP & EULA Agreement</h2>
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">HGUARD Sentinel Municipal Dragnet Technology</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-3 max-h-[300px] overflow-y-auto pr-2 border-y py-3 border-border font-medium leading-relaxed">
                  <p className="font-bold text-foreground">IMPORTANT LEGAL NOTICE FOR MUNICIPAL & PRIVATE USERS:</p>
                  <p>
                    By clicking "Accept & Proceed", you acknowledge and agree that this software, the decentralized edge BOLO payload push synchronization method, and the 128D mathematical facial signature matching algorithms are the **proprietary intellectual property** of Successpartner10, protected under Title 17 of the United States Code (Copyright), Trade Secret protection guidelines, and pending patent applications.
                  </p>
                  <p className="font-bold text-foreground">1. RESTRICTIONS ON USE & CLONING:</p>
                  <p>
                    Any attempt to decompile, reverse-engineer, mirror, or build a derivative municipal tracking mesh based on this software architecture without an explicit, signed enterprise white-label license contract from Successpartner10 is strictly prohibited and subject to civil prosecution.
                  </p>
                  <p className="font-bold text-foreground">2. PRIVACY & COMPLIANCE STATEMENTS:</p>
                  <p>
                    HGUARD operates on a "Privacy-First" model. Standard video streams are analyzed locally and discarded immediately. No video frames of uninvolved citizens are ever transmitted or saved to the server. The operator accepts all liability regarding regional consent laws when deploying edge nodes.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    onClick={acceptEula}
                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Accept Proprietary EULA & Enter Command
                  </Button>
                  <p className="text-[9px] text-center text-muted-foreground font-semibold">
                    Authorized municipal use only. System access logs are securely audited.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-500 shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">HGUARD Sentinel</h1>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Civic Intelligence Mesh — Command Center</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn("h-9 rounded-xl border-border px-3 font-bold", soundEnabled ? "text-red-500" : "text-muted-foreground")}
            >
              <Volume2 className="h-4 w-4 mr-2" />
              {soundEnabled ? "Audio Alarm On" : "Audio Alarm Muted"}
            </Button>
          </div>
        </div>

        {/* Mesh Status Bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Camera, label: "Total Nodes", value: meshStats.totalCameras, color: "text-blue-500" },
            { icon: Radio, label: "Online Now", value: meshStats.activeCameras, color: "text-green-500" },
            { icon: AlertTriangle, label: "Active BOLOs", value: activeBolos.filter(b => b.status === "active").length, color: "text-red-500" },
          ].map(stat => (
            <div key={stat.label} className="bg-card border rounded-2xl p-4 flex flex-col items-center text-center gap-1">
              <stat.icon className={cn("h-5 w-5", stat.color)} />
              <p className="text-2xl font-black text-foreground">{stat.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Issue BOLO */}
        <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-red-500/5 flex items-center gap-3">
            <ScanFace className="h-5 w-5 text-red-500" />
            <h2 className="text-foreground font-black uppercase tracking-wide text-sm">Issue New BOLO Alert</h2>
            {!modelsLoaded && (
              <div className="ml-auto flex items-center gap-2 text-muted-foreground text-xs font-bold">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading AI models...
              </div>
            )}
          </div>
          <div className="p-4 grid md:grid-cols-2 gap-4">
            {/* Upload zone */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={!modelsLoaded}
              className={cn(
                "relative aspect-[4/3] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 overflow-hidden",
                previewImage ? "border-red-500/50" : "border-border hover:border-red-500/30 bg-muted/10"
              )}
            >
              {previewImage ? (
                <>
                  <img src={previewImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Subject" />
                  {selectedDescriptor && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/30 backdrop-blur-sm">
                      <CheckCircle className="h-10 w-10 text-green-400" />
                      <span className="text-sm font-black text-green-400">Face Encoded ✓</span>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewImage(null); setSelectedDescriptor(null); }}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 flex items-center justify-center text-foreground hover:bg-background z-10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-xs font-bold text-muted-foreground text-center px-4">Upload subject photo<br />AI will extract face signature</p>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

            {/* Details */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5">Subject ID / Case Label</label>
                  <Input
                    placeholder="e.g. AMBER-2026-007 / John Doe"
                    value={boloLabel}
                    onChange={(e) => setBoloLabel(e.target.value)}
                    className="h-12 bg-muted/20 border-border rounded-xl font-bold"
                  />
                </div>
                <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-1.5 w-1.5 rounded-full", modelsLoaded ? "bg-green-500" : "bg-orange-500 animate-pulse")} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {modelsLoaded ? "Neural engine ready" : "Loading models..."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-1.5 w-1.5 rounded-full", selectedDescriptor ? "bg-green-500" : "bg-border")} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {selectedDescriptor ? "Face signature extracted (128D)" : "Awaiting subject photo"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-1.5 w-1.5 rounded-full", meshStats.activeCameras > 0 ? "bg-green-500 animate-pulse" : "bg-border")} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {meshStats.activeCameras} camera nodes online
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleIssueBolo}
                disabled={!selectedDescriptor || !boloLabel.trim() || isIssuing}
                className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]"
              >
                {isIssuing ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Zap className="h-5 w-5 mr-2" />
                )}
                {isIssuing ? "Broadcasting..." : "Issue BOLO to All Cameras"}
              </Button>
            </div>
          </div>
        </div>

        {/* Active BOLOs */}
        {activeBolos.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">
              Active Alerts ({activeBolos.length})
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {activeBolos.map(bolo => (
                <motion.div
                  key={bolo.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-red-500/20 rounded-2xl overflow-hidden shadow-sm"
                >
                  <div className="flex gap-3 p-3">
                    {bolo.imageUrl && (
                      <img src={bolo.imageUrl} className="h-16 w-16 rounded-xl object-cover border border-border shrink-0" alt="Subject" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-foreground text-sm leading-tight">{bolo.label}</p>
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                            {bolo.hitCount || 0} hits · Active
                          </p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-[8px] font-black uppercase animate-pulse">LIVE</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveBolo(bolo.id)}
                          className="h-7 rounded-lg text-[9px] font-black uppercase tracking-wider border-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Live Ranked Alarm Grid */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1 justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500 animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Ranked Match Alarm Grid (Highest Confidence First)
              </h2>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
              AUTO-RANKED BY %
            </span>
          </div>

          {sortedAndGroupedHits.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 flex flex-col items-center gap-3">
              <Radio className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
              <p className="text-xs text-muted-foreground font-medium text-center">
                Scanning mesh... Active AMBER Alert cameras are online.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <AnimatePresence>
                {sortedAndGroupedHits.map((hit, idx) => {
                  const isCritical = hit.confidence >= 0.80;
                  return (
                    <motion.div
                      key={hit.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "relative bg-card border rounded-2xl p-4 overflow-hidden flex flex-col justify-between gap-4 shadow-sm",
                        isCritical 
                          ? "border-red-500/40 bg-red-500/[0.02] shadow-[0_0_20px_rgba(239,68,68,0.05)]" 
                          : "border-border hover:border-amber-500/30"
                      )}
                    >
                      {/* Alarm flashing overlay for critical */}
                      {isCritical && (
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-red-500 animate-pulse" />
                      )}

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                            isCritical ? "bg-red-500/20 text-red-500" : "bg-amber-500/20 text-amber-500"
                          )}>
                            <Target className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="font-black text-sm text-foreground">{hit.boloLabel}</p>
                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                              <Camera className="h-2.5 w-2.5" /> {hit.deviceName}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={cn(
                            "text-xl font-black",
                            isCritical ? "text-red-500" : "text-amber-500"
                          )}>
                            {Math.round(hit.confidence * 100)}%
                          </span>
                          <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Confidence</p>
                        </div>
                      </div>

                      {/* Location & Time telemetry bar */}
                      <div className="flex items-center justify-between p-2 bg-muted/40 rounded-xl border border-border/40 text-[9px] font-bold text-muted-foreground uppercase flex-wrap gap-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary shrink-0" />
                          <span>{hit.lat && hit.lng ? `${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)}` : "Location Unknown"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{formatTime(hit.timestamp)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Pilot Program Info Banner */}
        <div className="bg-card border border-primary/20 rounded-2xl p-4 flex gap-4 shadow-sm">
          <ShieldAlert className="h-10 w-10 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-black text-foreground">HGUARD Sentinel — Municipal Dragnet Mesh</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All facial matching and geometric analysis run locally on opted-in cameras. No video stream data ever leaves the device.
              Only 128D cryptographic descriptors and confidence vectors are transmitted, achieving full municipal compliance.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SentinelPage;
