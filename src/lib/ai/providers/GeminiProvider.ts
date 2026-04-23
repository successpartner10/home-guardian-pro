import { AIProvider, AIResponse } from "../aiOrchestrator";

export class GeminiProvider implements AIProvider {
  id = "gemini";
  name = "Gemini 2.5 Flash (Cloud)";

  async identify(base64Image: string, modelOverride?: string, _referenceImage?: string): Promise<AIResponse> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key not configured");

    const base64Data = base64Image.split(',')[1] || base64Image;
    const model = modelOverride || "gemini-2.5-flash";

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Analyze this security camera frame. Return ONLY a JSON object exactly matching this schema:
{
  "label": "brief overall label (e.g., PERSON DETECTED)",
  "tags": ["person", "phone", "object"],
  "risk_level": "low|medium|high",
  "summary": "Act like a descriptive AI situation monitor. Formulate a natural, slightly poetic or highly analytical sentence describing the scene. Be specific.",
  "detected_objects": [
    {
      "label": "PERSON",
      "confidence": 0.98,
      "box_2d": [ymin, xmin, ymax, xmax] // MUST BE NORMALIZED 0 TO 1000
    }
  ]
}
IMPORTANT: ALL detected objects (people, animals, notable items) MUST have a box_2d array with exactly 4 integers between 0 and 1000 representing [ymin, xmin, ymax, xmax].` },
              { inline_data: { mime_type: "image/jpeg", data: base64Data } }
            ]
          }],
          generationConfig: {
            response_mime_type: "application/json"
          }
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[AI] Gemini Rate Limit/Quota Exceeded.");
          return {
            label: "API QUOTA EXCEEDED",
            tags: ["RATE_LIMIT", "NO_FUNDS"],
            risk_level: "high",
            confidence: 1,
            summary: "HGUARD AI offline: Visual processors halted. Free tier API quota has been exceeded (Error 429). Please add billing to your Google Cloud project or wait to retry.",
            detected_objects: []
          };
        }
        const errText = await response.text();
        console.error(`[AI] Gemini API Error ${response.status}:`, errText);
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const cleanedJson = text.replace(/```json\n?|```\n?/g, "").trim();
      const result = JSON.parse(cleanedJson);

      return {
        label: result.label || "Activity detected",
        tags: result.tags || [],
        risk_level: result.risk_level || "low",
        confidence: 0.95,
        summary: result.summary || "",
        detected_objects: result.detected_objects || []
      };
    } catch (e) {
      console.error("[AI] Gemini Provider Error:", e);
      throw e;
    }
  }
}
