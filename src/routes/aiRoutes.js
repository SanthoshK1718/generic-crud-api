const express = require("express");
const { chat, chatWithHistory } = require("../controllers/aiController");

const router = express.Router();

router.post("/ai/chat", chat);
router.post("/ai/chatwithhistory", chatWithHistory);

module.exports = router;
