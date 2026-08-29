const { sendError } = require("../utils/response");

const isJsonObject = (value) =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseJsonBody = (req, res, next) => {
    if (req.method !== "POST") {
        return next();
    }

    if (typeof req.body === "string" && req.body.trim()) {
        try {
            req.body = JSON.parse(req.body);
        } catch (error) {
            return sendError(
                res,
                "Body is not valid JSON. In Postman use Body → raw → JSON"
            );
        }
    }

    if (Buffer.isBuffer(req.body) && req.body.length) {
        try {
            req.body = JSON.parse(req.body.toString("utf8"));
        } catch (error) {
            return sendError(
                res,
                "Body is not valid JSON. In Postman use Body → raw → JSON"
            );
        }
    }

    if (!isJsonObject(req.body)) {
        return sendError(
            res,
            "No JSON body received. Use POST (not browser URL), Body → raw → JSON, and set Content-Type: application/json"
        );
    }

    if (Object.keys(req.body).length === 0) {
        return sendError(
            res,
            "Request body is empty. Add orgId and payload in the JSON body"
        );
    }

    next();
};

module.exports = parseJsonBody;
