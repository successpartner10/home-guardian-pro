import { describe, it, expect } from "vitest";

// ─── Utility: formatTime ───────────────────────────────────────────────────
const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
};

describe("formatTime utility", () => {
  it("formats zero seconds as 00:00:00", () => {
    expect(formatTime(0)).toBe("00:00:00");
  });

  it("formats 59 seconds correctly", () => {
    expect(formatTime(59)).toBe("00:00:59");
  });

  it("formats 60 seconds as 00:01:00", () => {
    expect(formatTime(60)).toBe("00:01:00");
  });

  it("formats 3661 seconds as 01:01:01", () => {
    expect(formatTime(3661)).toBe("01:01:01");
  });

  it("formats 3600 seconds as 01:00:00", () => {
    expect(formatTime(3600)).toBe("01:00:00");
  });

  it("formats large values (12 hours)", () => {
    expect(formatTime(43200)).toBe("12:00:00");
  });
});

// ─── Device ID persistence ─────────────────────────────────────────────────
const getOrCreateDeviceId = (): string => {
  let id = localStorage.getItem("hguard_device_persistent_id");
  if (!id) {
    id = Math.random().toString(36).substring(2, 12);
    localStorage.setItem("hguard_device_persistent_id", id);
  }
  return id;
};

describe("getOrCreateDeviceId", () => {
  it("creates a new ID when none exists", () => {
    const id = getOrCreateDeviceId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThanOrEqual(8);
  });

  it("returns the same ID on subsequent calls", () => {
    const id1 = getOrCreateDeviceId();
    const id2 = getOrCreateDeviceId();
    expect(id1).toBe(id2);
  });

  it("persists the ID in localStorage", () => {
    const id = getOrCreateDeviceId();
    expect(localStorage.getItem("hguard_device_persistent_id")).toBe(id);
  });

  it("reuses an existing ID if already stored", () => {
    localStorage.setItem("hguard_device_persistent_id", "test-persistent-id");
    const id = getOrCreateDeviceId();
    expect(id).toBe("test-persistent-id");
  });
});

// ─── Alert sorting logic ───────────────────────────────────────────────────
interface MockAlert {
  id: string;
  created_at: Date | { toDate: () => Date };
  viewed: boolean;
}

const sortAlerts = (alerts: MockAlert[]) => {
  return [...alerts].sort((a, b) => {
    const timeA = a.created_at instanceof Date ? a.created_at : (a.created_at as any).toDate();
    const timeB = b.created_at instanceof Date ? b.created_at : (b.created_at as any).toDate();
    return timeB.getTime() - timeA.getTime();
  });
};

describe("Alert sorting logic", () => {
  const now = new Date();
  const older = new Date(now.getTime() - 60000);
  const newest = new Date(now.getTime() + 60000);

  const alerts: MockAlert[] = [
    { id: "a1", created_at: older, viewed: true },
    { id: "a2", created_at: newest, viewed: false },
    { id: "a3", created_at: now, viewed: false },
  ];

  it("sorts newest-first", () => {
    const sorted = sortAlerts(alerts);
    expect(sorted[0].id).toBe("a2");
    expect(sorted[1].id).toBe("a3");
    expect(sorted[2].id).toBe("a1");
  });

  it("handles Firestore Timestamp objects (toDate)", () => {
    const firestoreAlerts: MockAlert[] = [
      { id: "b1", created_at: { toDate: () => older }, viewed: false },
      { id: "b2", created_at: { toDate: () => newest }, viewed: false },
    ];
    const sorted = sortAlerts(firestoreAlerts);
    expect(sorted[0].id).toBe("b2");
  });

  it("does not mutate the original array", () => {
    const original = [...alerts];
    sortAlerts(alerts);
    expect(alerts[0].id).toBe(original[0].id);
  });
});

// ─── Device name detection logic ───────────────────────────────────────────
const detectDeviceName = (userAgent: string): string => {
  if (/Android/i.test(userAgent)) {
    const match = userAgent.match(/Android\s+[\d.]+;\s+([^;]+)\s+Build/i) || userAgent.match(/\(([^;]+);\s+Android/i);
    return match ? match[1].trim() : "Android Phone";
  }
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return /iPad/.test(userAgent) ? "iPad" : "iPhone";
  }
  if (/Macintosh/i.test(userAgent)) return "MacBook / iMac";
  if (/Windows/i.test(userAgent)) return "Windows PC";
  return "Unknown Device";
};

describe("deviceName detection", () => {
  it("detects Android device from UA", () => {
    const ua = "Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SP2A) AppleWebKit/537.36";
    expect(detectDeviceName(ua)).toBe("Pixel 6");
  });

  it("detects iPhone", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
    expect(detectDeviceName(ua)).toBe("iPhone");
  });

  it("detects iPad", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)";
    expect(detectDeviceName(ua)).toBe("iPad");
  });

  it("detects Mac", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit";
    expect(detectDeviceName(ua)).toBe("MacBook / iMac");
  });

  it("detects Windows PC", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit";
    expect(detectDeviceName(ua)).toBe("Windows PC");
  });

  it("returns Unknown Device for unrecognized UA", () => {
    const ua = "some-custom-bot/1.0";
    expect(detectDeviceName(ua)).toBe("Unknown Device");
  });
});

// ─── Share link token generation ───────────────────────────────────────────
const generateShareToken = (): string =>
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

describe("Share token generation", () => {
  it("generates a non-empty string", () => {
    const token = generateShareToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateShareToken));
    expect(tokens.size).toBe(100);
  });

  it("token only contains alphanumeric characters", () => {
    const token = generateShareToken();
    expect(/^[a-z0-9]+$/.test(token)).toBe(true);
  });
});

// ─── Pairing code format ───────────────────────────────────────────────────
const generatePairingCode = (): string =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

describe("Pairing code generation", () => {
  it("produces a 6-character uppercase code", () => {
    const code = generatePairingCode();
    expect(code).toHaveLength(6);
    expect(code).toBe(code.toUpperCase());
  });

  it("is alphanumeric", () => {
    const code = generatePairingCode();
    expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true);
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 50 }, generatePairingCode));
    expect(codes.size).toBeGreaterThan(40); // very likely all unique
  });
});

// ─── Motion sensitivity threshold ─────────────────────────────────────────
describe("Motion sensitivity threshold calculation", () => {
  const calcThreshold = (sensitivity: number) => (100 - sensitivity) * 2 + 20;

  it("returns 120 for sensitivity=0 (most sensitive)", () => {
    expect(calcThreshold(0)).toBe(220);
  });

  it("returns 70 for default sensitivity=50", () => {
    expect(calcThreshold(50)).toBe(120);
  });

  it("returns 20 for max sensitivity=100", () => {
    expect(calcThreshold(100)).toBe(20);
  });

  it("threshold decreases as sensitivity increases", () => {
    expect(calcThreshold(30)).toBeGreaterThan(calcThreshold(70));
  });
});

// ─── Share link expiry validation ─────────────────────────────────────────
const isShareLinkExpired = (expiresAt: string | null): boolean => {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
};

describe("Share link expiry validation", () => {
  it("returns false when expiresAt is null", () => {
    expect(isShareLinkExpired(null)).toBe(false);
  });

  it("returns true for a past expiry", () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(isShareLinkExpired(past)).toBe(true);
  });

  it("returns false for a future expiry", () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    expect(isShareLinkExpired(future)).toBe(false);
  });
});

// ─── AI Frequency calculation ──────────────────────────────────────────────
describe("AI scan frequency logic", () => {
  const getAiFrequency = (isCoolingMode: boolean, batteryLevel: number, isCharging: boolean): number => {
    if (isCoolingMode) return 60;
    if (batteryLevel < 15 && !isCharging) return 30;
    return 10;
  };

  it("returns 60s interval in cooling mode", () => {
    expect(getAiFrequency(true, 80, false)).toBe(60);
  });

  it("returns 30s interval when battery is low and not charging", () => {
    expect(getAiFrequency(false, 10, false)).toBe(30);
  });

  it("returns 10s interval in normal conditions", () => {
    expect(getAiFrequency(false, 80, false)).toBe(10);
  });

  it("returns 10s when battery is low BUT charging", () => {
    expect(getAiFrequency(false, 5, true)).toBe(10);
  });

  it("cooling mode takes priority over low battery", () => {
    expect(getAiFrequency(true, 5, false)).toBe(60);
  });
});
