import "@testing-library/jest-dom";
import { vi } from "vitest";

// ─── Firebase Mocks ────────────────────────────────────────────────────────
vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: {
    onAuthStateChanged: vi.fn((cb: any) => { cb(null); return () => {}; }),
    currentUser: null,
  },
  storage: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn((...args: any[]) => args[0]),
  where: vi.fn(() => ({})),
  onSnapshot: vi.fn((_q: any, cb: any) => { cb({ docs: [], empty: true }); return () => {}; }),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
  addDoc: vi.fn(() => Promise.resolve({ id: "mock-doc-id" })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn((_db: any, ...path: string[]) => ({ id: path[path.length - 1] })),
  serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
  deleteField: vi.fn(() => ({})),
  limit: vi.fn((n: number) => n),
  orderBy: vi.fn((field: string) => field),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

// ─── Browser API Mocks ─────────────────────────────────────────────────────
const createMockTrack = (kind: "audio" | "video") => ({
  kind,
  enabled: true,
  readyState: "live" as MediaStreamTrackState,
  stop: vi.fn(),
  getCapabilities: vi.fn(() => ({})),
  applyConstraints: vi.fn(() => Promise.resolve()),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

const createMockStream = (): MediaStream => {
  const videoTrack = createMockTrack("video");
  const audioTrack = createMockTrack("audio");
  return {
    id: "mock-stream-id",
    active: true,
    getTracks: vi.fn(() => [videoTrack, audioTrack]),
    getVideoTracks: vi.fn(() => [videoTrack]),
    getAudioTracks: vi.fn(() => [audioTrack]),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStream;
};

Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn(() => Promise.resolve(createMockStream())),
    enumerateDevices: vi.fn(() => Promise.resolve([])),
  },
  writable: true,
});

// ─── RTCPeerConnection Mock ────────────────────────────────────────────────
const mockRTCPeerConnection = vi.fn(() => ({
  iceConnectionState: "new",
  connectionState: "new",
  signalingState: "stable",
  localDescription: null,
  remoteDescription: null,
  addTrack: vi.fn(),
  addStream: vi.fn(),
  createOffer: vi.fn(() => Promise.resolve({ type: "offer", sdp: "mock-sdp" })),
  createAnswer: vi.fn(() => Promise.resolve({ type: "answer", sdp: "mock-sdp" })),
  setLocalDescription: vi.fn(() => Promise.resolve()),
  setRemoteDescription: vi.fn(() => Promise.resolve()),
  addIceCandidate: vi.fn(() => Promise.resolve()),
  close: vi.fn(),
  createDataChannel: vi.fn(() => ({
    readyState: "open",
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  ondatachannel: null,
  onicecandidate: null,
  oniceconnectionstatechange: null,
  onconnectionstatechange: null,
  ontrack: null,
}));

global.RTCPeerConnection = mockRTCPeerConnection as any;

// ─── AudioContext Mock ────────────────────────────────────────────────────
const mockAudioContext = {
  createOscillator: vi.fn(() => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
  })),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  createAnalyser: vi.fn(() => ({
    fftSize: 512,
    frequencyBinCount: 256,
    getByteFrequencyData: vi.fn(),
  })),
  resume: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  state: "running",
  destination: {},
  currentTime: 0,
};

global.AudioContext = vi.fn(() => mockAudioContext) as any;
(global as any).webkitAudioContext = global.AudioContext;

// ─── Notification Mock ────────────────────────────────────────────────────
global.Notification = {
  permission: "granted",
  requestPermission: vi.fn(() => Promise.resolve("granted")),
} as any;

// ─── IntersectionObserver Mock ────────────────────────────────────────────
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// ─── ResizeObserver Mock ──────────────────────────────────────────────────
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// ─── matchMedia Mock ──────────────────────────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ─── localStorage / sessionStorage ───────────────────────────────────────
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});
