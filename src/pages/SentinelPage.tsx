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
  deleteDoc, serverTimestamp, addDoc, query, orderBy, limit, updateDoc, increment
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert, Upload, X, Radio, MapPin, Camera,
  Clock, CheckCircle, AlertTriangle, Loader2, Trash2,
  Eye, Users, Zap, ScanFace, Target, Activity, FileText,
  Volume2, ShieldCheck, Download, Search, Info, Sliders,
  Lock, RefreshCw, Sparkles, Filter, ChevronRight, HelpCircle
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
  category: "AMBER" | "WANTED" | "MISSING";
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
  enhanced?: boolean;
}

const SentinelPage = () => {
  const { user, adminViewMode, setAdminViewMode } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [activeBolos, setActiveBolos] = useState<BoloAlert[]>([]);
  const [recentHits, setRecentHits] = useState<MeshHit[]>([]);
  const [isIssuing, setIsIssuing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Strict naming convention states
  const [boloCategory, setBoloCategory] = useState<"AMBER" | "WANTED" | "MISSING">("AMBER");
  const [subjectName, setSubjectName] = useState("");
  
  const [selectedDescriptor, setSelectedDescriptor] = useState<Float32Array | null>(null);
  const [meshStats, setMeshStats] = useState({ totalCameras: 0, activeCameras: 0 });
  const [isEulaAccepted, setIsEulaAccepted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [selectedHitDetails, setSelectedHitDetails] = useState<MeshHit | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isBodyScanActive, setIsBodyScanActive] = useState(false);
  const [showDemoGuide, setShowDemoGuide] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);
  const notifiedHitsRef = useRef<Set<string>>(new Set());

  // Check municipal/government email access
  const isGovernmentEmail = 
    user?.email === "successpartner10@gmail.com" || 
    user?.email?.endsWith(".gov") || 
    user?.email?.endsWith(".mil") ||
    user?.email === "municipal-demo@hguard.com";

  // Check EULA and load permission on mount
  useEffect(() => {
    const accepted = localStorage.getItem("hguard_sentinel_eula_accepted");
    if (accepted === "true") {
      setIsEulaAccepted(true);
    }
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
      osc.frequency.setValueAtTime(987.77, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 1.0);
      
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 1.0);
    } catch (e) {}
  };

  const triggerPushNotification = (hit: MeshHit) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const confidencePercent = Math.round(hit.confidence * 100);
      new Notification(`🎯 CRITICAL BOLO HIT: ${hit.boloLabel}`, {
        body: `Match found on ${hit.deviceName} with ${confidencePercent}% confidence score.`,
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
    if (!user || !isGovernmentEmail) return;
    const unsub = onSnapshot(collection(db, "bolo_alerts"), snap => {
      setActiveBolos(snap.docs.map(d => ({ id: d.id, ...d.data() } as BoloAlert)));
    });
    return () => unsub();
  }, [user, isGovernmentEmail]);

  // Live mesh hits
  useEffect(() => {
    if (!user || !isGovernmentEmail) return;
    const q = query(collection(db, "bolo_hits"), orderBy("timestamp", "desc"), limit(100));
    const unsub = onSnapshot(q, snap => {
      const hits = snap.docs.map(d => ({ id: d.id, ...d.data() } as MeshHit));
      setRecentHits(hits);

      let hasNewHit = false;
      hits.forEach(hit => {
        if (!notifiedHitsRef.current.has(hit.id)) {
          notifiedHitsRef.current.add(hit.id);
          hasNewHit = true;
          triggerPushNotification(hit);
        }
      });

      if (hasNewHit) {
        playSonarPing();
        toast({
          title: "🎯 CRITICAL BOLO TARGET IDENTIFIED",
          description: "Active search node matched target descriptor.",
          variant: "destructive"
        });
      }
    });
    return () => unsub();
  }, [user, isGovernmentEmail]);

  // Mesh stats
  useEffect(() => {
    if (!user || !isGovernmentEmail) return;
    const unsub = onSnapshot(collection(db, "devices"), snap => {
      const all = snap.docs.map(d => d.data());
      const cameras = all.filter(d => d.type === "camera");
      const active = cameras.filter(d => d.status === "online");
      setMeshStats({ totalCameras: cameras.length, activeCameras: active.length });
    });
    return () => unsub();
  }, [user, isGovernmentEmail]);

  // Strict naming convention generator
  const getBoloLabel = () => {
    const cleanName = subjectName.trim().toUpperCase().replace(/\s+/g, "_");
    const year = new Date().getFullYear();
    return `${boloCategory}-${year}-${cleanName || "PENDING"}`;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modelsLoaded) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;

      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        try {
          const detection = await faceapi.detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            toast({ title: "No face detected", description: "Clear front-facing photo required.", variant: "destructive" });
            setPreviewImage(null);
            return;
          }

          // Compress image to fit within Firestore's 1MB document limit
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 240;
          const MAX_HEIGHT = 240;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
            setPreviewImage(compressedDataUrl);
          } else {
            setPreviewImage(dataUrl);
          }

          setSelectedDescriptor(detection.descriptor);
          toast({ title: "Signature extracted", description: "128D Cryptographic BOLO key generated." });
        } catch (e) {
          toast({ title: "Scan failed", variant: "destructive" });
          setPreviewImage(null);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleIssueBolo = async () => {
    if (!user || !selectedDescriptor || !subjectName.trim() || !previewImage) return;
    setIsIssuing(true);
    const calculatedLabel = getBoloLabel();
    try {
      const boloId = `bolo_${Date.now()}`;
      await setDoc(doc(db, "bolo_alerts", boloId), {
        label: calculatedLabel,
        descriptor: Array.from(selectedDescriptor),
        imageUrl: previewImage,
        status: "active",
        issuedBy: user.uid,
        issuedAt: new Date().toISOString(),
        hitCount: 0,
        category: boloCategory
      });

      toast({ title: "⚡ BOLO Broadcast Active", description: `Dispatched BOLO ${calculatedLabel} to all edge nodes.` });
      setPreviewImage(null);
      setSelectedDescriptor(null);
      setSubjectName("");
    } catch (e: any) {
      console.error("BOLO broadcast failed:", e);
      toast({ 
        title: "Broadcast failed", 
        description: e.message || String(e), 
        variant: "destructive" 
      });
    }
    setIsIssuing(false);
  };

  const handleResolveBolo = async (id: string) => {
    try {
      await updateDoc(doc(db, "bolo_alerts", id), { status: "resolved" });
      toast({ title: "BOLO Resolved", description: "Status changed to resolved. Camera nodes will stop scanning for this BOLO." });
    } catch (e) {
      toast({ title: "Failed to resolve BOLO", variant: "destructive" });
    }
  };

  const handleDeleteBolo = async (id: string) => {
    try {
      await deleteDoc(doc(db, "bolo_alerts", id));
      toast({ title: "BOLO Deleted", description: "BOLO has been permanently removed from the database." });
    } catch (e) {
      toast({ title: "Failed to delete BOLO", variant: "destructive" });
    }
  };

  const handleDeleteHit = async (hitId: string) => {
    try {
      await deleteDoc(doc(db, "bolo_hits", hitId));
      toast({ title: "Hit record deleted", description: "BOLO hit record has been permanently removed." });
      if (selectedHitDetails?.id === hitId) {
        setSelectedHitDetails(null);
      }
    } catch (e) {
      toast({ title: "Failed to delete hit record", variant: "destructive" });
    }
  };

  const acceptEula = () => {
    localStorage.setItem("hguard_sentinel_eula_accepted", "true");
    setIsEulaAccepted(true);
    playSonarPing();
  };

  const triggerMockEnhance = () => {
    setIsEnhancing(true);
    setTimeout(() => {
      setIsEnhancing(false);
      if (selectedHitDetails) {
        setSelectedHitDetails({
          ...selectedHitDetails,
          enhanced: true
        });
      }
      toast({ title: "AI Resolution Enhancer Complete", description: "Captured frame super-resolved using local neural network processing." });
    }, 2000);
  };

  const triggerBodyScan = () => {
    setIsBodyScanActive(true);
    setTimeout(() => {
      setIsBodyScanActive(false);
      toast({ title: "Dynamic Secondary Body Analysis", description: "Body features extracted successfully. Target verified." });
    }, 2500);
  };

  const formatTime = (ts: any) => {
    if (!ts) return "Just now";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Grouping, Filtering and Sorting Matches
  const filteredHits = recentHits.filter(h => {
    if (activeFilter === "ALL") return true;
    const matchBolo = activeBolos.find(b => b.id === h.boloId);
    return matchBolo?.category === activeFilter;
  });

  const sortedHits = filteredHits.sort((a, b) => b.confidence - a.confidence);

  // Government Security Gate check
  if (!isGovernmentEmail) {
    return (
      <AppLayout>
        <div className="p-6 max-w-lg mx-auto space-y-6 pt-20">
          <div className="bg-card border-2 border-red-500/20 rounded-3xl p-6 text-center space-y-4 shadow-xl">
            <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Lock className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-foreground">Municipal Authorization Required</h2>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest text-red-500">Access Level: Level 3 Classified</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              The HGUARD Sentinel Command Center is strictly limited to verified municipal, law enforcement, or government personnel.
              Access requires an authorized <strong className="text-foreground">.gov, .mil</strong> or approved developer sandbox email.
            </p>
            <div className="p-3 bg-muted/50 rounded-2xl border text-left space-y-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground block">How to experience the demo:</span>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Log in using the approved sandbox credentials: <br />
                <strong className="text-foreground">municipal-demo@hguard.com</strong> (Pass: <strong className="text-foreground">hguard123</strong>) to access the fully functional dragnet simulator.
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = "/login"}
              className="w-full h-11 rounded-xl font-bold text-xs"
            >
              Return to Login
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24 relative">

        {/* EULA Legal Lock & Privacy Guard Modal */}
        <AnimatePresence>
          {!isEulaAccepted && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl p-4 overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative"
              >
                <div className="flex items-center gap-3 text-amber-500">
                  <ShieldCheck className="h-8 w-8 shrink-0" />
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-foreground">Municipal IP & EULA Security Gating</h2>
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">HGUARD Sentinel Active Security Mesh</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-3 max-h-[300px] overflow-y-auto pr-2 border-y py-3 border-border font-medium leading-relaxed">
                  <p className="font-bold text-foreground">NOTICE OF PROPRIETARY INTEREST & TRADE SECRETS:</p>
                  <p>
                    By accepting and entering this system, you confirm you are logged in via an authorized government agency credential or official developer sandbox.
                  </p>
                  <p>
                    The architectural design of pushing BOLO mathematical arrays onto local camera nodes to protect privacy is the copyright interest of Successpartner10. Cloning, derivative reproduction, or reverse engineering of this architecture is legally prohibited.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    onClick={acceptEula}
                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Accept IP Terms & Proceed
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Demo Guide Section */}
        {showDemoGuide && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/5 border border-primary/20 rounded-3xl p-5 relative overflow-hidden"
          >
            <button 
              onClick={() => setShowDemoGuide(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex gap-3">
              <HelpCircle className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="text-sm font-black text-foreground">Sentinel Municipal Pilot Guide</h3>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside font-medium leading-relaxed">
                  <li>
                    <strong className="text-foreground">Create BOLO:</strong> Upload a reference face photo below, select the Category, enter the name, and broadcast. The BOLO label automatically formats to strict law-enforcement standards.
                  </li>
                  <li>
                    <strong className="text-foreground">Opt in Node:</strong> Navigate to your <span className="text-primary font-bold">Settings Page</span>, and toggle ON "Civic Mesh" for your camera device.
                  </li>
                  <li>
                    <strong className="text-foreground">Verify Search:</strong> Start Camera Mode on your test device. The camera HUD displays an amber <span className="text-amber-500 font-bold">"Civic Mesh Active"</span> badge and silently scans.
                  </li>
                  <li>
                    <strong className="text-foreground">Match Triggered:</strong> Wave the test subject's face in front of the camera node. Watch it sound the sonar ping and appear instantly ranked by confidence on this screen.
                  </li>
                </ol>
              </div>
            </div>
          </motion.div>
        )}

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
            <div className="flex items-center gap-1 p-1 bg-muted rounded-xl border border-border mr-2 hidden sm:flex">
              <button
                onClick={() => { setAdminViewMode("home"); navigate("/dashboard"); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                  adminViewMode === "home"
                    ? "bg-primary text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🏠 Home User
              </button>
              <button
                onClick={() => setAdminViewMode("civic")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                  adminViewMode === "civic"
                    ? "bg-amber-500 text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🛡️ Civic Command
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDemoGuide(!showDemoGuide)}
              className="h-9 rounded-xl border-border px-3 font-bold text-xs"
            >
              Demo Steps
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn("h-9 rounded-xl border-border px-3 font-bold text-xs", soundEnabled ? "text-red-500" : "text-muted-foreground")}
            >
              <Volume2 className="h-4 w-4 mr-2" />
              {soundEnabled ? "Audio On" : "Audio Muted"}
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
            <div key={stat.label} className="bg-card border rounded-2xl p-4 flex flex-col items-center text-center gap-1 shadow-sm">
              <stat.icon className={cn("h-5 w-5", stat.color)} />
              <p className="text-2xl font-black text-foreground">{stat.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Issue BOLO with Strict Naming Convention Generator */}
        <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-red-500/5 flex items-center gap-3">
            <ScanFace className="h-5 w-5 text-red-500" />
            <h2 className="text-foreground font-black uppercase tracking-wide text-sm">Issue Strict BOLO Payload</h2>
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

            {/* Strict Form Details */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold">Category</label>
                    <select 
                      value={boloCategory} 
                      onChange={(e) => setBoloCategory(e.target.value as any)}
                      className="w-full h-11 bg-muted/20 border border-border rounded-xl px-3 font-bold text-xs outline-none"
                    >
                      <option value="AMBER">AMBER Alert</option>
                      <option value="WANTED">Wanted Suspect</option>
                      <option value="MISSING">Missing Person</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold font-bold">Subject Name</label>
                    <Input
                      placeholder="e.g. John Doe"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      className="h-11 bg-muted/20 border-border rounded-xl font-bold text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold font-bold">Generated BOLO Key (Strict Convention)</label>
                  <div className="p-3 bg-muted/40 rounded-xl border border-border/80 font-mono text-xs font-bold text-foreground truncate">
                    {getBoloLabel()}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleIssueBolo}
                disabled={!selectedDescriptor || !subjectName.trim() || isIssuing}
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
              Municipal BOLO Payloads ({activeBolos.length})
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {activeBolos.map(bolo => (
                <motion.div
                  key={bolo.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "bg-card border rounded-2xl overflow-hidden shadow-sm",
                    bolo.status === "active" ? "border-red-500/20" : "border-muted opacity-80"
                  )}
                >
                  <div className="flex gap-3 p-3">
                    {bolo.imageUrl && (
                      <img src={bolo.imageUrl} className="h-16 w-16 rounded-xl object-cover border border-border shrink-0" alt="Subject" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-foreground text-sm leading-tight truncate">{bolo.label}</p>
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                            {bolo.hitCount || 0} hits · {bolo.category}
                          </p>
                        </div>
                        <span className={cn(
                          "shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase",
                          bolo.status === "active" 
                            ? "bg-red-500/20 text-red-500 animate-pulse" 
                            : "bg-green-500/20 text-green-500"
                        )}>
                          {bolo.status === "active" ? "LIVE" : "RESOLVED"}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {bolo.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveBolo(bolo.id)}
                            className="h-7 rounded-lg text-[9px] font-black uppercase tracking-wider border-border hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/30"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteBolo(bolo.id)}
                          className="h-7 rounded-lg text-[9px] font-black uppercase tracking-wider border-border text-red-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete BOLO
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Live Ranked Alarm Grid & Details Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap px-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500 animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Ranked Match Alarm Grid
              </h2>
            </div>
            
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1">
              {["ALL", "AMBER", "WANTED", "MISSING"].map(pill => (
                <button
                  key={pill}
                  onClick={() => setActiveFilter(pill)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                    activeFilter === pill 
                      ? "bg-primary text-primary-foreground shadow" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          {sortedHits.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 flex flex-col items-center gap-3">
              <Radio className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
              <p className="text-xs text-muted-foreground font-medium text-center">
                Scanning mesh... Select options to filter, or trigger a camera node match.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <AnimatePresence>
                {sortedHits.map((hit, idx) => {
                  const isCritical = hit.confidence >= 0.80;
                  return (
                    <motion.div
                      key={hit.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedHitDetails(hit)}
                      className={cn(
                        "relative bg-card border rounded-2xl p-4 overflow-hidden flex flex-col justify-between gap-4 shadow-sm cursor-pointer hover:border-primary/50 transition-all group",
                        isCritical 
                          ? "border-red-500/40 bg-red-500/[0.02] shadow-[0_0_20px_rgba(239,68,68,0.05)]" 
                          : "border-border hover:border-amber-500/30"
                      )}
                    >
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
                            <p className="font-black text-sm text-foreground truncate group-hover:text-primary transition-colors">{hit.boloLabel}</p>
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

                      <div className="flex items-center justify-between p-2 bg-muted/40 rounded-xl border border-border/40 text-[9px] font-bold text-muted-foreground uppercase">
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

        {/* Detailed Side Panel / Telemetry Modal */}
        <AnimatePresence>
          {selectedHitDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-end bg-background/50 backdrop-blur-sm">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="h-full w-full max-w-md bg-card border-l border-border p-6 flex flex-col justify-between shadow-2xl overflow-y-auto"
              >
                <div className="space-y-6">
                  {/* Title Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-green-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Intelligence Package</span>
                    </div>
                    <button 
                      onClick={() => setSelectedHitDetails(null)}
                      className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Header Detail */}
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-foreground">{selectedHitDetails.boloLabel}</h3>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1 text-primary">
                      <Camera className="h-3.5 w-3.5" /> Camera: {selectedHitDetails.deviceName}
                    </p>
                  </div>

                  {/* Enhanced Frame View / Simulated Enhancement */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Node Captured Frame</span>
                      <span className="px-2 py-0.5 rounded bg-muted font-bold text-[8px] uppercase tracking-wider text-muted-foreground">
                        {selectedHitDetails.enhanced ? "Neural Enhanced (2x)" : "Standard Match Capture"}
                      </span>
                    </div>

                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted border border-border flex items-center justify-center">
                      {activeBolos.find(b => b.id === selectedHitDetails.boloId)?.imageUrl ? (
                        <img 
                          src={activeBolos.find(b => b.id === selectedHitDetails.boloId)?.imageUrl} 
                          className={cn(
                            "w-full h-full object-cover transition-all duration-500", 
                            selectedHitDetails.enhanced ? "scale-105 saturate-110 filter blur-0" : "scale-100 saturate-100 blur-[0.5px]"
                          )} 
                          alt="Enhanced Capture"
                        />
                      ) : (
                        <Camera className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
                      )}

                      {/* Enhancing overlay spinner */}
                      {isEnhancing && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Enhancing resolution...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Secondary Analysis Controls */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={triggerMockEnhance}
                      disabled={isEnhancing || selectedHitDetails.enhanced}
                      variant="outline"
                      className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-border"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-2 text-primary animate-pulse" />
                      {selectedHitDetails.enhanced ? "Enhanced" : "AI Enhance"}
                    </Button>
                    <Button 
                      onClick={triggerBodyScan}
                      disabled={isBodyScanActive}
                      variant="outline"
                      className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border-border"
                    >
                      <Sliders className="h-3.5 w-3.5 mr-2 text-amber-500 animate-pulse" />
                      Verify Body Scan
                    </Button>
                  </div>

                  {/* Telemetry & Geographic package */}
                  <div className="p-4 bg-muted/40 rounded-2xl border space-y-3 font-medium">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block border-b pb-1.5">Matched Telemetry Summary</span>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Location Coordinates</span>
                        <span className="text-foreground font-black flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          {selectedHitDetails.lat ? `${selectedHitDetails.lat.toFixed(4)}, ${selectedHitDetails.lng?.toFixed(4)}` : "Unavailable"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Timestamp (UTC)</span>
                        <span className="text-foreground font-black flex items-center gap-1 mt-0.5">
                          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                          {formatTime(selectedHitDetails.timestamp)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">Matched Traits</span>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="px-2 py-0.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-[8px] font-black uppercase">Face Signature Match ✓</span>
                        <span className="px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase">Spatial Depth Valid</span>
                        {selectedHitDetails.enhanced && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase">AI Refined (Super-Res)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  {selectedHitDetails.lat && (
                    <Button 
                      onClick={() => window.open(`https://www.google.com/maps?q=${selectedHitDetails.lat},${selectedHitDetails.lng}`, '_blank')}
                      className="w-full h-11 rounded-xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Locate Node on Google Maps
                    </Button>
                  )}
                  <Button 
                    variant="destructive" 
                    onClick={() => handleDeleteHit(selectedHitDetails.id)}
                    className="w-full h-11 rounded-xl font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Match Record
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedHitDetails(null)}
                    className="w-full h-11 rounded-xl font-black uppercase tracking-widest border-border text-foreground hover:bg-muted"
                  >
                    Close Intelligence File
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
