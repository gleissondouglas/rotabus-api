const { Router } = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const { scheduleReminder } = require("./reminders.controller");

const router = Router();

router.post("/", authMiddleware, scheduleReminder);

module.exports = router;
