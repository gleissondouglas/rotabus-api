const {
  loginService,
  forgotPasswordService,
  resetPasswordService,
} = require("./auth.service");

const {
  validateLoginInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
} = require("./auth.validator");

async function login(req, res, next) {
  try {
    const validatedData = validateLoginInput(req.body);

    const result = await loginService(validatedData);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const validatedData = validateForgotPasswordInput(req.body);

    const result = await forgotPasswordService(validatedData);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const validatedData = validateResetPasswordInput(req.body);

    const result = await resetPasswordService(validatedData);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  forgotPassword,
  resetPassword,
};
