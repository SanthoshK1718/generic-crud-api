const { WebSocketServer } = require("ws");
const chatboxService = require("./chatboxService");

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

const initWebSocketServer = (httpServer, path = "/ws") => {
    wss = new WebSocketServer({ server: httpServer, path });

    wss.on("connection", (ws, req) => {
        const clientId = createClientId();
        const sessionId = getSessionIdFromRequest(req);
        const roomId = getRoomIdFromRequest(req);
        const clientInfo = {
            id: clientId,
            sessionId,
            roomId,
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

            sendToClient(ws, {
                type: "echo",
                received: parsed,
                timestamp: new Date().toISOString(),
            });
        });

        ws.on("close", () => {
            clients.delete(ws);

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

const getConnectedClients = () =>
    Array.from(clients.values()).map(({ id, sessionId, roomId, connectedAt, ip }) => ({
        id,
        sessionId,
        roomId,
        connectedAt,
        ip,
    }));

const getConnectedCount = () => clients.size;

module.exports = {
    initWebSocketServer,
    broadcast,
    publishChatMessage,
    getConnectedClients,
    getConnectedCount,
};
