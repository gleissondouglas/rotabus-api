const { Router } = require("express");
const { authMiddleware } = require("../auth/auth.middleware");
const { validate } = require("../../shared/middlewares/validate.middleware");
const { scheduleReminderSchema } = require("./reminders.validator");
const { scheduleReminder, cancelReminder } = require("./reminders.controller");

const router = Router();

router.post("/", authMiddleware, validate(scheduleReminderSchema), scheduleReminder);
router.delete("/:jobId", authMiddleware, cancelReminder);

module.exports = router;
