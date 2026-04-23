import { AIProvider, AIResponse } from "../aiOrchestrator";

export class GemmaProvider implements AIProvider {
  id = "gemma";
  name = "Gemini 2.5 Flash (Pro Vision)";
  async identify(base64Image: string, modelOverride?: string, referenceImage?: string): Promise<AIResponse> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API key not configured");

    const base64Data = base64Image.split(',')[1] || base64Image;
    const model = modelOverride || "gemini-2.5-flash";

    const makeRequest = async (targetModel: string) => {
      // Build the parts array — optionally include reference image
      const parts: any[] = [];

      if (referenceImage) {
        const refData = referenceImage.split(',')[1] || referenceImage;
        parts.push({
          text: "REFERENCE IMAGE (Person/Object to identify and track):"
        });
        parts.push({
          inline_data: { mime_type: "image/jpeg", data: refData }
        });
        parts.push({
          text: "LIVE SECURITY FEED (Compare against reference above):"
        });
        parts.push({
          inline_data: { mime_type: "image/jpeg", data: base64Data }
        });
        parts.push({
          text: `ACT AS HGUARD ELITE AI. Perform a spatial security audit WITH reference matching.
1. Detect every Person, Pet, and notable Household object in the LIVE FEED.
2. The REFERENCE IMAGE shows a target of interest. If you detect a matching person or object in the LIVE FEED, flag it as "KNOWN_TARGET" in the label (e.g., "KNOWN_TARGET: Owner") and set matched_reference: true in the JSON.
3. If the detection does NOT match the reference exactly, categorize it generically (e.g., "UNKNOWN_PERSON").
4. For each detected object, return 'box_2d': [ymin, xmin, ymax, xmax] (normalized 0-1000).
5. Provide a 'summary' that is a dramatic, real-time security report (Hark! An anomaly...).
6. REQUIRED JSON: {"label":"str","tags":[],"risk_level":"low|medium|high","summary":"str","detected_objects":[{"label":"str","confidence":0.9,"box_2d":[y,x,y,x],"matched_reference":true}]}`
        });
      } else {
        parts.push({
          text: `ACT AS HGUARD ELITE AI. Perform a spatial security audit.
1. Detect every Person, Pet, and notable Household object.
2. For each, return 'box_2d': [ymin, xmin, ymax, xmax] (normalized 0-1000).
3. Provide a 'summary' that is a dramatic, narrative security report (e.g., "Hark! The perimeter is silent...").
4. If no objects are found, still provide a summary confirming the scene is secure.
5. REQUIRED JSON: {"label":"str","tags":[],"risk_level":"low|medium|high","summary":"str","detected_objects":[{"label":"PERSON","confidence":0.9,"box_2d":[y,x,y,x]}]}`
        });
        parts.push({
          inline_data: { mime_type: "image/jpeg", data: base64Data }
        });
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            response_mime_type: "application/json"
          }
        })
      });
      return response;
    };

    try {
      let response = await makeRequest(model);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`[AI] ${model} Quota Exceeded. Attempting fallback...`);
          if (model.startsWith("gemini-2.5")) {
            console.log("[AI] Falling back to gemini-2.5-flash-lite");
            response = await makeRequest("gemini-2.5-flash-lite");

            if (!response.ok && response.status === 429) {
              return {
                label: "FATAL QUOTA LOCKOUT",
                tags: ["RATE_LIMIT"],
                risk_level: "high",
                confidence: 1,
                summary: "HGUARD AI offline: Both primary and fallback AI models have exhausted their free tier quotas.",
                detected_objects: []
              };
            }
          } else {
            return {
              label: "API QUOTA EXCEEDED",
              tags: ["RATE_LIMIT"],
              risk_level: "high",
              confidence: 1,
              summary: "HGUARD AI offline: Free tier API quota has been exceeded (Error 429).",
              detected_objects: []
            };
          }
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[AI] API Error ${response.status}:`, errText);
          throw new Error(`API returned ${response.status}`);
        }
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      console.log("[AI] Raw Analysis:", text);

      // Clean markdown fences if present, then parse JSON
      const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
      let cleanedJson = "{}";
      const startIdx = cleaned.indexOf('{');
      const endIdx = cleaned.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        cleanedJson = cleaned.substring(startIdx, endIdx + 1);
      }

      const result = JSON.parse(cleanedJson);

      return {
        label: result.label || "Scene detected",
        tags: result.tags || [],
        risk_level: result.risk_level || "low",
        confidence: 0.98,
        summary: result.summary || "",
        detected_objects: result.detected_objects || []
      };
    } catch (e) {
      console.error("[AI] Gemma Provider Error:", e);
      throw e;
    }
  }
}
