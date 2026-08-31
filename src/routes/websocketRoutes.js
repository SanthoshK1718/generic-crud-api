const express = require("express");
const {
    broadcast,
    publishChatMessage,
    getConnectedCount,
} = require("../services/websocketService");
const { sendSuccess, sendError } = require("../utils/response");

const router = express.Router();

router.post("/ws/chat", async (req, res, next) => {
    try {
        const { sessionId, message, roomId = "global" } = req.body || {};

        if (!sessionId) {
            return sendError(res, "Provide 'sessionId' in the request body");
        }

        if (!message) {
            return sendError(res, "Provide 'message' in the request body");
        }

        let payload = await publishChatMessage({ sessionId, message, roomId });

        sendSuccess(res, {
            sent: true,
            connectedClients: getConnectedCount(),
            payload,
        });
    } catch (error) {
        next(error);
    }
});

router.post("/ws/broadcast", (req, res) => {
    const { type = "notification", message, data } = req.body || {};

    if (!message && !data) {
        return sendError(res, "Provide 'message' or 'data' in the request body");
    }

    const payload = {
        type,
        message,
        data,
        timestamp: new Date().toISOString(),
    };

    broadcast(payload);

    sendSuccess(res, {
        sent: true,
        connectedClients: getConnectedCount(),
        payload,
    });
});

module.exports = router;
