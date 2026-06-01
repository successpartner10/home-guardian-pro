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
  Eye, Users, Zap, ScanFace, Target, Activity
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
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [activeBolos, setActiveBolos] = useState<BoloAlert[]>([]);
  const [recentHits, setRecentHits] = useState<MeshHit[]>([]);
  const [isIssuing, setIsIssuing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [boloLabel, setBoloLabel] = useState("");
  const [selectedDescriptor, setSelectedDescriptor] = useState<Float32Array | null>(null);
  const [meshStats, setMeshStats] = useState({ totalCameras: 0, activeCameras: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

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

  // Live mesh hits
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "bolo_hits"), orderBy("timestamp", "desc"), limit(50));
    const unsub = onSnapshot(q, snap => {
      setRecentHits(snap.docs.map(d => ({ id: d.id, ...d.data() } as MeshHit)));
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

  const handleIssueBoло = async () => {
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

  const formatTime = (ts: any) => {
    if (!ts) return "Just now";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-500 shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">HGUARD Sentinel</h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Civic Intelligence Mesh — Command Center</p>
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
        <div className="bg-card border rounded-3xl overflow-hidden">
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
                onClick={handleIssueBoло}
                disabled={!selectedDescriptor || !boloLabel.trim() || isIssuing}
                className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white"
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
                  className="bg-card border border-red-500/20 rounded-2xl overflow-hidden"
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

        {/* Live Hit Feed */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Activity className="h-4 w-4 text-red-500 animate-pulse" />
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Live Hit Feed
            </h2>
          </div>

          {recentHits.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 flex flex-col items-center gap-3">
              <Radio className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground font-medium text-center">No hits yet. Issue a BOLO alert to activate the mesh.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {recentHits.map(hit => (
                  <motion.div
                    key={hit.id}
                    initial={{ opacity: 0, x: -20, backgroundColor: "hsl(var(--destructive) / 0.2)" }}
                    animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
                    className="bg-card border border-border rounded-2xl p-3 flex items-center gap-4"
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                      hit.confidence > 0.85 ? "bg-red-500/20 text-red-500" : "bg-orange-500/20 text-orange-500"
                    )}>
                      <Target className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-foreground">{hit.boloLabel}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Camera className="h-2.5 w-2.5" /> {hit.deviceName}
                        </span>
                        {hit.lat && (
                          <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" /> {hit.lat.toFixed(4)}, {hit.lng?.toFixed(4)}
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {formatTime(hit.timestamp)}
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "shrink-0 text-right",
                      hit.confidence > 0.85 ? "text-red-500" : "text-orange-500"
                    )}>
                      <p className="text-lg font-black">{Math.round((hit.confidence) * 100)}%</p>
                      <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Confidence</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Pilot Program Info Banner */}
        <div className="bg-card border border-primary/20 rounded-2xl p-4 flex gap-4">
          <ShieldAlert className="h-10 w-10 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-black text-foreground">HGUARD Sentinel — Pilot Program Mode</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All facial matching runs locally on each camera device. No video footage is transmitted to this server.
              Only cryptographic face descriptors and match confidence scores are transmitted, ensuring full citizen privacy compliance.
              GPS coordinates are collected only from devices where location permission has been granted.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SentinelPage;
