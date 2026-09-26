const { Router } = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const { scheduleReminder, cancelReminder } = require("./reminders.controller");

const router = Router();

router.post("/", authMiddleware, scheduleReminder);
router.delete("/:jobId", authMiddleware, cancelReminder);

module.exports = router;
