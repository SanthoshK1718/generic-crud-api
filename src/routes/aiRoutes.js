const express = require("express");
const { reply } = require("../controllers/aiController");

const router = express.Router();

router.post("/ai/reply", reply);

module.exports = router;
