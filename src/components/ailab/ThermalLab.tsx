// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Thermometer, Camera, Eye, Zap, RefreshCw, Cpu, Award } from "lucide-react";

interface ThermalLabProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PaletteType = "ironbow" | "rainbow" | "fire" | "green";

export const ThermalLab = ({ open, onOpenChange }: ThermalLabProps) => {
  const [useWebcam, setUseWebcam] = useState(false);
  const [palette, setPalette] = useState<PaletteType>("ironbow");
  const [gain, setGain] = useState(1.4);
  const [bloom, setBloom] = useState(2.0);
  const [tempOffset, setTempOffset] = useState(0.0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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

  useEffect(() => {
    if (!open || useWebcam) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    let targetX = canvas.width / 2;
    let targetY = canvas.height / 2;
    let targetVX = 1.5;
    let targetVY = 0.8;

    const drawSimulatedFeed = () => {
      time += 0.02;
      ctx.fillStyle = "#03001e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 200; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 2;
        ctx.fillStyle = `rgba(10, 10, 60, ${Math.random() * 0.15})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const gradServer = ctx.createRadialGradient(80, 80, 5, 80, 80, 45);
      gradServer.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      gradServer.addColorStop(0.3, "rgba(255, 100, 0, 0.7)");
      gradServer.addColorStop(0.6, "rgba(180, 0, 100, 0.4)");
      gradServer.addColorStop(1.0, "rgba(0, 0, 50, 0.0)");
      ctx.fillStyle = gradServer;
      ctx.beginPath();
      ctx.arc(80, 80, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "8px monospace";
      ctx.fillText("CPU_UNIT: 48.6°C", 55, 140);

      const gradCoffee = ctx.createRadialGradient(180, 240, 2, 180, 240, 15);
      gradCoffee.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      gradCoffee.addColorStop(0.4, "rgba(255, 180, 0, 0.8)");
      gradCoffee.addColorStop(1.0, "rgba(0, 0, 50, 0.0)");
      ctx.fillStyle = gradCoffee;
      ctx.beginPath();
      ctx.arc(180, 240, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText("BEVERAGE: 64.2°C", 145, 270);

      targetX += targetVX;
      targetY += targetVY;
      if (targetX < 150 || targetX > canvas.width - 150) targetVX *= -1;
      if (targetY < 100 || targetY > canvas.height - 100) targetVY *= -1;

      const parts = [
        { rx: 14, ry: 14, dx: 0, dy: -35, temp: 0.95 },
        { rx: 25, ry: 35, dx: 0, dy: 5, temp: 0.98 },
        { rx: 8, ry: 20, dx: -20, dy: 10, temp: 0.75 },
        { rx: 8, ry: 20, dx: 20, dy: 10, temp: 0.75 },
        { rx: 11, ry: 30, dx: -10, dy: 55, temp: 0.70 },
        { rx: 11, ry: 30, dx: 10, dy: 55, temp: 0.70 }
      ];

      parts.forEach(p => {
        const wobbleX = Math.sin(time * 5 + p.dy) * 2;
        const wobbleY = Math.cos(time * 3 + p.dx) * 1.5;
        const px = targetX + p.dx + wobbleX;
        const py = targetY + p.dy + wobbleY;

        const gradPart = ctx.createRadialGradient(px, py, 2, px, py, Math.max(p.rx, p.ry) * 1.3);
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
      <DialogContent className="max-w-4xl bg-background/95 border-2 border-border text-foreground rounded-[2.5rem] p-6 overflow-hidden">
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

        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-3 text-orange-500">
            <Thermometer className="h-6 w-6 animate-pulse" />
            <DialogTitle className="text-xl font-bold tracking-tight">AI Thermal Reconstruction Lab</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground font-normal">
            Neural mapping model estimating thermal structures from active low-light infrared security nodes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
          <div className="lg:col-span-8 space-y-4">
            <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-border bg-background flex items-center justify-center group shadow-[0_0_40px_rgba(249,115,22,0.15)]">
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

              <div className="absolute top-4 left-4 p-2 bg-background/60 backdrop-blur-md rounded-xl border border-border font-mono text-[8px] text-orange-400 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-bold">Mode: Active Thermal Mapper</span>
                </div>
                <div>Source: {useWebcam ? "Webcam Feed" : "Synthetic Loop"}</div>
                <div>Gain: {((gain - 1) * 100).toFixed(0)}%</div>
              </div>

              <div className="absolute bottom-4 right-4 p-2 bg-background/60 backdrop-blur-md rounded-xl border border-border font-mono text-[8px] text-right text-foreground/70">
                <div className="font-bold text-foreground uppercase">Neural Matrix v4.2</div>
                <div>Calibration: 0.95 Skin Emissivity</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 font-mono text-[9px] text-muted-foreground">
              <div className="p-2.5 bg-muted rounded-2xl border border-border flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-orange-400" />
                <div>
                  <div className="font-bold text-foreground">Edge Processing</div>
                  <div className="text-[8px] text-muted-foreground">TensorFlow optimized</div>
                </div>
              </div>
              <div className="p-2.5 bg-muted rounded-2xl border border-border flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                <div>
                  <div className="font-bold text-foreground">Night Vision +</div>
                  <div className="text-[8px] text-muted-foreground">Active IR mapper</div>
                </div>
              </div>
              <div className="p-2.5 bg-muted rounded-2xl border border-border flex items-center gap-2">
                <Award className="h-3.5 w-3.5 text-blue-400" />
                <div>
                  <div className="font-bold text-foreground">Patent Pending</div>
                  <div className="text-[8px] text-muted-foreground">US-2026/04012</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4 bg-muted/20 border border-border p-4 rounded-[2rem] flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5" /> Lab Controls
              </h3>

              <div className="flex items-center justify-between p-2.5 bg-muted rounded-2xl border border-border">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold">Use Device Web Camera</div>
                  <div className="text-[8px] text-muted-foreground">Map your live surroundings</div>
                </div>
                <Switch
                  checked={useWebcam}
                  onCheckedChange={setUseWebcam}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Color Palette</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["ironbow", "rainbow", "fire", "green"] as PaletteType[]).map((p) => (
                    <Button
                      key={p}
                      variant="outline"
                      onClick={() => setPalette(p)}
                      className={`h-9 uppercase font-mono text-[8px] font-bold rounded-xl transition-all ${
                        palette === p
                          ? "bg-orange-500 border-orange-500 text-black hover:bg-orange-600 hover:text-black"
                          : "border-border hover:bg-muted text-foreground"
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

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-muted-foreground">Amplification Gain</span>
                  <span className="text-orange-400 font-mono">{gain.toFixed(1)}x</span>
                </div>
                <Slider
                  min={0.8}
                  max={3.0}
                  step={0.1}
                  value={[gain]}
                  onValueChange={(val) => setGain(val[0])}
                  className="py-1"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-muted-foreground">Gaussian Heat Bloom</span>
                  <span className="text-orange-400 font-mono">{bloom.toFixed(1)}px</span>
                </div>
                <Slider
                  min={0.0}
                  max={6.0}
                  step={0.2}
                  value={[bloom]}
                  onValueChange={(val) => setBloom(val[0])}
                  className="py-1"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-muted-foreground">Relative Temp Shift</span>
                  <span className="text-orange-400 font-mono">{tempOffset > 0 ? "+" : ""}{tempOffset.toFixed(1)}°C</span>
                </div>
                <Slider
                  min={-10.0}
                  max={15.0}
                  step={0.5}
                  value={[tempOffset]}
                  onValueChange={(val) => setTempOffset(val[0])}
                  className="py-1"
                />
              </div>
            </div>

            {/* Beginner Explanations & Recommendations Section */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="p-3 bg-orange-500/5 rounded-2xl border border-orange-500/10 font-mono text-[8px] text-orange-200/80 leading-normal space-y-1.5">
                <div className="font-bold text-orange-400 uppercase tracking-wider text-[9px]">💡 Smart Calibration Guide</div>
                <div>• <span className="text-foreground font-bold">Gain:</span> Multiplies thermal signal. Boost in winter. <span className="text-orange-400">Rec: 1.4x</span></div>
                <div>• <span className="text-foreground font-bold">Bloom:</span> Softens boundaries for realism. <span className="text-orange-400">Rec: 2.0px</span></div>
                <div>• <span className="text-foreground font-bold">Temp Shift:</span> Adjusts to match ambient room baseline. <span className="text-orange-400">Rec: 0.0°C</span></div>
                <div>• <span className="text-foreground font-bold">Palette:</span> Use <span className="text-orange-400">Ironbow</span> for intruders, <span className="text-emerald-400">Emerald</span> for sleep-stealth.</div>
              </div>

              <Button
                onClick={() => {
                  setGain(1.4);
                  setBloom(2.0);
                  setTempOffset(0.0);
                  setPalette("ironbow");
                }}
                variant="ghost"
                className="w-full flex items-center justify-center gap-1.5 border border-border hover:bg-muted rounded-2xl h-10 text-[10px] font-bold uppercase text-foreground"
              >
                <RefreshCw className="h-3 w-3" /> Reset Lab Settings
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
