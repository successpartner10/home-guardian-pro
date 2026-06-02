import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Camera, Radio, Server, X, Activity, HardDrive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// @ts-ignore - JSMpeg lacks types
import JSMpeg from "@cycjimmy/jsmpeg-player";

const IPCameraBridge = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [wsUrl, setWsUrl] = useState("ws://localhost:9999");
  const [cameraName, setCameraName] = useState("External IP Camera");
  const [isConnected, setIsConnected] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Initialize the WebRTC Hook (it will broadcast localStream to viewers)
  const webrtc = useWebRTC({
    deviceId: deviceId || "",
    role: "camera",
    localStream: localStream,
  });

  const connectBridge = async () => {
    if (!canvasRef.current || !user) return;
    
    try {
      // 1. Start JSMpeg Player from WebSocket
      playerRef.current = new JSMpeg.VideoElement(
        canvasRef.current.parentElement, 
        wsUrl, 
        { canvas: canvasRef.current, autoplay: true }
      );
      
      // 2. Extract WebRTC MediaStream from Canvas at 24fps
      const stream = canvasRef.current.captureStream(24);
      setLocalStream(stream);
      
      // 3. Register Device in Firebase
      const newId = `bridge_${Date.now()}`;
      await setDoc(doc(db, "devices", newId), {
        user_id: user.uid,
        name: cameraName,
        type: "camera",
        status: "online",
        is_bridge: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      
      setDeviceId(newId);
      setIsConnected(true);
      toast({ title: "Bridge Connected", description: "IP Camera is now live on the mesh." });
    } catch (e: any) {
      toast({ title: "Connection Failed", description: e.message, variant: "destructive" });
    }
  };

  const disconnectBridge = async () => {
    if (playerRef.current) {
      playerRef.current.destroy();
    }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    if (deviceId) {
      await deleteDoc(doc(db, "devices", deviceId));
    }
    setIsConnected(false);
    setDeviceId(null);
    setLocalStream(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deviceId) disconnectBridge();
    };
  }, [deviceId]);

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 pb-24">
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">IP Camera Bridge</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Ingest RTSP/ONVIF streams into WebRTC</p>
          </div>
        </div>

        {!isConnected ? (
          <div className="bg-card border rounded-3xl p-6 space-y-6">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <p className="text-xs font-medium text-amber-500/90 leading-relaxed">
                <strong>Prerequisite:</strong> You must have the Node.js Bridge Server running on this PC. <br/>
                <code className="bg-background/50 px-1 py-0.5 rounded text-[10px]">node bridge-server/index.js rtsp://your_camera_ip:554/stream 9999</code>
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Local WebSocket URL</label>
                <Input value={wsUrl} onChange={e => setWsUrl(e.target.value)} className="h-12 font-mono text-sm bg-muted/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Camera Display Name</label>
                <Input value={cameraName} onChange={e => setCameraName(e.target.value)} className="h-12 font-bold text-sm bg-muted/50 border-border" />
              </div>
              
              <Button onClick={connectBridge} className="w-full h-14 rounded-xl font-black uppercase tracking-widest text-sm bg-primary text-black">
                Inject Stream into Mesh
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-card border-2 border-primary/20 rounded-3xl overflow-hidden shadow-2xl shadow-primary/10">
              <div className="p-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-widest text-primary">Live WebRTC Injection Active</span>
                </div>
                <Button variant="ghost" size="sm" onClick={disconnectBridge} className="h-8 text-red-500 hover:text-red-400 hover:bg-red-500/10">
                  <X className="h-4 w-4 mr-1" /> Terminate
                </Button>
              </div>
              <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                <div className="w-full h-full">
                  <canvas ref={canvasRef} className="w-full h-full object-contain" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-card border rounded-2xl flex flex-col gap-1 items-center justify-center">
                <Activity className="h-5 w-5 text-green-500" />
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Signaling</span>
                <span className="text-sm font-black">{webrtc.connectionState}</span>
              </div>
              <div className="p-4 bg-card border rounded-2xl flex flex-col gap-1 items-center justify-center">
                <Camera className="h-5 w-5 text-primary" />
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Source</span>
                <span className="text-sm font-black">WS Canvas</span>
              </div>
              <div className="p-4 bg-card border rounded-2xl flex flex-col gap-1 items-center justify-center">
                <HardDrive className="h-5 w-5 text-amber-500" />
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Role</span>
                <span className="text-sm font-black">Bridge Node</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default IPCameraBridge;
