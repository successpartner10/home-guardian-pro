import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Thermometer, Camera, Eye, Zap, RefreshCw, Cpu, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ThermalLabProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PaletteType = "ironbow" | "rainbow" | "fire" | "green";

export const ThermalLab = ({ open, onOpenChange }: ThermalLabProps) => {
  const { toast } = useState(() => ({ toast: (params: any) => console.log(params) }))[0]; // fallback toast
  const [useWebcam, setUseWebcam] = useState(false);
  const [palette, setPalette] = useState<PaletteType>("ironbow");
  const [gain, setGain] = useState(1.4);
  const [bloom, setBloom] = useState(2.0);
  const [tempOffset, setTempOffset] = useState(0.0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Clean up media stream on unmount or mode switch
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Handle webcam toggle
  useEffect(() => {
    if (useWebcam && open) {
      navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        .then(s => {
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(err => {
          console.error("Webcam access failed:", err);
          setUseWebcam(false);
        });
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  }, [useWebcam, open]);

  // Simulated night scene drawer (if webcam is off)
  useEffect(() => {
    if (!open || useWebcam) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    
    // Target position coordinates
    let targetX = canvas.width / 2;
    let targetY = canvas.height / 2;
    let targetVX = 1.5;
    let targetVY = 0.8;

    const drawSimulatedFeed = () => {
      time += 0.02;
      
      // 1. Draw cold ambient background (dark room)
      ctx.fillStyle = "#03001e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add a subtle cooling static noise
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 2;
        ctx.fillStyle = `rgba(10, 10, 60, ${Math.random() * 0.15})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw static heat sources in the room
      // Heat source 1: Server rack/computer (yellow-hot exhaust)
      const gradServer = ctx.createRadialGradient(80, 80, 5, 80, 80, 45);
      gradServer.addColorStop(0, "rgba(255, 255, 255, 1.0)"); // Core hot
      gradServer.addColorStop(0.3, "rgba(255, 100, 0, 0.7)");
      gradServer.addColorStop(0.6, "rgba(180, 0, 100, 0.4)");
      gradServer.addColorStop(1.0, "rgba(0, 0, 50, 0.0)");
      ctx.fillStyle = gradServer;
      ctx.beginPath();
      ctx.arc(80, 80, 45, 0, Math.PI * 2);
      ctx.fill();
      
      // Label for server
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "8px monospace";
      ctx.fillText("CPU_UNIT: 48.6°C", 55, 140);

      // Heat source 2: Cup of coffee on a table (very hot core)
      const gradCoffee = ctx.createRadialGradient(180, 240, 2, 180, 240, 15);
      gradCoffee.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      gradCoffee.addColorStop(0.4, "rgba(255, 180, 0, 0.8)");
      gradCoffee.addColorStop(1.0, "rgba(0, 0, 50, 0.0)");
      ctx.fillStyle = gradCoffee;
      ctx.beginPath();
      ctx.arc(180, 240, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("BEVERAGE: 64.2°C", 145, 270);

      // 3. Draw moving human target (dynamic thermal body parts)
      // Update target movement
      targetX += targetVX;
      targetY += targetVY;
      if (targetX < 150 || targetX > canvas.width - 150) targetVX *= -1;
      if (targetY < 100 || targetY > canvas.height - 100) targetVY *= -1;

      // Human parts are modeled as overlapping ellipses/circles of heat
      const parts = [
        { rx: 14, ry: 14, dx: 0, dy: -35, temp: 0.95 }, // Head
        { rx: 25, ry: 35, dx: 0, dy: 5, temp: 0.98 },   // Torso (hottest body core)
        { rx: 8, ry: 20, dx: -20, dy: 10, temp: 0.75 }, // Left Arm
        { rx: 8, ry: 20, dx: 20, dy: 10, temp: 0.75 },  // Right Arm
        { rx: 11, ry: 30, dx: -10, dy: 55, temp: 0.70 }, // Left Leg
        { rx: 11, ry: 30, dx: 10, dy: 55, temp: 0.70 }   // Right Leg
      ];

      parts.forEach(p => {
        // Natural breath/walking wobble
        const wobbleX = Math.sin(time * 5 + p.dy) * 2;
        const wobbleY = Math.cos(time * 3 + p.dx) * 1.5;
        const px = targetX + p.dx + wobbleX;
        const py = targetY + p.dy + wobbleY;

        const gradPart = ctx.createRadialGradient(px, py, 2, px, py, Math.max(p.rx, p.ry) * 1.3);
        // Hottest core is white-yellow, fading to red-orange, then purple, then invisible
        gradPart.addColorStop(0, "rgba(255, 255, 255, 1.0)");
        gradPart.addColorStop(0.2, "rgba(255, 230, 100, 0.9)");
        gradPart.addColorStop(0.5, "rgba(255, 60, 0, 0.75)");
        gradPart.addColorStop(0.8, "rgba(140, 0, 120, 0.4)");
        gradPart.addColorStop(1.0, "rgba(0, 0, 50, 0.0)");
        
        ctx.fillStyle = gradPart;
        ctx.beginPath();
        ctx.ellipse(px, py, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Target Tracking Box & Text
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(targetX - 45, targetY - 60, 90, 150);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText(`TARGET #H-92 [HUMAN]`, targetX - 40, targetY - 70);
      
      const displayedTemp = (36.8 + Math.sin(time) * 0.2 + tempOffset).toFixed(1);
      ctx.fillStyle = "#ffaa00";
      ctx.fillText(`CORE TEMP: ${displayedTemp}°C`, targetX - 40, targetY + 105);

      animationRef.current = requestAnimationFrame(drawSimulatedFeed);
    };

    drawSimulatedFeed();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [useWebcam, open, tempOffset]);

  // Color mappings for SVG Transfer Table
  const paletteTables = {
    ironbow: {
      r: "0.0 0.0 0.4 0.9 1.0 1.0",
      g: "0.0 0.0 0.1 0.7 0.95 1.0",
      b: "0.2 0.7 0.5 0.0 0.0 0.9"
    },
    rainbow: {
      r: "0.0 0.0 0.0 0.1 0.8 1.0 1.0",
      g: "0.0 0.1 0.85 0.95 0.9 0.0 1.0",
      b: "0.4 0.9 0.8 0.0 0.0 0.0 0.9"
    },
    fire: {
      r: "0.0 0.2 0.7 1.0 1.0 1.0",
      g: "0.0 0.0 0.1 0.5 0.9 1.0",
      b: "0.0 0.0 0.0 0.0 0.1 0.8"
    },
    green: {
      r: "0.0 0.0 0.0 0.0 0.0",
      g: "0.05 0.2 0.6 0.85 1.0",
      b: "0.0 0.0 0.0 0.0 0.0"
    }
  };

  const activeTable = paletteTables[palette];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-black/95 border-2 border-white/10 text-white rounded-[2.5rem] p-6 overflow-hidden">
        {/* Hidden SVG for real-time SVG matrix operations */}
        <svg className="absolute w-0 h-0 invisible">
          <filter id="thermal-reconstruction-core">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="table" tableValues={activeTable.r} />
              <feFuncG type="table" tableValues={activeTable.g} />
              <feFuncB type="table" tableValues={activeTable.b} />
            </feComponentTransfer>
            <feGaussianBlur stdDeviation={bloom.toFixed(1)} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </svg>

        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3 text-orange-500">
            <Thermometer className="h-8 w-8 animate-pulse" />
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">AI Thermal Reconstruction Lab</DialogTitle>
          </div>
          <DialogDescription className="text-white/60 font-medium">
            Test the spatial-neural mapping model that estimates high-resolution thermal structures from low-light active infrared sensors.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* Main Visual Display */}
          <div className="lg:col-span-8 space-y-4">
            <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-white/10 bg-zinc-950 flex items-center justify-center group shadow-[0_0_40px_rgba(249,115,22,0.15)]">
              {useWebcam ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transition-all"
                  style={{ filter: `url(#thermal-reconstruction-core) contrast(${gain}) brightness(1.15)` }}
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={360}
                  className="w-full h-full object-cover"
                  style={{ filter: `url(#thermal-reconstruction-core) contrast(${gain}) brightness(1.15)` }}
                />
              )}

              {/* Holographic HUD Overlays */}
              <div className="absolute top-4 left-4 p-3 bg-black/60 backdrop-blur-md rounded-2xl border border-white/5 font-mono text-[9px] text-orange-400 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  <span className="font-bold">MODE: INTERACTIVE THERMAL MAPPER</span>
                </div>
                <div>SIGNAL SOURCE: {useWebcam ? "ACTIVE WEBCAM FEED" : "SYNTHETIC SURVEILLANCE LOOP"}</div>
                <div>FRAME RATE: 60 FPS • SENSOR GAIN: {((gain - 1) * 100).toFixed(0)}%</div>
                <div>THERMAL PALETTE: {palette.toUpperCase()}</div>
              </div>

              <div className="absolute bottom-4 right-4 p-3 bg-black/60 backdrop-blur-md rounded-2xl border border-white/5 font-mono text-[9px] text-right text-white/70">
                <div className="font-bold text-white uppercase">Neural Matrix Overlay v4.2</div>
                <div>EMISSIVITIES CALIBRATED: 0.95 (SKIN)</div>
                <div>DETECTION SPATIAL THRESHOLD: 98.4%</div>
              </div>
            </div>

            {/* Quick Informational Grid */}
            <div className="grid grid-cols-3 gap-4 font-mono text-[10px] text-white/70">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                <Cpu className="h-4 w-4 text-orange-400" />
                <div>
                  <div className="font-bold text-white">EDGE RECONSTRUCTION</div>
                  <div className="text-[9px] text-white/50">TensorFlow-Lite Optimized</div>
                </div>
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                <Eye className="h-4 w-4 text-emerald-400" />
                <div>
                  <div className="font-bold text-white">NIGHT VISION +</div>
                  <div className="text-[9px] text-white/50">Digital IR Contrast Mapping</div>
                </div>
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                <Award className="h-4 w-4 text-blue-400" />
                <div>
                  <div className="font-bold text-white">PATENT PENDING</div>
                  <div className="text-[9px] text-white/50">US-2026/04012 Spatial Map</div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Controls Panel */}
          <div className="lg:col-span-4 space-y-6 bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between">
            <div className="space-y-6">
              <h3 className="text-lg font-black uppercase tracking-tight border-b border-white/5 pb-2 text-orange-400 flex items-center gap-2">
                <Zap className="h-4 w-4" /> Lab Controls
              </h3>

              {/* Source Switch */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold uppercase tracking-wide">Use Web Camera</div>
                  <div className="text-[9px] text-white/50">Transform your actual device feed</div>
                </div>
                <Switch
                  checked={useWebcam}
                  onCheckedChange={(checked) => {
                    setUseWebcam(checked);
                    if (checked) {
                      toast({
                        title: "Webcam Requested",
                        description: "Attempting to sync active video sensors for thermal mapping."
                      });
                    }
                  }}
                />
              </div>

              {/* Thermal Palette Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/50">Color Scheme Palette</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["ironbow", "rainbow", "fire", "green"] as PaletteType[]).map((p) => (
                    <Button
                      key={p}
                      variant="outline"
                      onClick={() => setPalette(p)}
                      className={`h-12 uppercase font-mono text-[9px] font-black rounded-xl transition-all ${
                        palette === p
                          ? "bg-orange-500 border-orange-500 text-black hover:bg-orange-600 hover:text-black"
                          : "border-white/10 hover:bg-white/5 text-white"
                      }`}
                    >
                      {p === "ironbow" && "🔥 Ironbow"}
                      {p === "rainbow" && "🌈 Rainbow"}
                      {p === "fire" && "🌋 Fire"}
                      {p === "green" && "💚 Emerald"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Contrast / Neural Gain Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                  <span className="text-white/70">AI Amplification Gain</span>
                  <span className="text-orange-400 font-mono">{gain.toFixed(1)}x</span>
                </div>
                <Slider
                  min={0.8}
                  max={3.0}
                  step={0.1}
                  value={[gain]}
                  onValueChange={(val) => setGain(val[0])}
                  className="py-2"
                />
              </div>

              {/* Heat Bloom Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                  <span className="text-white/70">Gaussian Heat Bloom</span>
                  <span className="text-orange-400 font-mono">{bloom.toFixed(1)}px</span>
                </div>
                <Slider
                  min={0.0}
                  max={6.0}
                  step={0.2}
                  value={[bloom]}
                  onValueChange={(val) => setBloom(val[0])}
                  className="py-2"
                />
              </div>

              {/* Simulated Temperature Offset Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                  <span className="text-white/70">Relative Temp Shift</span>
                  <span className="text-orange-400 font-mono">{tempOffset > 0 ? "+" : ""}{tempOffset.toFixed(1)}°C</span>
                </div>
                <Slider
                  min={-10.0}
                  max={15.0}
                  step={0.5}
                  value={[tempOffset]}
                  onValueChange={(val) => setTempOffset(val[0])}
                  className="py-2"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <Button
                onClick={() => {
                  setGain(1.4);
                  setBloom(2.0);
                  setTempOffset(0.0);
                  setPalette("ironbow");
                }}
                variant="ghost"
                className="w-full flex items-center justify-center gap-2 border border-white/5 hover:bg-white/5 rounded-2xl h-12 text-xs font-black uppercase text-white"
              >
                <RefreshCw className="h-4 w-4" /> Reset Lab Settings
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
