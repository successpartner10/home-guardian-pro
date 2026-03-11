import { useRef, useState, useCallback, useEffect } from "react";
import type { DetectedObject } from "@tensorflow-models/coco-ssd";
import { useToast } from "./use-toast";

interface UseCameraOptions {
  onMotionDetected?: (imageData: string, objectLabel?: string) => void;
  onSoundDetected?: () => void;
  onObjectDetected?: (objects: DetectedObject[]) => void;
  motionSensitivity?: number;
  soundSensitivity?: number;
  aiFrequency?: number;
  autoZoom?: boolean;
  onZoneChange?: (zone: { x: number, y: number, width: number, height: number } | null) => void;
  detectionSchedule?: { enabled: boolean, start: string, end: string };
}

export const useCamera = ({
  onMotionDetected,
  onSoundDetected,
  onObjectDetected,
  motionSensitivity = 50,
  soundSensitivity = 50,
  aiFrequency = 10,
  autoZoom = false,
  detectionSchedule,
}: UseCameraOptions = {}) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const motionIntervalRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const frameCountRef = useRef(0);
  const isModelLoaded = useRef(false);

  const [isActive, setIsActive] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCenter, setZoomCenter] = useState({ x: 50, y: 50 });
  const [soundLevel, setSoundLevel] = useState(0);
  const [detectionZone, setDetectionZone] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const lastSoundAlertRef = useRef<number>(0);
  const lastMotionAlertRef = useRef<number>(0);

  // Sync stream to video element whenever activeStream changes
  useEffect(() => {
    if (videoRef.current && activeStream) {
      const video = videoRef.current;
      if (video.srcObject !== activeStream) {
        console.log("[useCamera] Syncing stream to video element. Tracks:", activeStream.getTracks().map(t => `${t.kind}:${t.readyState}`));
        video.srcObject = activeStream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;

        const playVideo = () => {
          video.play()
            .then(() => console.log("[useCamera] Video playback started successfully."))
            .catch(e => {
              console.warn("[useCamera] Video play initial attempt failed:", e);
              setTimeout(() => {
                video.play().catch(p => console.error("[useCamera] Video play retry failed:", p));
              }, 1000);
            });
        };

        if (video.readyState >= 2) playVideo();
        else video.onloadedmetadata = playVideo;
      }
    }
  }, [activeStream]);

  const startCamera = useCallback(async () => {
    console.log("[useCamera] startCamera initiated");
    try {
      let stream;
      try {
        const constraints = {
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        };
        console.log("[useCamera] Requesting (Env+Audio) with:", constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("[useCamera] Env+Audio failed, trying Fallback:", e);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
        });
      }
      console.log("[useCamera] Stream acquired successfully. Video tracks:", stream.getVideoTracks().length);
      streamRef.current = stream;
      setActiveStream(stream);
      setIsActive(true);
      setError(null);
    } catch (err: any) {
      console.warn("[useCamera] Audio+Video failed, trying Video-Only:", err);
      try {
        const videoOnlyStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        console.log("[useCamera] Video-Only stream acquired");
        streamRef.current = videoOnlyStream;
        setActiveStream(videoOnlyStream);
        setIsActive(true);
        setError(null);
        toast({
          title: "Microphone Access Denied",
          description: "Camera is active but audio is disabled.",
          variant: "destructive"
        });
      } catch (videoOnlyErr: any) {
        console.error("[useCamera] All capture attempts failed:", videoOnlyErr);
        setError(videoOnlyErr.message || "Camera access denied");
      }
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    console.log("[useCamera] stopCamera initiated");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActiveStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
    if (motionIntervalRef.current) {
      clearInterval(motionIntervalRef.current);
      motionIntervalRef.current = null;
    }
  }, []);

  const restartCamera = useCallback(async () => {
    console.log("[useCamera] restartCamera triggered");
    stopCamera();
    await new Promise(r => setTimeout(r, 500));
    await startCamera();
  }, [stopCamera, startCamera]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !t.enabled));
      setIsMuted((m) => !m);
    }
  }, []);

  const toggleFlash = useCallback(async () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      try {
        await (videoTrack as any).applyConstraints({ advanced: [{ torch: !flashOn }] });
        setFlashOn((f) => !f);
      } catch {
        // torch not supported
      }
    }
  }, [flashOn]);

  const takeSnapshot = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  // AI Worker Initialization
  useEffect(() => {
    const initWorker = async () => {
      try {
        const DetectionWorker = (await import("@/workers/detection.worker?worker")).default;
        const worker = new DetectionWorker();
        workerRef.current = worker;

        worker.onmessage = (e) => {
          if (e.data.type === "MODEL_LOADED") {
            isModelLoaded.current = true;
            console.log("AI Worker: Model Loaded");
          } else if (e.data.type === "DETECTIONS") {
            const detections = e.data.predictions as DetectedObject[];
            setDetectedObjects(detections);
            if (onObjectDetected) onObjectDetected(detections);

            // AI Smart Zoom Logic
            if (autoZoom && detections.length > 0) {
              const primary = detections.find(d => d.class === 'person') || detections[0];
              const [x, y, width, height] = primary.bbox;

              // Only zoom if object is small (too far)
              const areaRatio = (width * height) / (320 * 240);
              if (areaRatio < 0.25) {
                // Calculate zoom level (max 4.0)
                const targetZoom = Math.min(4.0, Math.max(1.0, 0.4 / areaRatio));
                setZoomLevel(targetZoom);

                // Calculate center percentage
                const centerX = ((x + width / 2) / 320) * 100;
                const centerY = ((y + height / 2) / 240) * 100;
                setZoomCenter({ x: centerX, y: centerY });
              } else {
                setZoomLevel(1);
              }
            } else if (autoZoom) {
              setZoomLevel(1);
            }
          }
        };

        worker.postMessage({ type: "LOAD_MODEL" });
      } catch (e) {
        console.error("Worker initialization failed", e);
      }
    };
    initWorker();

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Sync Zone to Worker
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "SET_ZONE", zone: detectionZone });
    }
  }, [detectionZone]);

  // Motion & AI Detection Loop
  useEffect(() => {
    if (!isActive) return;

    const checkSchedule = () => {
      if (!detectionSchedule?.enabled) return true;
      const now = new Date();
      const [sh, sm] = detectionSchedule.start.split(':').map(Number);
      const [eh, em] = detectionSchedule.end.split(':').map(Number);
      const startTime = new Date(now).setHours(sh, sm, 0, 0);
      let endTime = new Date(now).setHours(eh, em, 0, 0);

      // Handle overnight schedules
      if (endTime < startTime) {
        if (now.getTime() < endTime) return true;
        endTime += 24 * 60 * 60 * 1000;
      }
      return now.getTime() >= startTime && now.getTime() <= endTime;
    };

    const detect = async () => {
      if (!checkSchedule()) return;
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth === 0) return;

      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 320, 240);
      const currentFrame = ctx.getImageData(0, 0, 320, 240);

      // Brightness detection
      let totalB = 0;
      for (let i = 0; i < currentFrame.data.length; i += 16) {
        totalB += (currentFrame.data[i] + currentFrame.data[i + 1] + currentFrame.data[i + 2]) / 3;
      }
      setBrightness(Math.round(totalB / (currentFrame.data.length / 16)));

      // AI Detection (every X frames) - Offload to Worker
      let currentObjects: DetectedObject[] = detectedObjects;
      frameCountRef.current++;

      if (workerRef.current && isModelLoaded.current && frameCountRef.current % aiFrequency === 0) {
        // Send a copy for processing to allow worker to use transferable
        const processingData = new Uint8ClampedArray(currentFrame.data);
        workerRef.current.postMessage({
          type: "DETECT",
          imageData: processingData.buffer,
          width: 320,
          height: 240
        }, [processingData.buffer]);
      }

      // Motion Comparison
      if (prevFrameRef.current) {
        let diff = 0;
        const threshold = (100 - motionSensitivity) * 2 + 20;
        for (let i = 0; i < currentFrame.data.length; i += 16) {
          const rD = Math.abs(currentFrame.data[i] - prevFrameRef.current.data[i]);
          const gD = Math.abs(currentFrame.data[i + 1] - prevFrameRef.current.data[i + 1]);
          const bD = Math.abs(currentFrame.data[i + 2] - prevFrameRef.current.data[i + 2]);
          if (rD + gD + bD > threshold) diff++;
        }

        if (diff > 50 && onMotionDetected) {
          const now = Date.now();
          if (now - lastMotionAlertRef.current > 5000) {
            lastMotionAlertRef.current = now;
            const snapshot = canvas.toDataURL("image/jpeg", 0.5);
            const topObj = currentObjects.length > 0 ? currentObjects[0].class : undefined;
            onMotionDetected(snapshot, topObj);
          }
        }
      }
      prevFrameRef.current = currentFrame;
    };

    const interval = window.setInterval(detect, 500);
    return () => clearInterval(interval);
  }, [isActive, motionSensitivity, onMotionDetected, onObjectDetected, aiFrequency, detectionSchedule]);

  // Sound detection
  useEffect(() => {
    if (!isActive || !activeStream || isMuted) return;

    let soundInterval: number;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(activeStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      soundInterval = window.setInterval(() => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const vol = Math.min(100, Math.round((sum / buffer.length / 255) * 300));
        setSoundLevel(vol);

        if (vol > (100 - soundSensitivity) && onSoundDetected) {
          const now = Date.now();
          if (now - lastSoundAlertRef.current > 5000) {
            lastSoundAlertRef.current = now;
            onSoundDetected();
          }
        }
      }, 100);

      return () => {
        clearInterval(soundInterval);
        audioCtx.close();
      };
    } catch (e) {
      console.error("Audio error", e);
    }
  }, [isActive, activeStream, isMuted, soundSensitivity, onSoundDetected]);

  return {
    videoRef,
    canvasRef,
    isActive,
    isMuted,
    flashOn,
    error,
    stream: activeStream,
    soundLevel,
    brightness,
    detectedObjects,
    zoomLevel,
    zoomCenter,
    detectionZone,
    setDetectionZone,
    startCamera,
    stopCamera,
    restartCamera,
    toggleMute,
    toggleFlash,
    takeSnapshot,
  };
};
