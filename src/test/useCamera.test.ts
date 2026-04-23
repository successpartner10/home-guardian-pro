import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCamera } from "@/hooks/useCamera";


// The navigator.mediaDevices mock is set up in setup.ts

describe("useCamera hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    getUserMedia.mockImplementation(() => Promise.resolve({
      id: "mock-stream",
        active: true,
        getTracks: vi.fn(() => []),
        getVideoTracks: vi.fn(() => [{ kind: "video", readyState: "live", stop: vi.fn(), getCapabilities: vi.fn(() => ({})), applyConstraints: vi.fn() }]),
        getAudioTracks: vi.fn(() => []),
        addTrack: vi.fn(),
        removeTrack: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
  });

  it("initializes with isActive=false and no error", () => {
    const { result } = renderHook(() => useCamera());
    expect(result.current.isActive).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isMuted).toBe(false);
    expect(result.current.flashOn).toBe(false);
  });

  it("exposes the correct API surface", () => {
    const { result } = renderHook(() => useCamera());
    expect(typeof result.current.startCamera).toBe("function");
    expect(typeof result.current.stopCamera).toBe("function");
    expect(typeof result.current.restartCamera).toBe("function");
    expect(typeof result.current.toggleMute).toBe("function");
    expect(typeof result.current.toggleFlash).toBe("function");
    expect(typeof result.current.takeSnapshot).toBe("function");
    expect(result.current.videoRef).toBeDefined();
    expect(result.current.canvasRef).toBeDefined();
  });

  it("sets isActive=true after startCamera succeeds", async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.error).toBeNull();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
  });

  it("requests camera with correct constraints", async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({ facingMode: "environment" }),
        audio: expect.anything(),
      })
    );
  });

  it("falls back gracefully when HD camera fails", async () => {
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    // Fail first call (HD), succeed on second
    let callCount = 0;
    getUserMedia.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("HD not supported"));
      return Promise.resolve({
        id: "fallback-stream",
        active: true,
        getTracks: vi.fn(() => []),
        getVideoTracks: vi.fn(() => [{ kind: "video", readyState: "live", stop: vi.fn(), getCapabilities: vi.fn(() => ({})), applyConstraints: vi.fn() }]),
        getAudioTracks: vi.fn(() => []),
        addTrack: vi.fn(),
        removeTrack: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
    });

    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isActive).toBe(true);
  });

  it("sets error when all camera attempts fail", async () => {
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    getUserMedia.mockRejectedValue(new Error("Camera denied"));

    const { result } = renderHook(() => useCamera({ highPrecisionAudio: false }));

    await act(async () => {
      await result.current.startCamera();
    });

    await waitFor(() => expect(result.current.isActive).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it("stopCamera sets isActive to false", async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });
    await waitFor(() => expect(result.current.isActive).toBe(true));

    act(() => {
      result.current.stopCamera();
    });

    expect(result.current.isActive).toBe(false);
  });

  it("toggleMute flips isMuted state", async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });
    await waitFor(() => expect(result.current.isActive).toBe(true));

    expect(result.current.isMuted).toBe(false);
    act(() => { result.current.toggleMute(); });
    expect(result.current.isMuted).toBe(true);
    act(() => { result.current.toggleMute(); });
    expect(result.current.isMuted).toBe(false);
  });

  it("takeSnapshot returns null when refs are not attached", () => {
    const { result } = renderHook(() => useCamera());
    const snap = result.current.takeSnapshot();
    expect(snap).toBeNull();
  });

  it("initializes with default zoom and brightness values", () => {
    const { result } = renderHook(() => useCamera());
    expect(result.current.zoomLevel).toBe(1);
    expect(result.current.zoomCenter).toEqual({ x: 50, y: 50 });
    expect(result.current.brightness).toBe(100);
  });

  it("restartCamera calls stopCamera then startCamera", async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });
    await waitFor(() => expect(result.current.isActive).toBe(true));

    await act(async () => {
      await result.current.restartCamera();
    });

    await waitFor(() => expect(result.current.isActive).toBe(true));
    // getUserMedia should have been called at least twice (start + restart)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("accepts onMotionDetected and onSoundDetected callbacks without error", () => {
    const onMotion = vi.fn();
    const onSound = vi.fn();
    expect(() => {
      renderHook(() => useCamera({ onMotionDetected: onMotion, onSoundDetected: onSound }));
    }).not.toThrow();
  });

  it("accepts ignoreZones option", () => {
    const zones = [{ x: 0, y: 0, width: 50, height: 50 }];
    expect(() => {
      renderHook(() => useCamera({ ignoreZones: zones }));
    }).not.toThrow();
  });
});
