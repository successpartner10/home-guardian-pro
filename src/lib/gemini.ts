// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
/**
 * Multi-provider AI cascade: Gemini → OpenAI → Claude
 * Each provider has its own 24h quota bucket stored in localStorage.
 * When one is exhausted, the next kicks in automatically.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;

interface QuotaBucket {
  count: number;
  windowStart: number;
}

const PROVIDERS = [
  { key: "gemini_1",    limit: 40 },
  { key: "gemini_2",    limit: 40 },
  { key: "gemini_3",    limit: 40 },
  { key: "gemini_4",    limit: 40 },
  { key: "groq",        limit: 50 },
  { key: "groq_alt",    limit: 50 },
  { key: "openrouter",  limit: 50 },
  { key: "openai",      limit: 20 },
  { key: "claude",      limit: 15 },
] as const;

type ProviderKey = typeof PROVIDERS[number]["key"];

// ── Quota helpers ──────────────────────────────────────────────────────────────

const readBucket = (key: ProviderKey): QuotaBucket => {
  try {
    const raw = localStorage.getItem(`hguard_ai_${key}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, windowStart: Date.now() };
};

const writeBucket = (key: ProviderKey, b: QuotaBucket) =>
  localStorage.setItem(`hguard_ai_${key}`, JSON.stringify(b));

const consume = (key: ProviderKey, limit: number): boolean => {
  let b = readBucket(key);
  if (Date.now() - b.windowStart > WINDOW_MS) b = { count: 0, windowStart: Date.now() };
  if (b.count >= limit) return false;
  writeBucket(key, { ...b, count: b.count + 1 });
  return true;
};

const markExhausted = (key: ProviderKey, limit: number) => {
  const b = readBucket(key);
  writeBucket(key, { ...b, count: limit });
};

/** Returns retry string like "~14h" or null if provider is available */
const retryIn = (key: ProviderKey, limit: number): string | null => {
  const b = readBucket(key);
  const elapsed = Date.now() - b.windowStart;
  if (elapsed > WINDOW_MS) return null;
  if (b.count < limit) return null;
  const h = Math.ceil((WINDOW_MS - elapsed) / 3_600_000);
  return h <= 1 ? "<1h" : `~${h}h`;
};

// ── Public quota status (for UI banners) ─────────────────────────────────────

export interface AIQuotaStatus {
  available: ProviderKey | null; // which provider will handle next call
  exhausted: Record<ProviderKey, string | null>; // retry times per provider
  allExhausted: boolean;
  retryIn: string | null; // earliest retry across all providers
}

export const getAIQuotaStatus = (): AIQuotaStatus => {
  const exhausted = {} as Record<ProviderKey, string | null>;
  let available: ProviderKey | null = null;

  for (const { key, limit } of PROVIDERS) {
    const r = retryIn(key, limit);
    exhausted[key] = r;
    if (!r && !available) available = key;
  }

  const times = Object.values(exhausted).filter(Boolean) as string[];
  const allExhausted = available === null;

  // Pick the shortest retry time as the "next available" hint
  const retryHint = allExhausted
    ? times.sort((a, b) => {
        const num = (s: string) => parseInt(s.replace(/\D/g, "")) || 1;
        return num(a) - num(b);
      })[0] ?? null
    : null;

  return { available, exhausted, allExhausted, retryIn: retryHint };
};

// ── Actual API calls ──────────────────────────────────────────────────────────

// ── Prompt templates ──────────────────────────────────────────────────────────

/** Used by background security monitoring (brief alert-style) */
export const SECURITY_PROMPT = "You are a security camera AI. Write one specific, natural sentence describing what is happening in this camera frame as a push notification. Be specific about people, actions, and context. If nothing notable: 'No activity detected.'";

/** Used by Super Zoom Capture — maximum detail on anything visible */
export const DETAIL_PROMPT = "You are an AI vision assistant analyzing a zoomed security camera frame. Output your analysis using exactly this format:\n[IDENTIFIERS]: List any read text, letters, license plates, signs, labels.\n[PEOPLE]: Describe appearance, clothing, actions of any individuals.\n[VEHICLES]: Describe make, model, color of any vehicles.\n[CONTEXT]: Describe background, objects, distances, setting.\nBe specific, concise, and thorough. If a section has nothing, write None. Start immediately.";

const callGeminiByIndex = async (index: number, base64Data: string, prompt: string): Promise<string> => {
  // Check local storage with backward compatibility for index 1
  let localKey = localStorage.getItem(`hguard_gemini_api_key_${index}`);
  if (index === 1 && !localKey) {
    localKey = localStorage.getItem("hguard_gemini_api_key");
  }
  
  const apiKey = (index === 1 && !localKey) ? import.meta.env.VITE_GEMINI_API_KEY : localKey;
  
  if (!apiKey) throw new Error(`No Gemini key configured at slot ${index}.`);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64Data } }
          ]
        }]
      })
    }
  );

  if (res.status === 429) { markExhausted(`gemini_${index}` as any, 40); throw new Error("429"); }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty");
  return text;
};

const callGemini1 = (base64Data: string, prompt: string) => callGeminiByIndex(1, base64Data, prompt);
const callGemini2 = (base64Data: string, prompt: string) => callGeminiByIndex(2, base64Data, prompt);
const callGemini3 = (base64Data: string, prompt: string) => callGeminiByIndex(3, base64Data, prompt);
const callGemini4 = (base64Data: string, prompt: string) => callGeminiByIndex(4, base64Data, prompt);

const callGroq = async (base64Data: string, prompt: string): Promise<string> => {
  const apiKey = localStorage.getItem("hguard_groq_api_key") || import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("No Groq key available. Configure in Settings.");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.2-11b-vision-preview",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
        ]
      }]
    })
  });

  if (res.status === 429) { markExhausted("groq", 50); throw new Error("429"); }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty");
  return text;
};

const callGroqAlt = async (base64Data: string, prompt: string): Promise<string> => {
  const apiKey = localStorage.getItem("hguard_groq_api_key_alt");
  if (!apiKey) throw new Error("No secondary Groq key configured.");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.2-11b-vision-preview",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
        ]
      }]
    })
  });

  if (res.status === 429) { markExhausted("groq_alt", 50); throw new Error("429"); }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty");
  return text;
};

const callOpenRouter = async (base64Data: string, prompt: string): Promise<string> => {
  const apiKey = localStorage.getItem("hguard_openrouter_api_key") || import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("No OpenRouter key available. Configure in Settings.");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://hguard-elite.web.app",
      "X-Title": "HGUARD Security"
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.2-11b-vision-instruct:free",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
        ]
      }]
    })
  });

  if (res.status === 429) { markExhausted("openrouter", 50); throw new Error("429"); }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty");
  return text;
};

const callOpenAI = async (base64Data: string, prompt: string): Promise<string> => {
  const apiKey = localStorage.getItem("hguard_openai_api_key") || import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("No OpenAI key available. Configure in Settings.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}`, detail: "low" } }
        ]
      }]
    })
  });

  if (res.status === 429) { markExhausted("openai", 20); throw new Error("429"); }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty");
  return text;
};

const callClaude = async (base64Data: string, prompt: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) throw new Error("No Claude key");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Data } },
          { type: "text", text: prompt }
        ]
      }]
    })
  });

  if (res.status === 429) { markExhausted("claude", 15); throw new Error("429"); }
  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("empty");
  return text;
};

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Analyzes a camera frame using the next available AI provider.
 * Falls back automatically: Gemini → OpenAI → Claude.
 * @param base64Image - raw base64 or data URL
 * @param prompt - optional custom prompt (defaults to DETAIL_PROMPT for Super Zoom)
 */
export const analyzeFrame = async (base64Image: string, prompt?: string): Promise<{
  text: string;
  provider: ProviderKey | null;
  exhausted: boolean;
  retryIn: string | null;
}> => {
  const base64Data = base64Image.split(",")[1] || base64Image;
  const usePrompt = prompt ?? DETAIL_PROMPT;

  const callers: Array<{ key: ProviderKey; limit: number; fn: (d: string, p: string) => Promise<string> }> = [
    { key: "gemini_1",   limit: 40, fn: callGemini1 },
    { key: "gemini_2",   limit: 40, fn: callGemini2 },
    { key: "gemini_3",   limit: 40, fn: callGemini3 },
    { key: "gemini_4",   limit: 40, fn: callGemini4 },
    { key: "groq",       limit: 50, fn: callGroq },
    { key: "groq_alt",   limit: 50, fn: callGroqAlt },
    { key: "openrouter", limit: 50, fn: callOpenRouter },
    { key: "openai",     limit: 20, fn: callOpenAI },
    { key: "claude",     limit: 15, fn: callClaude },
  ];

  for (const { key, limit, fn } of callers) {
    if (!consume(key, limit)) continue;
    try {
      const text = await fn(base64Data, usePrompt);
      return { text, provider: key, exhausted: false, retryIn: null };
    } catch {
      markExhausted(key, limit);
    }
  }

  const status = getAIQuotaStatus();
  return { text: "", provider: null, exhausted: true, retryIn: status.retryIn };
};

// ── Background security monitoring (uses brief alert prompt) ─────────────────
export const analyzeFrameSecurity = (base64Image: string) =>
  analyzeFrame(base64Image, SECURITY_PROMPT);

// ── Legacy shim (keeps existing callers working) ──────────────────────────────
export const generateImageSummary = async (base64Image: string): Promise<string> => {
  const result = await analyzeFrame(base64Image);
  if (result.exhausted) return `__AI_EXHAUSTED__:${result.retryIn}`;
  return result.text;
};

export const parseAIResult = (result: string) => {
  if (result.startsWith("__AI_EXHAUSTED__:")) {
    return { exhausted: true, retryIn: result.slice("__AI_EXHAUSTED__:".length), text: "" };
  }
  return { exhausted: false, retryIn: null, text: result };
};
