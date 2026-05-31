import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Zap, Shield, Video, Moon, Radio, Share2, HelpCircle, ChevronRight, Info, Mic, Thermometer, Sparkles } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThermalLab } from "@/components/ailab/ThermalLab";
import { MeshTrackingLab } from "@/components/ailab/MeshTrackingLab";

interface FeatureHelp {
  id: string;
  title: string;
  icon: any;
  category: "Vision" | "Security" | "Storage" | "AI";
  description: string;
  howItWorks: string;
}

const features: FeatureHelp[] = [
  {
    id: "thermal-vision",
    title: "AI Thermal Reconstruction",
    icon: Thermometer,
    category: "AI",
    description: "Reconstructs thermal maps from standard low-light cameras so you can check heat signatures in pitch-black environments.",
    howItWorks: "HGUARD analyzes night vision feeds through a smart neural processor that estimates surface heat and highlights human body presence."
  },
  {
    id: "mesh-tracking",
    title: "Cross-Camera Object Tracking",
    icon: Sparkles,
    category: "AI",
    description: "Tracks movement across your yard by automatically handing off video between adjacent cameras.",
    howItWorks: "As a visitor crosses from one camera's view into another, HGUARD seamlessly lock-negotiates, keeping them focused in a single live feed."
  },
  {
    id: "bridge-mode",
    title: "Screen Share (Other Cameras)",
    icon: Radio,
    category: "Vision",
    description: "Show video from Ring, Nest, Arlo, or a browser tab right on your HGUARD dashboard.",
    howItWorks: "Open your other camera in a browser tab. On your HGUARD camera device, select Screen Share and choose that tab. The viewer will mirror it instantly."
  },
  {
    id: "tactical-night-vision",
    title: "Night Vision Boosting",
    icon: Moon,
    category: "Vision",
    description: "Provides clear, bright monitoring in dark spaces using digital light amplification.",
    howItWorks: "HGUARD automatically brightens dim frames, making it easier for you and the AI to spot unexpected activity in dark rooms."
  },
  {
    id: "elite-archive",
    title: "Cloud Recordings",
    icon: Video,
    category: "Storage",
    description: "Saves and stores security clips securely so you can watch them anytime.",
    howItWorks: "Recorded clips are automatically and safely saved to your Google Drive folder, allowing direct playback in the app without downloading."
  },
  {
    id: "gatekeeper",
    title: "Viewer Access Control",
    icon: Shield,
    category: "Security",
    description: "Gives you complete control over who is allowed to monitor your camera feeds.",
    howItWorks: "New monitoring devices stay locked on standby until you manually approve them in your administrator device settings."
  },
  {
    id: "ai-zoom-enhance",
    title: "Smart Zoom Details",
    icon: Zap,
    category: "AI",
    description: "Keeps your picture clear and sharp even when you zoom in close.",
    howItWorks: "HGUARD automatically sharpens facial features and object outlines when you zoom, reducing pixel blockiness."
  },
  {
    id: "noise-isolation",
    title: "Voice Noise Filter",
    icon: Mic,
    category: "AI",
    description: "Cleans up loud backgrounds so you can hear people talking clearly.",
    howItWorks: "Filters out environmental static hums (like fans, wind, or traffic) while boosting natural human vocal frequencies."
  },
  {
    id: "two-way-talk",
    title: "One-Tap Walkie-Talkie",
    icon: Radio,
    category: "Security",
    description: "Speak directly through your cameras to anyone in your home.",
    howItWorks: "Tap the microphone icon to talk. Your voice plays instantly through the camera. Tap again to stop talking. Simple and fast."
  },
  {
    id: "drive-quota-control",
    title: "Automatic Storage Cleanups",
    icon: Info,
    category: "Storage",
    description: "Keeps your Google Drive organized and prevents storage limits.",
    howItWorks: "Choose your maximum storage space. When full, HGUARD automatically recycles your oldest recordings to make room for new ones."
  }
];

// Mini Animated Thermal Core Simulator
const ThermalMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    let animationId = 0;
    let time = 0;
    
    const draw = () => {
      time += 0.04;
      ctx.fillStyle = "#090514";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Background cooler noise
      for (let i = 0; i < 30; i++) {
        const x = (Math.sin(i + time) * 0.5 + 0.5) * canvas.width;
        const y = (Math.cos(i * 2 + time) * 0.5 + 0.5) * canvas.height;
        ctx.fillStyle = "rgba(40, 10, 90, 0.08)";
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hottest core coordinates (walking body)
      const x = canvas.width / 2 + Math.sin(time) * 60;
      const y = canvas.height / 2 + Math.cos(time * 1.5) * 12;
      
      const grad = ctx.createRadialGradient(x, y, 1, x, y, 40);
      grad.addColorStop(0, "rgba(255, 255, 255, 1.0)"); // hottest
      grad.addColorStop(0.25, "rgba(249, 115, 22, 0.85)"); // orange
      grad.addColorStop(0.55, "rgba(239, 68, 68, 0.6)"); // red
      grad.addColorStop(0.85, "rgba(139, 92, 246, 0.3)"); // violet
      grad.addColorStop(1.0, "transparent");
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 40, 0, Math.PI * 2);
      ctx.fill();
      
      // Tracking box overlays
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 22, y - 22, 44, 44);
      
      ctx.fillStyle = "#ff8800";
      ctx.font = "8px monospace";
      ctx.fillText(`Target: ${(36.2 + Math.sin(time) * 0.1).toFixed(1)}°C`, x - 20, y - 28);
      
      animationId = requestAnimationFrame(draw);
    };
    
    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);
  
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        Active Simulation
      </div>
    </div>
  );
};

// Mini Animated Grid Tracking Simulator
const TrackingMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    let animationId = 0;
    let angle = 0;
    
    const draw = () => {
      angle += 0.015;
      ctx.fillStyle = "#08070b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      
      const cams = [
        { x: 70, y: 35, color: "#ef4444", name: "Cam-01" },
        { x: 200, y: 35, color: "#3b82f6", name: "Cam-02" },
        { x: 330, y: 35, color: "#22c55e", name: "Cam-03" }
      ];
      
      // Target position moving in an arc
      const tx = 200 + Math.sin(angle) * 110;
      const ty = 90 + Math.sin(angle * 2) * 20;
      
      // Check which camera has active lock
      let bestCam = cams[0];
      let minDist = 9999;
      cams.forEach(c => {
        const d = Math.hypot(tx - c.x, ty - c.y);
        if (d < minDist) {
          minDist = d;
          bestCam = c;
        }
      });
      
      // Draw coverage cones
      cams.forEach(c => {
        const isActive = c.name === bestCam.name;
        ctx.strokeStyle = isActive ? `${c.color}50` : "rgba(255,255,255,0.05)";
        ctx.fillStyle = isActive ? `${c.color}08` : "rgba(255,255,255,0.01)";
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.arc(c.x, c.y, 110, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Cam sensor dot
        ctx.fillStyle = isActive ? c.color : "#4b5563";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Connection line
      ctx.strokeStyle = bestCam.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bestCam.x, bestCam.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      
      // Target lock box and circle
      ctx.strokeStyle = bestCam.color;
      ctx.strokeRect(tx - 12, ty - 12, 24, 24);
      
      ctx.fillStyle = bestCam.color;
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Labels
      ctx.fillStyle = "#9ca3af";
      ctx.font = "8px monospace";
      ctx.fillText(`Mesh Active Lock: ${bestCam.name}`, 12, 20);
      
      animationId = requestAnimationFrame(draw);
    };
    
    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);
  
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        Active Simulation
      </div>
    </div>
  );
};

const HelpPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<FeatureHelp | null>(null);
  
  // States to launch active interactive labs directly
  const [thermalOpen, setThermalOpen] = useState(false);
  const [meshOpen, setMeshOpen] = useState(false);

  const filteredFeatures = features.filter(f => 
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto pb-32 space-y-12">
        {/* Header */}
        <div className="space-y-4 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-4 text-primary">
            <HelpCircle className="w-10 h-10" />
            <h1 className="text-4xl font-black tracking-tight">Help & Tips</h1>
          </div>
          <p className="text-lg text-muted-foreground font-medium">Simple guides and active simulators for every feature.</p>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/10 blur-2xl group-focus-within:bg-primary/20 transition-all rounded-full" />
          <div className="relative flex items-center">
            <Search className="absolute left-6 h-5 w-5 text-white/40 group-focus-within:text-primary transition-colors" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search simple guides…"
              className="h-16 pl-16 pr-8 bg-black/40 border-2 border-white/5 rounded-[2rem] text-lg font-bold placeholder:text-white/20 focus:border-primary/50 focus:ring-0 transition-all"
            />
          </div>
        </div>

        {/* Feature List */}
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {filteredFeatures.map((f) => (
              <motion.div
                key={f.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div 
                  onClick={() => setSelectedFeature(selectedFeature?.id === f.id ? null : f)}
                  className={cn(
                    "group relative overflow-hidden rounded-[2.5rem] border-2 transition-all cursor-pointer p-6",
                    selectedFeature?.id === f.id 
                      ? "bg-primary border-primary shadow-[0_0_40px_rgba(var(--primary-rgb),0.2)]" 
                      : "bg-white/[0.03] border-white/5 hover:border-white/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "h-14 w-14 rounded-2xl flex items-center justify-center transition-colors",
                        selectedFeature?.id === f.id ? "bg-black text-primary" : "bg-primary/10 text-primary"
                      )}>
                        <f.icon className="h-7 w-7" />
                      </div>
                      <div className="space-y-1">
                        <p className={cn(
                          "text-xl font-bold tracking-tight",
                          selectedFeature?.id === f.id ? "text-black" : "text-white"
                        )}>
                          {f.title}
                        </p>
                        <p className={cn(
                          "text-xs font-semibold tracking-wide capitalize",
                          selectedFeature?.id === f.id ? "text-black/60" : "text-muted-foreground"
                        )}>
                          {f.category} Features
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "h-6 w-6 transition-transform",
                      selectedFeature?.id === f.id ? "rotate-90 text-black" : "text-white/20"
                    )} />
                  </div>

                  <AnimatePresence>
                    {selectedFeature?.id === f.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-8 space-y-6">
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-black/50">What it does</p>
                            <p className="text-lg font-bold text-black leading-tight">{f.description}</p>
                          </div>
                          
                          {/* Animated Demo canvas simulations for implemented AI features */}
                          {f.id === "thermal-vision" && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-black/50">Simulated thermal feed</p>
                              <div onClick={(e) => e.stopPropagation()}>
                                <ThermalMiniDemo />
                                <Button 
                                  onClick={() => setThermalOpen(true)}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase transition-all tracking-wider"
                                >
                                  ⚡ Launch live thermal vision mapper
                                </Button>
                              </div>
                            </div>
                          )}

                          {f.id === "mesh-tracking" && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-black/50">Simulated tracking path</p>
                              <div onClick={(e) => e.stopPropagation()}>
                                <TrackingMiniDemo />
                                <Button 
                                  onClick={() => setMeshOpen(true)}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase transition-all tracking-wider"
                                >
                                  ⚡ Launch cooperative mesh tracking lab
                                </Button>
                              </div>
                            </div>
                          )}

                          <div className="p-5 rounded-3xl bg-black/10 border border-black/5 space-y-2">
                            <p className="text-[10px] font-bold text-black/50">How it works</p>
                            <p className="text-sm font-medium text-black/80 leading-relaxed italic">
                              "{f.howItWorks}"
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredFeatures.length === 0 && (
          <div className="text-center py-20 space-y-4 opacity-30">
            <Info className="h-12 w-12 mx-auto" />
            <p className="text-lg font-bold">No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Lab Diagnostic Modals */}
      <ThermalLab open={thermalOpen} onOpenChange={setThermalOpen} />
      <MeshTrackingLab open={meshOpen} onOpenChange={setMeshOpen} />
    </AppLayout>
  );
};

export default HelpPage;
