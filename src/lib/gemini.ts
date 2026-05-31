const QUOTA_KEY = "hguard_ai_quota";
const QUOTA_LIMIT = 40; // calls per 24h window

interface QuotaState {
  count: number;
  windowStart: number; // epoch ms
}

const getQuota = (): QuotaState => {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, windowStart: Date.now() };
};

const saveQuota = (q: QuotaState) => {
  localStorage.setItem(QUOTA_KEY, JSON.stringify(q));
};

/** Returns null if within quota, or a human-readable string like "in ~18h" if exhausted */
export const getAIQuotaStatus = (): null | string => {
  const q = getQuota();
  const elapsed = Date.now() - q.windowStart;
  const windowMs = 24 * 60 * 60 * 1000;

  if (elapsed > windowMs) return null; // window reset — OK
  if (q.count < QUOTA_LIMIT) return null; // still within limit

  const remainingMs = windowMs - elapsed;
  const remainingH = Math.ceil(remainingMs / (60 * 60 * 1000));
  return remainingH <= 1 ? "in <1h" : `in ~${remainingH}h`;
};

const consumeQuota = (): boolean => {
  let q = getQuota();
  const elapsed = Date.now() - q.windowStart;
  const windowMs = 24 * 60 * 60 * 1000;

  // Reset window if expired
  if (elapsed > windowMs) {
    q = { count: 0, windowStart: Date.now() };
  }

  if (q.count >= QUOTA_LIMIT) return false;

  q.count += 1;
  saveQuota(q);
  return true;
};

export const generateImageSummary = async (base64Image: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API key not configured.");
    return "";
  }

  const exhausted = getAIQuotaStatus();
  if (exhausted) {
    return `__AI_EXHAUSTED__:${exhausted}`;
  }

  if (!consumeQuota()) {
    const status = getAIQuotaStatus();
    return `__AI_EXHAUSTED__:${status}`;
  }

  const base64Data = base64Image.split(",")[1] || base64Image;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "You are a security camera AI. Write one specific, natural sentence describing what is happening in this camera frame, as if writing a push notification alert. Be specific about people, actions, and context. Good example: 'A person in a dark jacket is approaching the front door.' Bad example: 'Motion detected.' If nothing notable is happening, say 'No activity detected.'"
              },
              { inline_data: { mime_type: "image/jpeg", data: base64Data } }
            ]
          }]
        })
      }
    );

    // Detect quota exhaustion from the API itself
    if (response.status === 429) {
      // Mark local quota as exhausted
      const q = getQuota();
      q.count = QUOTA_LIMIT;
      saveQuota(q);
      const status = getAIQuotaStatus();
      return `__AI_EXHAUSTED__:${status}`;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (e) {
    console.error("Gemini API Error", e);
    return "";
  }
};

/** Parses a generateImageSummary result — returns { exhausted, retryIn, text } */
export const parseAIResult = (result: string) => {
  if (result.startsWith("__AI_EXHAUSTED__:")) {
    return { exhausted: true, retryIn: result.slice("__AI_EXHAUSTED__:".length), text: "" };
  }
  return { exhausted: false, retryIn: null, text: result };
};
