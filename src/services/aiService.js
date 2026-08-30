const GEMINI_API_BASE =
    "https://generativelanguage.googleapis.com/v1beta/models";

const CONCISE_SUFFIX = "reply concisely in 1 line";
const LONG_MESSAGE_MIN_LENGTH = 10;

const getGeminiConfig = () => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
    }

    return {
        apiKey,
        model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    };
};

const MAX_CONTEXT_MESSAGES = 20;

const buildPrompt = (message) => {
    const trimmed = String(message).trim();

    if (trimmed.length > LONG_MESSAGE_MIN_LENGTH) {
        return `${trimmed} ${CONCISE_SUFFIX}`;
    }

    return trimmed;
};

const toGeminiRole = (role) => (role === "ai" ? "model" : "user");

const buildContents = (context, message) => {
    const history = Array.isArray(context) ? context.slice(-MAX_CONTEXT_MESSAGES) : [];
    const contents = history.map((entry) => ({
        role: toGeminiRole(entry.role),
        parts: [{ text: String(entry.text).trim() }],
    }));

    contents.push({
        role: "user",
        parts: [{ text: buildPrompt(message) }],
    });

    return contents;
};

const toSingleLineReply = (text) => {
    const quotedMatch = text.match(/["“]([^"”\n]{8,}?)["”]/);

    if (quotedMatch?.[1]) {
        return quotedMatch[1].replace(/\s+/g, " ").trim();
    }

    const lines = text
        .split("\n")
        .map((line) =>
            line
                .replace(/^[\s*\-•\d.)]+/, "")
                .replace(/^\*\*[^*]+\*\*:?\s*/i, "")
                .replace(/^[^:]+:\s*/, "")
                .trim()
        )
        .filter((line) => line.length > 0);

    const contentLine =
        lines.find(
            (line) =>
                !/^here are/i.test(line) &&
                !/depending on/i.test(line) &&
                !/options/i.test(line) &&
                line.length > 8
        ) || lines[lines.length - 1];

    if (!contentLine) {
        return text.replace(/\s+/g, " ").trim();
    }

    const unquoted = contentLine.replace(/^["'“]|["'”]$/g, "").trim();
    const firstSentence =
        unquoted.match(/^[^.!?]+[.!?]/)?.[0]?.trim() || unquoted;

    return firstSentence.replace(/\s+/g, " ").trim();
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

    return toSingleLineReply(text);
};

const generateReply = async (message, context = []) => {
    const { apiKey, model } = getGeminiConfig();
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
    const contents = buildContents(context, message);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents,
            generationConfig: {
                maxOutputTokens: 60,
                temperature: 0.3,
            },
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
