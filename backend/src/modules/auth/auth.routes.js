const express = require("express");

const { login, forgotPassword, resetPassword } = require("./auth.controller");
const { loginLimiter, passwordRecoveryLimiter } = require("../../shared/middlewares/rateLimiter.middleware");
const { validate } = require("../../shared/middlewares/validate.middleware");
const { loginSchema, forgotPasswordSchema, resetPasswordSchema } = require("./auth.validator");

const router = express.Router();

router.post("/login", loginLimiter, validate(loginSchema), login);

router.post("/forgot-password", passwordRecoveryLimiter, validate(forgotPasswordSchema), forgotPassword);

router.post("/reset-password", passwordRecoveryLimiter, validate(resetPasswordSchema), resetPassword);

module.exports = router;
