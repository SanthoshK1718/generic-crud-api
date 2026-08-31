if (!process.env.VERCEL) {
    require("dotenv").config();
}

const http = require("http");
const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDatabase } = require("./config/database");
const { initWebSocketServer, getConnectedClients, getConnectedCount } = require("./services/websocketService");
const organizationRoutes = require("./routes/organizationRoutes");
const loginRoutes = require("./routes/loginRoutes");
const aiRoutes = require("./routes/aiRoutes");
const crudRoutes = require("./routes/crudRoutes");
const websocketRoutes = require("./routes/websocketRoutes");
const errorHandler = require("./middleware/errorHandler");
const parseJsonBody = require("./middleware/parseJsonBody");
const { sendSuccess, sendError } = require("./utils/response");
const { getLocalNetworkAddresses } = require("./utils/network");
const { getPublicBaseUrl } = require("./utils/publicUrl");
const chatboxService = require("./services/chatboxService");

const sessionChatPage = path.join(__dirname, "../public/ws-session-chat.html");

const app = express();
app.use(cors());

// Parse JSON body for all POST requests
app.use(express.json({ type: "*/*" }));
app.use(express.urlencoded({ extended: true }));
app.use(parseJsonBody);

app.get("/", (req, res) => {
    sendSuccess(res, { message: "Generic CRUD API is running" });
});

app.get("/health", (req, res) => {
    sendSuccess(res, {
        message: "API is healthy",
        mongoConfigured: Boolean(process.env.MONGODB_URI),
        databaseConfigured: Boolean(process.env.MONGODB_DATABASE),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
});

app.get("/ai/chat", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/chat.html"));
});

app.get("/ai/chatwithhistory", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/chatwithhistory.html"));
});

app.get("/chat", (req, res) => {
    res.redirect(301, "/ai/chat");
});

app.get("/session-chat", (req, res) => {
    res.sendFile(sessionChatPage);
});

app.get("/ws/chat", (req, res) => {
    res.sendFile(sessionChatPage);
});

app.get("/ws/chat/config", (req, res) => {
    const baseUrl = getPublicBaseUrl(req);

    sendSuccess(res, {
        mode: process.env.VERCEL ? "http" : "websocket",
        baseUrl,
        chatUrl: `${baseUrl}/session-chat`,
        messagesUrl: `${baseUrl}/ws/chat/messages`,
        sendUrl: `${baseUrl}/ws/chat`,
    });
});

app.get("/ws/chat/messages", async (req, res, next) => {
    try {
        const roomId = req.query.roomId || "global";
        const limit = req.query.limit || 100;
        const afterId = req.query.afterId;
        const messages = await chatboxService.getMessages({ roomId, limit, afterId });

        sendSuccess(res, messages, messages.length);
    } catch (error) {
        next(error);
    }
});

app.get("/ws/chat/members", async (req, res, next) => {
    try {
        const roomId = req.query.roomId || "global";
        const members = await chatboxService.getMembers({ roomId });

        sendSuccess(res, members, members.length);
    } catch (error) {
        next(error);
    }
});

app.get("/ws/status", (req, res) => {
    sendSuccess(res, {
        connectedCount: getConnectedCount(),
        clients: getConnectedClients(),
        websocketPath: "/ws",
    });
});

app.use("/", websocketRoutes);
app.use("/", aiRoutes);

app.use(async (req, res, next) => {
    try {
        await connectDatabase();
        next();
    } catch (error) {
        next(error);
    }
});

app.use("/organization", organizationRoutes);
app.use("/", loginRoutes);
app.use("/", crudRoutes);

app.use((req, res) => {
    if (req.method !== "POST") {
        return sendError(
            res,
            `Method ${req.method} is not supported. Use POST (e.g. POST /users/create)`
        );
    }

    sendError(
        res,
        `Route not found: ${req.method} ${req.originalUrl}. Use /session-chat, /ai/chat, /ai/chatwithhistory, /ws/chat, /ws/status, /ws/broadcast, /login, or /{collection}/create|getall|update|delete`
    );
});

app.use(errorHandler);
const startServer = async () => {
    try {
        const port = process.env.PORT || 3000;
        const host = process.env.HOST || "0.0.0.0";
        const server = http.createServer(app);

        initWebSocketServer(server, "/ws");

        server.listen(port, host, () => {
            const chatPath = "/session-chat";
            console.log(`Server running on http://localhost:${port}`);
            console.log(`Chat: http://localhost:${port}${chatPath}?roomId=global`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

module.exports = app;