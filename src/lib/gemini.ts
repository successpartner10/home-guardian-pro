export const generateImageSummary = async (base64Image: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("Gemini API key not configured.");
        return "";
    }

    // Extract base64 without prefix
    const base64Data = base64Image.split(',')[1] || base64Image;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "You are a security camera AI. Write one specific, natural sentence describing what is happening in this camera frame, as if writing a push notification alert. Be specific about people, actions, and context. Good example: 'A person in a dark jacket is approaching the front door.' Bad example: 'Motion detected.' If nothing notable is happening, say 'No activity detected.'" },
                        { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                    ]
                }]
            })
        });

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (e) {
        console.error("Gemini API Error", e);
        return "";
    }
};
