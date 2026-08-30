const { generateReply } = require("../services/aiService");
const { sendSuccess, sendError } = require("../utils/response");
const { isJsonObject } = require("../utils/requestValidation");
const { containsBlockedContent } = require("../utils/contentFilter");
const {
    getClientIp,
    buildBlockedContentReply,
} = require("../utils/clientIp");

const getMessageFromBody = (body) => {
    const value = body.message ?? body.text ?? body.prompt;

    if (value === undefined || value === null) {
        return {
            error: 'message is required (example: { "message": "Hello, how are you?" })',
        };
    }

    if (typeof value !== "string" || !value.trim()) {
        return {
            error: "message must be a non-empty string",
        };
    }

    return { message: value.trim() };
};

const getContextFromBody = (body) => {
    if (body.context === undefined || body.context === null) {
        return { context: [] };
    }

    if (!Array.isArray(body.context)) {
        return { error: "context must be an array of { role, text } objects" };
    }

    const context = [];

    for (const entry of body.context) {
        if (!entry || typeof entry !== "object") {
            return { error: "each context item must be an object with role and text" };
        }

        const role = entry.role;
        const text = entry.text;

        if (role !== "user" && role !== "ai") {
            return { error: 'context role must be "user" or "ai"' };
        }

        if (typeof text !== "string" || !text.trim()) {
            return { error: "context text must be a non-empty string" };
        }

        context.push({ role, text: text.trim() });
    }

    return { context };
};

const reply = async (req, res, next) => {
    try {
        if (!isJsonObject(req.body)) {
            return sendError(
                res,
                "Request body must be a JSON object with message"
            );
        }

        const parsed = getMessageFromBody(req.body);

        if (parsed.error) {
            return sendError(res, parsed.error);
        }

        const contextParsed = getContextFromBody(req.body);

        if (contextParsed.error) {
            return sendError(res, contextParsed.error);
        }

        if (containsBlockedContent(parsed.message)) {
            const clientIp = getClientIp(req);
            return sendSuccess(res, {
                reply: buildBlockedContentReply(clientIp),
            });
        }

        const replyText = await generateReply(
            parsed.message,
            contextParsed.context
        );

        return sendSuccess(res, { reply: replyText });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    reply,
};
