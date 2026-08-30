const GEMINI_API_BASE =
    "https://generativelanguage.googleapis.com/v1beta/models";

const getGeminiConfig = () => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
    }

    return {
        apiKey,
        model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    };
};

const extractReplyText = (payload) => {
    const parts = payload?.candidates?.[0]?.content?.parts;

    if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error("Gemini returned an empty response");
    }

    const text = parts
        .map((part) => part.text)
        .filter(Boolean)
        .join("")
        .trim();

    if (!text) {
        throw new Error("Gemini returned an empty response");
    }

    return text;
};

const generateReply = async (message) => {
    const { apiKey, model } = getGeminiConfig();
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [{ text: message }],
                },
            ],
        }),
    });

    const payload = await response.json();

    if (!response.ok) {
        const apiError =
            payload?.error?.message ||
            `Gemini request failed with status ${response.status}`;

        throw new Error(apiError);
    }

    return extractReplyText(payload);
};

module.exports = {
    generateReply,
};
