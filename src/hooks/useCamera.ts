import { useRef, useState, useCallback, useEffect } from "react";

interface UseCameraOptions {
  onMotionDetected?: (imageData: string) => void;
  motionSensitivity?: number;
}

export const useCamera = ({ onMotionDetected, motionSensitivity = 50 }: UseCameraOptions = {}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const motionIntervalRef = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Sound detection setup
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const soundIntervalRef = useRef<number | null>(null);
  const [soundLevel, setSoundLevel] = useState(0);

  useEffect(() => {
    if (!isActive || !activeStream || !!isMuted) {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
      setSoundLevel(0);
      return;
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }

      const audioSource = audioContextRef.current.createMediaStreamSource(activeStream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      audioSource.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      soundIntervalRef.current = window.setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }

        const avg = sum / bufferLength;
        const normalizedVolume = Math.min(100, Math.round((avg / 255) * 100 * 2)); // Amplify slightly

        setSoundLevel(normalizedVolume);

        // Trigger sound alert if volume > threshold (e.g. 60)
        // (onSoundDetected callback would go here in the future)
      }, 100);

    } catch (err) {
      console.error("Audio detection error:", err);
    }

    return () => {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
      }
    };
  }, [isActive, activeStream, isMuted]);

  // Motion detection
  useEffect(() => {
    if (!isActive || !onMotionDetected) return;

    const detect = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (video.videoWidth === 0) return;

      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 320, 240);
      const currentFrame = ctx.getImageData(0, 0, 320, 240);

      if (prevFrameRef.current) {
        let diff = 0;
        const threshold = (100 - motionSensitivity) * 2 + 20; // Map 0-100 to 220-20
        for (let i = 0; i < currentFrame.data.length; i += 16) {
          const r = Math.abs(currentFrame.data[i] - prevFrameRef.current.data[i]);
          const g = Math.abs(currentFrame.data[i + 1] - prevFrameRef.current.data[i + 1]);
          const b = Math.abs(currentFrame.data[i + 2] - prevFrameRef.current.data[i + 2]);
          if (r + g + b > threshold) diff++;
        }

        const changeRatio = diff / (currentFrame.data.length / 16);
        if (changeRatio > 0.05) {
          // Capture full-res snapshot
          const fullCanvas = document.createElement("canvas");
          fullCanvas.width = video.videoWidth;
          fullCanvas.height = video.videoHeight;
          const fullCtx = fullCanvas.getContext("2d");
          if (fullCtx) {
            fullCtx.drawImage(video, 0, 0);
            onMotionDetected(fullCanvas.toDataURL("image/jpeg", 0.7));
          }
        }
      }
      prevFrameRef.current = currentFrame;
    };

    motionIntervalRef.current = window.setInterval(detect, 500);
    return () => {
      if (motionIntervalRef.current) clearInterval(motionIntervalRef.current);
    };
  }, [isActive, onMotionDetected, motionSensitivity]);

  return {
    videoRef,
    canvasRef,
    isActive,
    isMuted,
    flashOn,
    error,
    stream: activeStream,
    soundLevel,
    startCamera,
    stopCamera,
    toggleMute,
    toggleFlash,
    takeSnapshot,
  };
};
