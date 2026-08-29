require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectDatabase } = require("./config/database");
const organizationRoutes = require("./routes/organizationRoutes");
const crudRoutes = require("./routes/crudRoutes");
const errorHandler = require("./middleware/errorHandler");
const parseJsonBody = require("./middleware/parseJsonBody");
const { sendSuccess, sendError } = require("./utils/response");

const app = express();
app.use(cors());

// Parse JSON body for all POST requests
app.use(express.json({ type: "*/*" }));
app.use(express.urlencoded({ extended: true }));
app.use(parseJsonBody);

app.use(async (req, res, next) => {
    try {
        await connectDatabase();
        next();
    } catch (error) {
        next(error);
    }
});

app.get("/", (req, res) => {
    sendSuccess(res, { message: "Generic CRUD API is running" });
});

app.get("/health", (req, res) => {
    sendSuccess(res, { message: "API is healthy" });
});

app.use("/organization", organizationRoutes);
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
        `Route not found: ${req.method} ${req.originalUrl}. Use /{collection}/create|getall|update|delete`
    );
});

app.use(errorHandler);
const startServer = async () => {
    try {
        const port = process.env.PORT || 3000;

        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
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