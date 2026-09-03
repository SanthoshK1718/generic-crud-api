const express = require("express");
const path = require("path");
const seatService = require("../services/seatService");
const { sendSuccess, sendError } = require("../utils/response");

const router = express.Router();
const bookingPagePath = path.join(__dirname, "../../public/seat-booking.html");

router.get("/seat-booking", (req, res) => {
    res.sendFile(bookingPagePath);
});

router.get("/seats/layout", async (req, res, next) => {
    try {
        const hallId = req.query.hallId || "main";
        const layout = await seatService.getHallLayout(hallId);

        sendSuccess(res, layout);
    } catch (error) {
        next(error);
    }
});

router.post("/seats/init", async (req, res, next) => {
    try {
        const { hallId = "main", rows, cols, reset = false } = req.body || {};

        if (!rows || !cols) {
            return sendError(res, "Provide 'rows' (y) and 'cols' (x) in the request body");
        }

        const layout = await seatService.initializeHall({
            hallId,
            rows,
            cols,
            reset: Boolean(reset),
        });

        sendSuccess(res, layout);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
