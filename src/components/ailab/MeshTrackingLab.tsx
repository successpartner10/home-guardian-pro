import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Play, Pause, RefreshCw, Radio, Camera, ShieldCheck, Activity, Users } from "lucide-react";

interface MeshTrackingLabProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TargetType = "intruder" | "pet" | "courier";

interface TrackingLog {
  id: string;
  time: string;
  camera: string;
  event: string;
  severity: "info" | "success" | "warning" | "danger";
}

export const MeshTrackingLab = ({ open, onOpenChange }: MeshTrackingLabProps) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [targetType, setTargetType] = useState<TargetType>("intruder");
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [logs, setLogs] = useState<TrackingLog[]>([]);
  const [activeCam, setActiveCam] = useState<number>(1);
  const [activeConfidence, setActiveConfidence] = useState<number>(99);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  // Simulation target states
  const targetPos = useRef({ x: 100, y: 150 });
  const targetHeading = useRef(0);
  const targetAngle = useRef(0);

  // Cameras positions on 2D map
  // Canvas scale: 500 x 300
  const cameras = [
    { id: 1, name: "CAM-01 [Driveway]", x: 60, y: 60, angle: 45, range: 130, spread: 60, color: "#ef4444" },
    { id: 2, name: "CAM-02 [Front Porch]", x: 250, y: 60, angle: 90, range: 140, spread: 70, color: "#3b82f6" },
    { id: 3, name: "CAM-03 [Side Yard]", x: 420, y: 120, angle: 135, range: 130, spread: 60, color: "#22c55e" }
  ];

  // Helper to add logs
  const addLog = (camera: string, event: string, severity: TrackingLog["severity"]) => {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs(prev => [
      { id: Math.random().toString(36).substr(2, 9), time: timeStr, camera, event, severity },
      ...prev
    ].slice(0, 15));
  };

  // Initialize tracking logs
  useEffect(() => {
    if (open) {
      setLogs([]);
      addLog("Mesh Coordinator", "Neural Mesh initialized", "info");
      addLog("Mesh Coordinator", "Sub-nodes CAM-01, CAM-02, CAM-03 online", "success");
    }
  }, [open]);

  // Main interactive simulation loop
  useEffect(() => {
    if (!open) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localAngle = targetAngle.current;
    let localPos = { ...targetPos.current };
    let currentActiveCam = activeCam;

    const drawSimulation = () => {
      if (isPlaying) {
        // Move target in a continuous loop pattern through camera ranges
        localAngle += 0.008 * speedMultiplier;
        targetAngle.current = localAngle;

        // Interactive figure-8 path around the zones
        localPos.x = 250 + Math.sin(localAngle) * 160;
        localPos.y = 150 + Math.sin(localAngle * 2) * 75;
        targetPos.current = localPos;
      }

      // 1. Clear with dark background
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid pattern (holographic/security look)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 25;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Draw Camera Cones (Zones)
      cameras.forEach(cam => {
        const startRad = ((cam.angle - cam.spread / 2) * Math.PI) / 180;
        const endRad = ((cam.angle + cam.spread / 2) * Math.PI) / 180;

        // Calculate overlap/coverage alpha
        const dist = Math.hypot(localPos.x - cam.x, localPos.y - cam.y);
        // Check if inside coverage sector
        const targetRad = Math.atan2(localPos.y - cam.y, localPos.x - cam.x);
        let diffAngle = targetRad - (cam.angle * Math.PI) / 180;
        // Normalize angle to [-PI, PI]
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        
        const isInsideCone = dist <= cam.range && Math.abs(diffAngle) <= ((cam.spread / 2) * Math.PI) / 180;

        ctx.beginPath();
        ctx.moveTo(cam.x, cam.y);
        ctx.arc(cam.x, cam.y, cam.range, startRad, endRad);
        ctx.closePath();

        // Make active tracking camera highlight brighter
        if (isInsideCone) {
          ctx.fillStyle = `${cam.color}18`;
          ctx.strokeStyle = `${cam.color}60`;
          ctx.lineWidth = 1.5;
        } else {
          ctx.fillStyle = `${cam.color}05`;
          ctx.strokeStyle = `${cam.color}20`;
          ctx.lineWidth = 1;
        }
        ctx.fill();
        ctx.stroke();

        // Draw camera node icon/dot
        ctx.fillStyle = isInsideCone ? cam.color : "#44403c";
        ctx.beginPath();
        ctx.arc(cam.x, cam.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Camera name tag
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "8px monospace";
        ctx.fillText(cam.name.split(" ")[0], cam.x - 12, cam.y - 12);
      });

      // 3. Compute best tracking camera based on distance & angle
      let bestCam = -1;
      let minDistance = 9999;
      let highestConf = 0;

      cameras.forEach(cam => {
        const dist = Math.hypot(localPos.x - cam.x, localPos.y - cam.y);
        const targetRad = Math.atan2(localPos.y - cam.y, localPos.x - cam.x);
        let diffAngle = targetRad - (cam.angle * Math.PI) / 180;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

        const isInsideCone = dist <= cam.range && Math.abs(diffAngle) <= ((cam.spread / 2) * Math.PI) / 180;

        if (isInsideCone) {
          // Confidence scales inversely with distance and center offset
          const distFactor = 1.0 - (dist / cam.range);
          const angleFactor = 1.0 - (Math.abs(diffAngle) / ((cam.spread / 2) * Math.PI / 180));
          const confidence = Math.round((distFactor * 0.6 + angleFactor * 0.4) * 40 + 60);

          if (confidence > highestConf) {
            highestConf = confidence;
            bestCam = cam.id;
          }
        }
      });

      // 4. Handle Handover logic / alerts
      if (bestCam !== -1 && bestCam !== currentActiveCam) {
        const prevCamName = currentActiveCam === -1 ? "None" : `CAM-0${currentActiveCam}`;
        const nextCamName = `CAM-0${bestCam}`;
        
        addLog("Mesh Coordinator", `Initiating tracking handover: ${prevCamName} ➔ ${nextCamName}`, "warning");
        addLog(nextCamName, `Lock acquired (Confidence: ${highestConf}%)`, "success");
        
        currentActiveCam = bestCam;
        setActiveCam(bestCam);
      } else if (bestCam === -1 && currentActiveCam !== -1) {
        addLog("Mesh Coordinator", `Target lost - entering mesh search protocol`, "danger");
        currentActiveCam = -1;
        setActiveCam(-1);
      }

      if (bestCam !== -1) {
        setActiveConfidence(highestConf);
      } else {
        setActiveConfidence(0);
      }

      // 5. Draw the walking tracked target
      const targetColor = targetType === "intruder" ? "#ef4444" : targetType === "pet" ? "#f97316" : "#eab308";
      
      // Bounding box draw around the target on map
      ctx.strokeStyle = targetColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(localPos.x - 14, localPos.y - 20, 28, 40);
      ctx.setLineDash([]);

      // Draw glowing target dot
      const radGrad = ctx.createRadialGradient(localPos.x, localPos.y, 2, localPos.x, localPos.y, 16);
      radGrad.addColorStop(0, "#ffffff");
      radGrad.addColorStop(0.3, targetColor);
      radGrad.addColorStop(1.0, "transparent");
      
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(localPos.x, localPos.y, 16, 0, Math.PI * 2);
      ctx.fill();

      // Class Tag above target
      ctx.fillStyle = targetColor;
      ctx.fillRect(localPos.x - 30, localPos.y - 34, 60, 10);
      
      ctx.fillStyle = "#000000";
      ctx.font = "bold 7px monospace";
      const targetLabel = targetType.toUpperCase();
      ctx.fillText(targetLabel, localPos.x - 26, localPos.y - 26);

      // 6. Draw connection lines between camera and target (Mesh rays)
      if (bestCam !== -1) {
        const activeNode = cameras.find(c => c.id === bestCam)!;
        ctx.strokeStyle = activeNode.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(activeNode.x, activeNode.y);
        ctx.lineTo(localPos.x, localPos.y);
        ctx.stroke();

        // Pulsing radio wave circles between camera and target
        const pulseRatio = (Date.now() % 1000) / 1000;
        ctx.strokeStyle = `${activeNode.color}${Math.floor((1 - pulseRatio) * 255).toString(16).padStart(2, "0")}`;
        ctx.beginPath();
        ctx.arc(activeNode.x, activeNode.y, activeNode.range * pulseRatio, (activeNode.angle - activeNode.spread/2) * Math.PI/180, (activeNode.angle + activeNode.spread/2) * Math.PI/180);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(drawSimulation);
    };

    drawSimulation();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [open, isPlaying, targetType, speedMultiplier, activeCam]);

  // Handle manual coordinate placement by clicking on the map
  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Convert click client coordinates to local canvas coordinate values
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    targetPos.current = { x: clickX, y: clickY };
    
    // Pause auto route when user clicks to guide manually
    setIsPlaying(false);
    
    addLog("Manual Control", `User placed target at coordinate (${Math.round(clickX)}, ${Math.round(clickY)})`, "info");
  };

  const getTargetDetails = () => {
    switch (targetType) {
      case "intruder":
        return { label: "INTRUDER", threat: "CRITICAL", action: "COOPERATIVE DEFENSIVE LIGHTING ACTIVE" };
      case "pet":
        return { label: "DOMESTIC ANIMAL", threat: "NONE", action: "LOG EVENT / MUTE AUDIO ALERTS" };
      case "courier":
        return { label: "CARRIER / DELIVERY", threat: "LOW", action: "PORTAL LIGHT ON / SECURE RECORD" };
    }
  };

  const activeNodeDetails = cameras.find(c => c.id === activeCam);
  const targetInfo = getTargetDetails();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-stone-950 border-2 border-stone-800 text-stone-100 rounded-[2.5rem] p-6 overflow-hidden">
        
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3 text-sky-400">
            <Sparkles className="h-8 w-8 animate-pulse" />
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Cross-Camera Mesh Tracking Lab</DialogTitle>
          </div>
          <DialogDescription className="text-stone-400 font-medium">
            Experience real-time seamless handovers across multiple overlapping edge nodes. Observe neural mesh cooperative object tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          {/* Main Visual Arena (Canvas & Feeds) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Top Coordinator Banner */}
            <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className={`h-5 w-5 ${activeCam !== -1 ? "text-emerald-500 animate-pulse" : "text-red-500"}`} />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-500">Unified Follow Feed</div>
                  <div className="text-xs font-black uppercase text-stone-200">
                    {activeCam !== -1 ? `Active Feed: CAM-0${activeCam} [${activeNodeDetails?.name.split("[")[1]}` : "Mesh Protocol: Node Searching"}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 font-mono text-[10px]">
                <div className="text-right">
                  <div className="text-stone-500 uppercase">Mesh Lock</div>
                  <div className={`font-bold ${activeCam !== -1 ? "text-emerald-400" : "text-red-400"}`}>
                    {activeCam !== -1 ? "STABLE LOCK" : "SEARCHING"}
                  </div>
                </div>
                <div className="text-right border-l border-stone-800 pl-4">
                  <div className="text-stone-500 uppercase">Confidence</div>
                  <div className="font-bold text-sky-400">{activeConfidence}%</div>
                </div>
              </div>
            </div>

            {/* 2D Interactive Tracking Map Arena */}
            <div className="relative rounded-[2rem] overflow-hidden border border-stone-800 bg-stone-950 flex flex-col items-center">
              <canvas
                ref={canvasRef}
                width={500}
                height={280}
                onClick={handleMapClick}
                className="w-full aspect-[500/280] cursor-crosshair"
              />
              
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/5 font-mono text-[8px] text-stone-400 uppercase tracking-widest">
                💡 Click anywhere on map to guide target manually
              </div>
            </div>

            {/* Sub-Feeds Preview Grid */}
            <div className="grid grid-cols-3 gap-4">
              {cameras.map(cam => {
                const isActive = activeCam === cam.id;
                return (
                  <div 
                    key={cam.id} 
                    className={`p-4 rounded-3xl border transition-all duration-300 ${
                      isActive 
                        ? "bg-stone-900 border-sky-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]" 
                        : "bg-stone-900/40 border-stone-800 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase text-stone-400">{cam.name.split(" ")[0]}</span>
                      <div className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500 animate-ping" : "bg-stone-700"}`} />
                    </div>
                    
                    <div className="h-16 rounded-2xl bg-black/60 border border-stone-800/80 flex items-center justify-center font-mono text-[9px] relative overflow-hidden">
                      {isActive ? (
                        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-2 bg-sky-950/20">
                          <span className="font-black text-sky-400 animate-pulse">TRACKING</span>
                          <span className="text-stone-400 text-[8px]">POS: {Math.round(targetPos.current.x)}, {Math.round(targetPos.current.y)}</span>
                        </div>
                      ) : (
                        <span className="text-stone-600 uppercase font-bold tracking-widest">Standby</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Controls & Live Console */}
          <div className="lg:col-span-4 space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Telemetry Block */}
              <div className="p-5 rounded-[2rem] bg-stone-900 border border-stone-800 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-sky-400" /> Neural Lock Telemetry
                </h3>
                
                <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
                  <div>
                    <span className="text-stone-500 uppercase">Target ID:</span>
                    <div className="font-bold text-stone-200">#TRK-A42</div>
                  </div>
                  <div>
                    <span className="text-stone-500 uppercase">Class:</span>
                    <div className="font-bold text-sky-400 uppercase">{targetInfo.label}</div>
                  </div>
                  <div>
                    <span className="text-stone-500 uppercase">Threat Level:</span>
                    <div className={`font-bold ${targetType === "intruder" ? "text-red-400" : targetType === "pet" ? "text-stone-400" : "text-yellow-400"}`}>
                      {targetInfo.threat}
                    </div>
                  </div>
                  <div>
                    <span className="text-stone-500 uppercase">Mesh Nodes:</span>
                    <div className="font-bold text-stone-200">3 Synced</div>
                  </div>
                </div>

                <div className="p-3 bg-black/40 rounded-2xl border border-stone-800/80 font-mono text-[9px] text-emerald-400/90 leading-tight">
                  <span className="font-bold uppercase text-white">System Response:</span>
                  <p className="mt-1">{targetInfo.action}</p>
                </div>
              </div>

              {/* Lab Controls */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex-1 rounded-2xl h-12 text-xs font-black uppercase border border-stone-800 bg-stone-900 hover:bg-stone-850 text-white"
                  >
                    {isPlaying ? (
                      <span className="flex items-center gap-2"><Pause className="h-4 w-4 text-amber-500" /> Pause Loop</span>
                    ) : (
                      <span className="flex items-center gap-2"><Play className="h-4 w-4 text-emerald-500" /> Resume Loop</span>
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={() => {
                      targetAngle.current = 0;
                      targetPos.current = { x: 100, y: 150 };
                      setIsPlaying(true);
                      addLog("Mesh Coordinator", "Loop path reset to origin", "info");
                    }}
                    className="p-3 border border-stone-800 bg-stone-900/30 hover:bg-stone-900 rounded-2xl"
                  >
                    <RefreshCw className="h-4 w-4 text-stone-400" />
                  </Button>
                </div>

                {/* Target Type Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-stone-500">Target Specimen</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["intruder", "pet", "courier"] as TargetType[]).map(t => (
                      <Button
                        key={t}
                        onClick={() => {
                          setTargetType(t);
                          addLog("Mesh Coordinator", `Target model re-classified to ${t.toUpperCase()}`, "info");
                        }}
                        className={`h-10 font-mono text-[8px] font-black uppercase rounded-xl transition-all ${
                          targetType === t 
                            ? "bg-sky-500 border-sky-500 text-stone-950 hover:bg-sky-600 hover:text-stone-950" 
                            : "border-stone-800 bg-stone-900/35 hover:bg-stone-900 text-stone-300"
                        }`}
                      >
                        {t === "intruder" && "🔴 Intruder"}
                        {t === "pet" && "🟠 Animal"}
                        {t === "courier" && "🟡 Delivery"}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Target Path Speed */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                    <span className="text-stone-400">Simulation Velocity</span>
                    <span className="text-sky-400 font-mono">{speedMultiplier.toFixed(1)}x</span>
                  </div>
                  <Slider
                    min={0.2}
                    max={2.5}
                    step={0.1}
                    value={[speedMultiplier]}
                    onValueChange={(val) => setSpeedMultiplier(val[0])}
                    className="py-2"
                  />
                </div>
              </div>
            </div>

            {/* Neural Log Console */}
            <div className="space-y-2 border-t border-stone-900 pt-4 flex-1 flex flex-col min-h-[160px]">
              <label className="text-[10px] font-black uppercase tracking-wider text-stone-500">Cooperative Node Console</label>
              
              <div className="flex-1 bg-black/60 border border-stone-900 rounded-2xl p-4 font-mono text-[8px] space-y-2 overflow-y-auto max-h-[220px]">
                {logs.length === 0 ? (
                  <div className="text-stone-700 italic">Console starting...</div>
                ) : (
                  logs.map(log => {
                    const color = 
                      log.severity === "success" ? "text-emerald-400" :
                      log.severity === "warning" ? "text-amber-400" :
                      log.severity === "danger" ? "text-red-400" : "text-sky-400";
                    
                    return (
                      <div key={log.id} className="leading-normal flex gap-2">
                        <span className="text-stone-600 font-bold">[{log.time}]</span>
                        <span className="text-stone-400 font-black shrink-0">{log.camera}:</span>
                        <span className={color}>{log.event}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
