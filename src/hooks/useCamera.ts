import { useRef, useState, useCallback, useEffect } from "react";
import { useToast } from "./use-toast";
interface UseCameraOptions {
  onMotionDetected?: (imageData: string, objectLabel?: string, detectedClasses?: string[]) => void;
  onSoundDetected?: (soundClass: string) => void;
  onFallDetected?: (snapshot: string) => void;
  motionSensitivity?: number;
  soundSensitivity?: number;
  onZoneChange?: (zone: { x: number, y: number, width: number, height: number } | null) => void;
  detectionSchedule?: { enabled: boolean, start: string, end: string };
  highPrecisionAudio?: boolean;
  ignoreZones?: { x: number, y: number, width: number, height: number }[];
  deviceId?: string;
  isScreenCapture?: boolean;
}

export const useCamera = ({
  onMotionDetected,
  onSoundDetected,
  onFallDetected,
  motionSensitivity = 50,
  soundSensitivity = 50,
  detectionSchedule,
  highPrecisionAudio = true,
  ignoreZones = [],
  deviceId,
  isScreenCapture = false,
}: UseCameraOptions = {}) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const motionIntervalRef = useRef<number | null>(null);
  const blackFrameCountRef = useRef(0);
  const cameraStartTimeRef = useRef(0);

  const [isActive, setIsActive] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCenter, setZoomCenter] = useState({ x: 50, y: 50 });
  const [soundLevel, setSoundLevel] = useState(0);
  const [detectionZone, setDetectionZone] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const lastSoundAlertRef = useRef<number>(0);
  const lastMotionAlertRef = useRef<number>(0);
  const lastFallAlertRef = useRef<number>(0);
  const fallFramesCountRef = useRef(0);

  // Sync stream to video element whenever activeStream changes
  useEffect(() => {
    if (videoRef.current && activeStream) {
      const video = videoRef.current;
      if (video.srcObject !== activeStream) {
        console.log("[useCamera] Syncing stream to video element. Tracks:", activeStream.getTracks().map(t => `${t.kind}:${t.readyState}`));
        video.srcObject = activeStream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.autoplay = true;

        const playVideo = async () => {
          try {
            await video.play();
            console.log("[useCamera] Video playback started successfully.");
          } catch (e) {
            console.warn("[useCamera] Video play initial attempt failed:", e);
          }
        };

        if (video.readyState >= 2) playVideo();
        else video.onloadedmetadata = playVideo;
      }
    }
  }, [activeStream]);

  const startCamera = useCallback(async () => {
    console.log("[useCamera] startCamera initiated");
    try {
      if (!navigator.mediaDevices) {
        throw new Error("Camera isn't available in this browser. Try opening the app with https:// or use Chrome/Safari on your phone.");
      }
      let stream;
      try {
        if (isScreenCapture) {
          console.log("[useCamera] Requesting Screen Capture for Bridge Mode...");
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" },
            audio: true
          });
        } else {
          const constraints: MediaStreamConstraints = {
            video: deviceId 
              ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: highPrecisionAudio ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } : true,
          };
          console.log("[useCamera] Requesting Hardware Camera...");
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
      } catch (e) {
        console.warn("[useCamera] HD requested failed, trying standard mobile Fallback:", e);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: true,
          });
        } catch (innerErr) {
          console.warn("[useCamera] Environmental failed, trying any available camera:", innerErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        }
      }
      console.log("[useCamera] Stream acquired successfully. Video tracks:", stream.getVideoTracks().length);
      cameraStartTimeRef.current = Date.now();
      streamRef.current = stream;
      setActiveStream(stream);
      // Direct attach as synchronous fallback in case useEffect fires before ref is ready
      if (videoRef.current) {
        const vid = videoRef.current;
        vid.srcObject = stream;
        vid.setAttribute('playsinline', 'true');
        vid.muted = true;
        vid.autoplay = true;
        vid.play().catch(e => console.warn("[useCamera] Immediate play failed:", e));
      }
      setIsActive(true);
      setError(null);
    } catch (err: any) {
      console.warn("[useCamera] Audio+Video failed, trying Video-Only:", err);
      try {
        // Try any camera without audio
        const videoOnlyStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        console.log("[useCamera] Video-Only stream acquired");
        streamRef.current = videoOnlyStream;
        setActiveStream(videoOnlyStream);
        // Direct attach fallback
        if (videoRef.current) {
          const vid = videoRef.current;
          vid.srcObject = videoOnlyStream;
          vid.setAttribute('playsinline', 'true');
          vid.muted = true;
          vid.autoplay = true;
          vid.play().catch(e => console.warn("[useCamera] Video-only immediate play failed:", e));
        }
        setIsActive(true);
        setError(null);
        toast({
          title: "Microphone Access Denied",
          description: "Camera is active but audio is disabled.",
          variant: "destructive"
        });
      } catch (videoOnlyErr: any) {
        console.error("[useCamera] All capture attempts failed:", videoOnlyErr);
        toast({
          title: "Can't open camera",
          description: "Allow camera access in your browser settings, then refresh this page.",
          variant: "destructive"
        });
        setError(videoOnlyErr.message || "Camera access denied. Check permissions in browser settings.");
      }
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    console.log("[useCamera] stopCamera initiated");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        console.log(`[useCamera] Stopping track: ${t.kind}`);
        t.stop();
      });
    }
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
      const nextState = !flashOn;
      
      try {
        // Some browsers require explicit check of capabilities
        const capabilities = videoTrack.getCapabilities() as any;
        if (capabilities && capabilities.torch) {
          await videoTrack.applyConstraints({
            advanced: [{ torch: nextState }]
          });
          setFlashOn(nextState);
          console.log(`[useCamera] Torch toggled to: ${nextState}`);
        } else {
          console.warn("[useCamera] Torch capability not detected on this track.");
          toast({
            title: "Flash Not Supported",
            description: "Your device camera does not support hardware flashlight control in this browser.",
            variant: "default"
          });
        }
      } catch (e) {
        console.error("[useCamera] Flash toggle failed:", e);
        // Fallback for browsers that might not support getCapabilities but might support applyConstraints
        try {
          await videoTrack.applyConstraints({
            advanced: [{ torch: nextState }]
          });
          setFlashOn(nextState);
        } catch (innerE) {
          console.warn("[useCamera] Torch constraint totally unsupported.");
        }
      }
    }
  }, [flashOn, toast]);

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

      // Brightness detection & Black Frame Recovery
      let totalB = 0;
      let pixelCount = 0;
      for (let i = 0; i < currentFrame.data.length; i += 16) {
        totalB += (currentFrame.data[i] + currentFrame.data[i + 1] + currentFrame.data[i + 2]) / 3;
        pixelCount++;
      }
      const avgBrightness = Math.round(totalB / pixelCount);
      setBrightness(avgBrightness);

      // Brightness metrics & auto-restart for black screen stall
      // Only trigger if brightness is EXACTLY 0 (complete sensor freeze, not just dark room)
      if (avgBrightness === 0) {
        blackFrameCountRef.current += 1;
        if (blackFrameCountRef.current > 30) { // 15 seconds at 500ms internal
          console.warn("[useCamera] Extended dead stream detected (0% Brightness). Executing hardware reset...");
          restartCamera();
          blackFrameCountRef.current = 0;
        }
      } else {
        blackFrameCountRef.current = 0;
      }

      // Motion Comparison
      if (prevFrameRef.current) {
        let diff = 0;
        const threshold = (100 - motionSensitivity) * 2 + 20;
        
        for (let i = 0; i < currentFrame.data.length; i += 16) {
          const pixelIdx = i / 4;
          const px = pixelIdx % 320;
          const py = Math.floor(pixelIdx / 320);

          // Check if pixel is in an ignore zone
          const isInIgnoreZone = ignoreZones.some(zone => 
            px >= (zone.x * 320 / 100) && 
            px <= ((zone.x + zone.width) * 320 / 100) &&
            py >= (zone.y * 240 / 100) && 
            py <= ((zone.y + zone.height) * 240 / 100)
          );

          if (isInIgnoreZone) continue;

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
            onMotionDetected(snapshot, undefined, undefined);
          }
        }
      }
      prevFrameRef.current = currentFrame;
    };

    const interval = window.setInterval(detect, 500);
    return () => clearInterval(interval);
  }, [isActive, motionSensitivity, onMotionDetected, detectionSchedule]);

  // Sound detection
  useEffect(() => {
    if (!isActive || !activeStream || isMuted) return;

    let soundInterval: number;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(activeStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512; // 256 frequency bins
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      soundInterval = window.setInterval(() => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        let lowSum = 0;  // Bins 0-20 (0-2kHz): Dog barks, thuds, bass
        let midSum = 0;  // Bins 21-100 (2kHz-8kHz): Vocals, baby cries
        let highSum = 0; // Bins 101-255 (8kHz+): Glass breaking, shattering

        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
          if (i <= 20) lowSum += buffer[i];
          else if (i <= 100) midSum += buffer[i];
          else highSum += buffer[i];
        }

        const vol = Math.min(100, Math.round((sum / buffer.length / 255) * 300));
        setSoundLevel(vol);

        if (vol > (100 - soundSensitivity) && onSoundDetected) {
          const now = Date.now();
          if (now - lastSoundAlertRef.current > 5000) {
            lastSoundAlertRef.current = now;

            // Enhanced Audio AI Frequency Classification
            const lowAvg = lowSum / 21;   // 0–2kHz: thuds, bass
            const midAvg = midSum / 80;   // 2–8kHz: voice, baby cry, smoke alarm
            const highAvg = highSum / 155; // 8kHz+: glass shatter

            // Smoke alarm signature: sustained pulsing around 3kHz (mid-low range)
            const smokeBandSum = Array.from(buffer).slice(30, 55).reduce((a, b) => a + b, 0);
            const smokeBandAvg = smokeBandSum / 25;

            let detectedClass = "sound_loud_noise";
            let detectedLabel = "Loud Noise Detected";

            if (highAvg > 60 && highAvg > lowAvg * 2 && highAvg > midAvg * 1.5) {
              detectedClass = "sound_glass_break";
              detectedLabel = "Glass Break / Shatter Detected";
            } else if (smokeBandAvg > 80 && smokeBandAvg > lowAvg * 2) {
              detectedClass = "sound_smoke_alarm";
              detectedLabel = "Smoke Alarm / Fire Alert Detected";
            } else if (midAvg > 50 && midAvg > lowAvg * 1.5 && midAvg > highAvg * 2) {
              detectedClass = "sound_baby_cry";
              detectedLabel = "Baby Crying / Voice Detected";
            } else if (lowAvg > midAvg * 1.5 && lowAvg > highAvg) {
              detectedClass = "sound_dog_bark";
              detectedLabel = "Dog Bark / Heavy Thud Detected";
            }

            onSoundDetected(detectedLabel);
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
