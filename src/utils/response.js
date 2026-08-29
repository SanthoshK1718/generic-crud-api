const SUCCESS_STATUS = 201;
const ERROR_STATUS = 500;
const GENERIC_ERROR_MESSAGE = "Something went wrong";

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

const sendError = (res, errorDetail) =>
    res.status(ERROR_STATUS).json({
        success: 0,
        message: GENERIC_ERROR_MESSAGE,
        error: errorDetail || GENERIC_ERROR_MESSAGE,
    });

module.exports = {
    sendSuccess,
    sendError,
    GENERIC_ERROR_MESSAGE,
};
