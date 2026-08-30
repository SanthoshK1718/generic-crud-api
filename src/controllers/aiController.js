const { generateReply } = require("../services/aiService");
const { sendSuccess, sendError } = require("../utils/response");
const { isJsonObject } = require("../utils/requestValidation");
const {
    BLOCKED_CONTENT_ERROR,
    containsBlockedContent,
} = require("../utils/contentFilter");

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

        if (containsBlockedContent(parsed.message)) {
            return sendError(res, BLOCKED_CONTENT_ERROR);
        }

        const replyText = await generateReply(parsed.message);

        return sendSuccess(res, { reply: replyText });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    reply,
};
