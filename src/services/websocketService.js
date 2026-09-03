const { WebSocketServer } = require("ws");
const chatboxService = require("./chatboxService");
const seatService = require("./seatService");

let wss = null;
const clients = new Map();
let clientCounter = 0;

const createClientId = () => {
    clientCounter += 1;
    return `client-${clientCounter}`;
};

const getSessionIdFromRequest = (req) => {
    try {
        const url = new URL(req.url, "http://localhost");
        return url.searchParams.get("sessionId") || null;
    } catch {
        return null;
    }
};

const getRoomIdFromRequest = (req) => {
    try {
        const url = new URL(req.url, "http://localhost");
        return url.searchParams.get("roomId") || "global";
    } catch {
        return "global";
    }
};

const getHallIdFromRequest = (req) => {
    try {
        const url = new URL(req.url, "http://localhost");
        return url.searchParams.get("hallId") || "main";
    } catch {
        return "main";
    }
};

const getUserIdFromRequest = (req) => {
    try {
        const url = new URL(req.url, "http://localhost");
        return url.searchParams.get("userId") || url.searchParams.get("sessionId") || null;
    } catch {
        return null;
    }
};

const sendToClient = (ws, payload) => {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
    }
};

const publishChatMessage = async ({
    sessionId,
    message,
    roomId = "global",
    timestamp,
}) => {
    if (!sessionId || !message) {
        return null;
    }

    const saved = await chatboxService.saveMessage({ sessionId, message, roomId });
    const payload = {
        type: "chat",
        sessionId: saved.sessionId,
        message: saved.message,
        roomId: saved.roomId,
        id: saved.id,
        timestamp: timestamp || saved.timestamp,
    };

    broadcast(payload);
    return payload;
};

const publishSeatUpdate = async ({ action, hallId, x, y, userId }) => {
    let result;

    if (action === "block") {
        result = await seatService.blockSeat({ hallId, x, y, userId });
    } else if (action === "unblock") {
        result = await seatService.unblockSeat({ hallId, x, y, userId });
    } else {
        return { error: "Invalid seat action" };
    }

    if (result.error) {
        return result;
    }

    const payload = {
        type: "seat_updated",
        hallId,
        seat: result,
    };

    broadcastToHall(hallId, payload);
    return payload;
};

const initWebSocketServer = (httpServer, path = "/ws") => {
    wss = new WebSocketServer({ server: httpServer, path });

    wss.on("connection", (ws, req) => {
        const clientId = createClientId();
        const sessionId = getSessionIdFromRequest(req);
        const roomId = getRoomIdFromRequest(req);
        const hallId = getHallIdFromRequest(req);
        const userId = getUserIdFromRequest(req);
        const clientInfo = {
            id: clientId,
            sessionId,
            roomId,
            hallId,
            userId,
            connectedAt: new Date().toISOString(),
            ip: req.socket.remoteAddress,
        };

        clients.set(ws, clientInfo);

        sendToClient(ws, {
            type: "connected",
            clientId,
            sessionId,
            roomId,
            message: "WebSocket connected successfully",
            timestamp: clientInfo.connectedAt,
        });

        broadcast(
            {
                type: "client_joined",
                clientId,
                sessionId,
                connectedClients: clients.size,
                timestamp: new Date().toISOString(),
            },
            ws
        );

        ws.on("message", async (data) => {
            let parsed;

            try {
                parsed = JSON.parse(data.toString());
            } catch {
                parsed = { type: "message", content: data.toString() };
            }

            if (parsed.type === "chat" && parsed.message) {
                try {
                    await publishChatMessage({
                        sessionId: parsed.sessionId || sessionId,
                        message: parsed.message,
                        roomId: parsed.roomId || roomId,
                    });
                } catch (error) {
                    sendToClient(ws, {
                        type: "error",
                        message: "Failed to save message",
                        detail: error.message,
                    });
                }
                return;
            }

            if (parsed.type === "seat_block" || parsed.type === "seat_unblock") {
                const activeHallId = parsed.hallId || hallId;
                const activeUserId = parsed.userId || userId;

                if (!activeUserId) {
                    sendToClient(ws, {
                        type: "seat_error",
                        message: "userId is required",
                    });
                    return;
                }

                try {
                    const result = await publishSeatUpdate({
                        action: parsed.type === "seat_block" ? "block" : "unblock",
                        hallId: activeHallId,
                        x: parsed.x,
                        y: parsed.y,
                        userId: activeUserId,
                    });

                    if (result.error) {
                        sendToClient(ws, {
                            type: "seat_error",
                            message: result.error,
                            x: parsed.x,
                            y: parsed.y,
                        });
                    }
                } catch (error) {
                    sendToClient(ws, {
                        type: "seat_error",
                        message: "Failed to update seat",
                        detail: error.message,
                    });
                }
                return;
            }

            sendToClient(ws, {
                type: "echo",
                received: parsed,
                timestamp: new Date().toISOString(),
            });
        });

        ws.on("close", async () => {
            const { hallId: clientHallId, userId: clientUserId } = clientInfo;
            clients.delete(ws);

            if (clientHallId && clientUserId) {
                try {
                    const released = await seatService.releaseSeatsByUser(
                        clientHallId,
                        clientUserId
                    );

                    released.forEach((seat) => {
                        broadcastToHall(clientHallId, {
                            type: "seat_updated",
                            hallId: clientHallId,
                            seat,
                        });
                    });
                } catch {
                    // Ignore release errors on disconnect.
                }
            }

            broadcast({
                type: "client_left",
                clientId,
                connectedClients: clients.size,
                timestamp: new Date().toISOString(),
            });
        });

        ws.on("error", () => {
            clients.delete(ws);
        });
    });

    return wss;
};

const broadcast = (payload, excludeWs = null) => {
    const message = JSON.stringify(payload);

    for (const [ws] of clients) {
        if (ws !== excludeWs && ws.readyState === ws.OPEN) {
            ws.send(message);
        }
    }
};

const broadcastToHall = (hallId, payload, excludeWs = null) => {
    const message = JSON.stringify(payload);

    for (const [ws, info] of clients) {
        if (ws !== excludeWs && info.hallId === hallId && ws.readyState === ws.OPEN) {
            ws.send(message);
        }
    }
};

const getConnectedClients = () =>
    Array.from(clients.values()).map(
        ({ id, sessionId, roomId, hallId, userId, connectedAt, ip }) => ({
            id,
            sessionId,
            roomId,
            hallId,
            userId,
            connectedAt,
            ip,
        })
    );

const getConnectedCount = () => clients.size;

module.exports = {
    initWebSocketServer,
    broadcast,
    broadcastToHall,
    publishChatMessage,
    publishSeatUpdate,
    getConnectedClients,
    getConnectedCount,
};
