const { authMiddleware } = require("../auth/auth.middleware");
const { dailyJourneyLimit } = require("../../shared/middlewares/dailyLimit.middleware");
const { validate } = require("../../shared/middlewares/validate.middleware");
const { planJourneySchema, resolveDestinationSchema, conversationCommandSchema } = require("./journeys.validator");
const express = require("express");
const journeysController = require("./journeys.controller");

const router = express.Router();

router.post("/plan", authMiddleware, dailyJourneyLimit, validate(planJourneySchema), journeysController.planJourney);
router.get("/reverse-geocode", authMiddleware, journeysController.reverseGeocode);
router.post("/transcribe", authMiddleware, journeysController.transcribeAudio);
router.post("/resolve-destination", authMiddleware, validate(resolveDestinationSchema), journeysController.resolveDestination);
router.post("/command", authMiddleware, validate(conversationCommandSchema), journeysController.handleConversationCommand);

module.exports = router;
