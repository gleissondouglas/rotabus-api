const express = require("express");

const { login, forgotPassword, resetPassword } = require("./auth.controller");
const { loginLimiter } = require("../../shared/middlewares/rateLimiter.middleware");
const { validate } = require("../../shared/middlewares/validate.middleware");
const { loginSchema, forgotPasswordSchema, resetPasswordSchema } = require("./auth.validator");

const router = express.Router();

router.post("/login", loginLimiter, validate(loginSchema), login);

router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

module.exports = router;
