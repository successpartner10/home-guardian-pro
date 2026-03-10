import { useRef, useState, useCallback, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

interface UseCameraOptions {
  onMotionDetected?: (imageData: string, objectLabel?: string) => void;
  onSoundDetected?: () => void;
  onObjectDetected?: (objects: cocoSsd.DetectedObject[]) => void;
  motionSensitivity?: number;
  soundSensitivity?: number;
}

export const useCamera = ({
  onMotionDetected,
  onSoundDetected,
  onObjectDetected,
  motionSensitivity = 50,
  soundSensitivity = 50,
}: UseCameraOptions = {}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const motionIntervalRef = useRef<number | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const frameCountRef = useRef(0);

  const [isActive, setIsActive] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [detectedObjects, setDetectedObjects] = useState<cocoSsd.DetectedObject[]>([]);
  const [soundLevel, setSoundLevel] = useState(0);

  const lastSoundAlertRef = useRef<number>(0);
  const lastMotionAlertRef = useRef<number>(0);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setActiveStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Camera access denied");
    }
  }, []);

  const stopCamera = useCallback(() => {
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

  // AI Model Loading
  useEffect(() => {
    const loadAI = async () => {
      try {
        await tf.ready();
        const model = await cocoSsd.load();
        modelRef.current = model;
        console.log("coco-ssd model loaded");
      } catch (e) {
        console.error("AI load failed", e);
      }
    };
    loadAI();
  }, []);

  // Motion & AI Detection Loop
  useEffect(() => {
    if (!isActive) return;

    const detect = async () => {
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

      // AI Detection (every 10th frame)
      let currentObjects: cocoSsd.DetectedObject[] = [];
      frameCountRef.current++;
      if (modelRef.current && frameCountRef.current % 10 === 0) {
        currentObjects = await modelRef.current.detect(video);
        setDetectedObjects(currentObjects);
        if (onObjectDetected) onObjectDetected(currentObjects);
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
  }, [isActive, motionSensitivity, onMotionDetected, onObjectDetected]);

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
    startCamera,
    stopCamera,
    toggleMute,
    toggleFlash,
    takeSnapshot,
  };
};
