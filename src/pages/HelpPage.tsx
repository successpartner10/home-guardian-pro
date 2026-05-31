import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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

// 1. Mini Animated Thermal Core Simulator
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
      grad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      grad.addColorStop(0.25, "rgba(249, 115, 22, 0.85)");
      grad.addColorStop(0.55, "rgba(239, 68, 68, 0.6)");
      grad.addColorStop(0.85, "rgba(139, 92, 246, 0.3)");
      grad.addColorStop(1.0, "transparent");
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 40, 0, Math.PI * 2);
      ctx.fill();
      
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

// 2. Mini Animated Grid Tracking Simulator
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
      
      const tx = 200 + Math.sin(angle) * 110;
      const ty = 90 + Math.sin(angle * 2) * 20;
      
      let bestCam = cams[0];
      let minDist = 9999;
      cams.forEach(c => {
        const d = Math.hypot(tx - c.x, ty - c.y);
        if (d < minDist) {
          minDist = d;
          bestCam = c;
        }
      });
      
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
        
        ctx.fillStyle = isActive ? c.color : "#4b5563";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      
      ctx.strokeStyle = bestCam.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bestCam.x, bestCam.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      
      ctx.strokeStyle = bestCam.color;
      ctx.strokeRect(tx - 12, ty - 12, 24, 24);
      
      ctx.fillStyle = bestCam.color;
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();
      
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

// 3. Mini Screen Share Mirroring Animation
const BridgeModeMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let time = 0;
    const draw = () => {
      time += 0.05;
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.strokeRect(10, 15, canvas.width - 20, canvas.height - 30);
      
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(10, 15, canvas.width - 20, 14);
      ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(18, 22, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#eab308"; ctx.beginPath(); ctx.arc(24, 22, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(30, 22, 2, 0, Math.PI*2); ctx.fill();
      
      const maxFrames = 4;
      for (let i = 0; i < maxFrames; i++) {
        const offset = ((time + i * 1.5) % 6) * 12;
        const alpha = Math.max(0, 1 - ((time + i * 1.5) % 6) / 6);
        ctx.strokeStyle = `rgba(234, 179, 8, ${alpha * 0.4})`;
        ctx.strokeRect(20 + offset, 35 + offset, canvas.width - 40 - offset*2, canvas.height - 60 - offset*2);
      }
      
      ctx.fillStyle = "#eab308";
      ctx.font = "8px monospace";
      ctx.fillText("Mirror Active Tab ➔ Casting Feed", 40, 24);
      
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        Active Screen Mirroring
      </div>
    </div>
  );
};

// 4. Night Vision Booster Animation
const NightVisionMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let time = 0;
    const draw = () => {
      time += 0.02;
      ctx.fillStyle = "#090514";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const divideX = (Math.sin(time) * 0.5 + 0.5) * canvas.width;
      
      // Raw dark
      ctx.save();
      ctx.rect(0, 0, divideX, canvas.height);
      ctx.clip();
      ctx.fillStyle = "#05020c";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2 + 10, 20, 0, Math.PI*2); ctx.fill();
      ctx.font = "8px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillText("Raw dark input", 15, 20);
      ctx.restore();
      
      // Boosted
      ctx.save();
      ctx.rect(divideX, 0, canvas.width - divideX, canvas.height);
      ctx.clip();
      ctx.fillStyle = "#0c1f10";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2 + 10, 2, canvas.width/2, canvas.height/2 + 10, 30);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, "#4ade80");
      grad.addColorStop(1.0, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2 + 10, 30, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 1;
      ctx.strokeRect(canvas.width/2 - 25, canvas.height/2 - 15, 50, 50);
      ctx.font = "8px monospace";
      ctx.fillStyle = "#4ade80";
      ctx.fillText("Amplified boosted feed", canvas.width - 150, 20);
      ctx.restore();
      
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(divideX, 0);
      ctx.lineTo(divideX, canvas.height);
      ctx.stroke();
      
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        Light Amplifier
      </div>
    </div>
  );
};

// 5. Cloud Recordings Sliding card Film Strip Animation
const ArchiveMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let time = 0;
    const draw = () => {
      time += 0.015;
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const cardWidth = 80;
      const cardHeight = 60;
      const spacing = 15;
      const startX = -100 + (time * 50) % (cardWidth + spacing);
      
      for (let i = 0; i < 6; i++) {
        const x = startX + i * (cardWidth + spacing);
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, 40, cardWidth, cardHeight, 10);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.moveTo(x + cardWidth/2 - 4, 40 + cardHeight/2 - 6);
        ctx.lineTo(x + cardWidth/2 + 6, 40 + cardHeight/2);
        ctx.lineTo(x + cardWidth/2 - 4, 40 + cardHeight/2 + 6);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "6px monospace";
        ctx.fillText(`Clip #${Math.floor(time + i * 7) % 100}`, x + 8, 92);
      }
      
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "8px monospace";
      ctx.fillText("Cloud Storage Archive Syncing", 12, 22);
      
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        Google Drive Vault
      </div>
    </div>
  );
};

// 6. Access Control Shield and Locks scanner
const GatekeeperMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let time = 0;
    const draw = () => {
      time += 0.03;
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Node 1: Admin
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath(); ctx.arc(100, 72, 12, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.font = "7px monospace"; ctx.fillText("ADMIN", 88, 94);
      
      // Node 2: Locked Guest
      const isScanning = (Math.floor(time / 2) % 2) === 0;
      ctx.fillStyle = isScanning ? "#ef4444" : "#22c55e";
      ctx.beginPath(); ctx.arc(300, 72, 12, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.fillText(isScanning ? "LOCKED" : "APPROVED", 278, 94);
      
      // beam
      ctx.strokeStyle = isScanning ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(112, 72);
      ctx.bezierCurveTo(180, 50 + Math.sin(time*5)*15, 220, 50 - Math.sin(time*5)*15, 288, 72);
      ctx.stroke();
      
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "8px monospace";
      ctx.fillText(isScanning ? "Scanner: Negotiating access key" : "Scanner: Node approved", 12, 22);
      
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        Approval Shield
      </div>
    </div>
  );
};

// 7. Zoom interpolator details vector
const AIZoomMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let time = 0;
    const draw = () => {
      time += 0.02;
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const zoomRatio = 1 + (Math.sin(time) * 0.5 + 0.5) * 3;
      
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.strokeRect(100, 20, 200, 100);
      ctx.clip();
      
      const centerX = 200;
      const centerY = 70;
      ctx.strokeStyle = zoomRatio > 2.5 ? "#f97316" : "#ffffff";
      ctx.lineWidth = zoomRatio > 2.5 ? 2 : 1;
      
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 15 * zoomRatio, 20 * zoomRatio, 0, 0, Math.PI*2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(centerX - 5 * zoomRatio, centerY - 5 * zoomRatio, 1.5 * zoomRatio, 0, Math.PI*2);
      ctx.arc(centerX + 5 * zoomRatio, centerY - 5 * zoomRatio, 1.5 * zoomRatio, 0, Math.PI*2);
      ctx.fillStyle = zoomRatio > 2.5 ? "#f97316" : "#ffffff";
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(centerX, centerY + 5 * zoomRatio, 4 * zoomRatio, 0, Math.PI, false);
      ctx.stroke();
      
      ctx.restore();
      
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "8px monospace";
      ctx.fillText(`Zoom ratio: ${zoomRatio.toFixed(1)}x`, 12, 22);
      ctx.fillText("AI Raster-to-Vector sharpening", 12, 34);
      
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        HD Interpolator
      </div>
    </div>
  );
};

// 8. Voice static filter waves
const NoiseIsolationMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let time = 0;
    const draw = () => {
      time += 0.08;
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 20; x < canvas.width - 20; x++) {
        const y = 45 + Math.sin(x*0.1 + time)*15 + (Math.random() - 0.5)*12;
        if (x === 20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 20; x < canvas.width - 20; x++) {
        const y = 95 + Math.sin(x*0.06 + time)*14;
        if (x === 20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      ctx.fillStyle = "#ef4444"; ctx.font = "7px monospace"; ctx.fillText("Static background noise", 20, 25);
      ctx.fillStyle = "#22c55e"; ctx.fillText("Filtered vocal frequency", 20, 77);
      
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        Acoustic Filter
      </div>
    </div>
  );
};

// 9. Audio decibel and mic pulsing rings
const TwoWayTalkMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let time = 0;
    const draw = () => {
      time += 0.05;
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const radiusBase = (time * 20) % 120;
      
      ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const r = (radiusBase + i * 40) % 120;
        const alpha = Math.max(0, 1 - r / 120);
        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(80, 72, r, -0.3*Math.PI, 0.3*Math.PI);
        ctx.stroke();
      }
      
      ctx.fillStyle = "#3b82f6";
      for (let i = 0; i < 15; i++) {
        const height = 10 + Math.abs(Math.sin(time*2 + i*0.4)) * 30;
        ctx.fillRect(260 + i * 5, 72 - height/2, 3, height);
      }
      
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "8px monospace";
      ctx.fillText("Transmitting audio signals", 12, 22);
      
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        Walkie-Talkie Wave
      </div>
    </div>
  );
};

// 10. Quota recycle sweeper sweep
const DriveQuotaMiniDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId = 0;
    let time = 0;
    const draw = () => {
      time += 0.02;
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const width = 240;
      const height = 24;
      const x = canvas.width / 2 - width / 2;
      const y = canvas.height / 2 - height / 2;
      
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.strokeRect(x, y, width, height);
      
      const fillPercentage = 0.5 + Math.sin(time) * 0.3;
      ctx.fillStyle = fillPercentage > 0.75 ? "#ef4444" : "#eab308";
      ctx.fillRect(x + 2, y + 2, (width - 4) * fillPercentage, height - 4);
      
      if (fillPercentage > 0.75) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        const sweepX = x + (width - 4) * fillPercentage;
        ctx.beginPath();
        ctx.moveTo(sweepX, y);
        ctx.lineTo(sweepX, y + height);
        ctx.stroke();
        
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 8px monospace";
        ctx.fillText("Quota full ➔ Recycling old clips", x, y - 10);
      } else {
        ctx.fillStyle = "#eab308";
        ctx.font = "8px monospace";
        ctx.fillText(`Drive reserved: ${(fillPercentage*100).toFixed(0)}%`, x, y - 10);
      }
      
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return (
    <div className="relative w-full h-36 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40 shadow-inner my-4">
      <canvas ref={canvasRef} width={400} height={144} className="w-full h-full object-cover" />
      <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[8px] text-white/50 font-mono tracking-wider">
        Storage Manager
      </div>
    </div>
  );
};

const HelpPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<FeatureHelp | null>(null);
  
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
                          
                          {/* Animated Demo canvas simulations for all features */}
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-[10px] font-bold text-black/50">Live simulation feed</p>
                            
                            {f.id === "thermal-vision" && (
                              <>
                                <ThermalMiniDemo />
                                <Button 
                                  onClick={() => setThermalOpen(true)}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Launch live thermal vision mapper
                                </Button>
                              </>
                            )}

                            {f.id === "mesh-tracking" && (
                              <>
                                <TrackingMiniDemo />
                                <Button 
                                  onClick={() => setMeshOpen(true)}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Launch cooperative mesh tracking lab
                                </Button>
                              </>
                            )}

                            {f.id === "bridge-mode" && (
                              <>
                                <BridgeModeMiniDemo />
                                <Button 
                                  onClick={() => navigate("/dashboard")}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Open camera screen cast panel
                                </Button>
                              </>
                            )}

                            {f.id === "tactical-night-vision" && (
                              <>
                                <NightVisionMiniDemo />
                                <Button 
                                  onClick={() => navigate("/dashboard")}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Open live stream night filter
                                </Button>
                              </>
                            )}

                            {f.id === "elite-archive" && (
                              <>
                                <ArchiveMiniDemo />
                                <Button 
                                  onClick={() => navigate("/archive")}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Open Google Drive recording archive
                                </Button>
                              </>
                            )}

                            {f.id === "gatekeeper" && (
                              <>
                                <GatekeeperMiniDemo />
                                <Button 
                                  onClick={() => navigate("/settings")}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Open device & security manager
                                </Button>
                              </>
                            )}

                            {f.id === "ai-zoom-enhance" && (
                              <>
                                <AIZoomMiniDemo />
                                <Button 
                                  onClick={() => navigate("/dashboard")}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Open live stream stream booster
                                </Button>
                              </>
                            )}

                            {f.id === "noise-isolation" && (
                              <>
                                <NoiseIsolationMiniDemo />
                                <Button 
                                  onClick={() => navigate("/settings")}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Configure microphones & filters
                                </Button>
                              </>
                            )}

                            {f.id === "two-way-talk" && (
                              <>
                                <TwoWayTalkMiniDemo />
                                <Button 
                                  onClick={() => navigate("/dashboard")}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Open voice talkback broadcast
                                </Button>
                              </>
                            )}

                            {f.id === "drive-quota-control" && (
                              <>
                                <DriveQuotaMiniDemo />
                                <Button 
                                  onClick={() => navigate("/settings")}
                                  className="w-full h-12 bg-black text-white hover:bg-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-wider"
                                >
                                  ⚡ Open storage & backup quota options
                                </Button>
                              </>
                            )}
                          </div>

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
