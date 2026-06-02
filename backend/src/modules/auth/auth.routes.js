const express = require("express");

const { login, forgotPassword, resetPassword } = require("./auth.controller");
const { loginLimiter } = require("../../shared/middlewares/rateLimiter.middleware");

const router = express.Router();

router.post("/login", loginLimiter, login);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);

module.exports = router;
