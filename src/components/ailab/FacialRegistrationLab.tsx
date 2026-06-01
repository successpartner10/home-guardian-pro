import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, ScanFace, Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import * as faceapi from "@vladmandic/face-api";

export const FacialRegistrationLab = ({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [descriptor, setDescriptor] = useState<Float32Array | null>(null);
  const [name, setName] = useState("");
  const [savedFaces, setSavedFaces] = useState<{id: string, name: string}[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Load models on open
  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    
    loadModels();
    fetchSavedFaces();
  }, [open]);

  const loadModels = async () => {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
      setModelsLoaded(true);
      startCamera();
    } catch (e) {
      console.error("Error loading models:", e);
      toast({ title: "Error", description: "Failed to load AI models.", variant: "destructive" });
    }
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (e) {
      toast({ title: "Camera Error", description: "Could not access camera.", variant: "destructive" });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  const fetchSavedFaces = async () => {
    if (!user) return;
    const snap = await getDocs(collection(db, "profiles", user.uid, "faces"));
    const faces = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
    setSavedFaces(faces);
  };

  const handleCapture = async () => {
    if (!videoRef.current || !modelsLoaded) return;
    
    setIsCapturing(true);
    try {
      const detection = await faceapi.detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast({ title: "No face detected", description: "Please look directly at the camera.", variant: "destructive" });
        setIsCapturing(false);
        return;
      }

      setDescriptor(detection.descriptor);
      toast({ title: "Face Scanned", description: "Face features extracted successfully." });
    } catch (e) {
      toast({ title: "Scan Failed", description: "An error occurred during scanning.", variant: "destructive" });
    }
    setIsCapturing(false);
  };

  const handleSave = async () => {
    if (!user || !descriptor || !name.trim()) return;
    try {
      const faceId = Date.now().toString();
      await setDoc(doc(db, "profiles", user.uid, "faces", faceId), {
        name: name.trim(),
        descriptor: Array.from(descriptor), // Convert Float32Array to standard array for Firestore
        createdAt: new Date().toISOString()
      });
      
      toast({ title: "Identity Saved", description: `${name} has been added to the known faces registry.` });
      setDescriptor(null);
      setName("");
      fetchSavedFaces();
    } catch (e) {
      toast({ title: "Save Failed", description: "Could not save to database.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "profiles", user.uid, "faces", id));
    fetchSavedFaces();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-card border w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-500/20 text-blue-500 flex items-center justify-center">
                  <ScanFace className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-foreground font-black tracking-tight text-xl">Identity Registry</h2>
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Edge Facial Recognition</p>
                </div>
              </div>
              <button 
                onClick={() => onOpenChange(false)} 
                className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {!modelsLoaded ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4 text-muted-foreground border-2 border-dashed border-border rounded-3xl">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="font-bold uppercase tracking-widest text-xs">Loading Neural Models...</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Camera Section */}
                  <div className="space-y-4">
                    <div className="relative rounded-3xl overflow-hidden bg-black aspect-[4/3] border">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        muted 
                        playsInline 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      {/* Scanning overlay */}
                      <div className="absolute inset-0 border-2 border-blue-500/50 m-8 rounded-2xl border-dashed" />
                    </div>
                    
                    {!descriptor ? (
                      <Button 
                        onClick={handleCapture} 
                        disabled={isCapturing}
                        className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isCapturing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Camera className="h-5 w-5 mr-2" />}
                        Scan Face
                      </Button>
                    ) : (
                      <div className="space-y-3 bg-muted/30 p-4 rounded-3xl border border-border">
                        <div className="flex items-center gap-2 text-green-500 mb-2">
                          <Check className="h-5 w-5" />
                          <span className="font-bold text-sm">Face Signature Extracted</span>
                        </div>
                        <Input 
                          placeholder="Enter person's name..." 
                          value={name} 
                          onChange={(e) => setName(e.target.value)}
                          className="bg-background border-border h-12 rounded-xl px-4 font-bold"
                        />
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleSave} 
                            disabled={!name.trim()}
                            className="flex-1 h-12 rounded-xl font-black bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <Save className="h-4 w-4 mr-2" /> Save Identity
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setDescriptor(null)}
                            className="h-12 rounded-xl font-bold"
                          >
                            Retry
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Registered Faces Section */}
                  <div className="space-y-4">
                    <h3 className="font-black text-sm text-foreground uppercase tracking-widest border-b pb-2">Known Identities</h3>
                    {savedFaces.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-medium">No faces registered yet. When recognized, cameras will announce these people by name.</p>
                    ) : (
                      <div className="space-y-2">
                        {savedFaces.map(face => (
                          <div key={face.id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border">
                            <span className="font-bold text-foreground text-sm">{face.name}</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDelete(face.id)}
                              className="text-red-500 hover:bg-red-500/10 hover:text-red-600 rounded-xl h-8 px-3 text-xs font-bold"
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
