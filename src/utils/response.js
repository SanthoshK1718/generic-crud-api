const SUCCESS_STATUS = 201;
const ERROR_STATUS = 500;

const sendSuccess = (res, data, totalCount) => {
    const result = {};

    if (totalCount !== undefined) {
        result.totalCount = Number(totalCount) || 0;
        result.data = data;
    } else {
        result.data = data;
    }

    return res.status(SUCCESS_STATUS).json({
        success: 1,
        result,
    });
};

const sendError = (res, message) =>
    res.status(ERROR_STATUS).json({
        success: 0,
        message: message || "Internal server error",
    });

module.exports = {
    sendSuccess,
    sendError,
};
