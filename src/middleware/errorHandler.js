const { sendError } = require("../utils/response");

const errorHandler = (err, req, res, next) => {
    console.error(err);

    if (err instanceof SyntaxError && "body" in err) {
        return sendError(
            res,
            "Invalid JSON in request body. Check commas, quotes, and braces in Postman raw JSON"
        );
    }

    if (err.code === 11000) {
        return sendError(
            res,
            "A document with this unique field already exists"
        );
    }

    return sendError(res, err.message || "Internal server error");
};

module.exports = errorHandler;
