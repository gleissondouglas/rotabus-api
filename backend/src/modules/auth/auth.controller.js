const {
  loginService,
  forgotPasswordService,
  resetPasswordService,
} = require("./auth.service");

async function login(req, res, next) {
  try {
    const result = await loginService(req.body);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await forgotPasswordService(req.body);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const result = await resetPasswordService(req.body);

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
