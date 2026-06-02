const { authMiddleware } = require("../auth/auth.middleware");
const { dailyJourneyLimit } = require("../../shared/middlewares/dailyLimit.middleware");
const express = require("express");
const journeysController = require("./journeys.controller");

const router = express.Router();

router.post("/plan", authMiddleware, dailyJourneyLimit, journeysController.planJourney);
router.get("/reverse-geocode", authMiddleware, journeysController.reverseGeocode);
router.post("/transcribe", authMiddleware, journeysController.transcribeAudio);
router.post("/resolve-destination", authMiddleware, journeysController.resolveDestination);

module.exports = router;
