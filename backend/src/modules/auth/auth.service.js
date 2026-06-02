const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

const {
  validateLoginInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
} = require("./auth.validator");

const {
  findUserByEmail,
  updateUserPasswordHash,
} = require("../users/users.repository");

const {
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  markPasswordResetTokenAsUsed,
  invalidateUserPasswordResetTokens,
} = require("./auth.repository");

const { sendPasswordResetEmail } = require("./providers/email.provider");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function loginService(loginData) {
  const validatedData = validateLoginInput(loginData);

  const user = await findUserByEmail(validatedData.email);

  if (!user) {
    const error = new Error("Email ou senha inválidos.");
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(
    validatedData.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    const error = new Error("Email ou senha inválidos.");
    error.statusCode = 401;
    throw error;
  }

  if (!env.jwtSecret) {
    const error = new Error("JWT_SECRET não configurado.");
    error.statusCode = 500;
    throw error;
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: "7d",
    },
  );

  return {
    message: "Login realizado com sucesso.",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

async function forgotPasswordService(data) {
  const { email } = validateForgotPasswordInput(data);

  const genericResponse = {
    message:
      "Se esse email estiver cadastrado, enviaremos instruções para recuperar a senha.",
  };

  const user = await findUserByEmail(email);

  if (!user) {
    return genericResponse;
  }

  await invalidateUserPasswordResetTokens(user.id);

  const resetToken = generateResetToken();
  const tokenHash = hashToken(resetToken);
  const expiresAt = addMinutes(new Date(), 30);

  await createPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const resetLink = `${env.appUrl}/reset-password?token=${resetToken}`;

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetLink,
  });

  if (env.nodeEnv === "production") {
    return genericResponse;
  }

  return {
    ...genericResponse,

    // Apenas para teste local/desenvolvimento.
    // Em produção, o token deve ser enviado somente por email.
    resetToken,
    resetLink,
  };
}

async function resetPasswordService(data) {
  const { token, newPassword } = validateResetPasswordInput(data);

  const tokenHash = hashToken(token);

  const passwordResetToken = await findPasswordResetTokenByHash(tokenHash);

  if (!passwordResetToken) {
    const error = new Error("Token de recuperação inválido ou expirado.");
    error.statusCode = 400;
    throw error;
  }

  if (passwordResetToken.usedAt) {
    const error = new Error("Token de recuperação já foi utilizado.");
    error.statusCode = 400;
    throw error;
  }

  if (passwordResetToken.expiresAt < new Date()) {
    const error = new Error("Token de recuperação expirado.");
    error.statusCode = 400;
    throw error;
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await updateUserPasswordHash({
    id: passwordResetToken.userId,
    passwordHash: newPasswordHash,
  });

  await markPasswordResetTokenAsUsed(passwordResetToken.id);

  return {
    message: "Senha redefinida com sucesso.",
  };
}

module.exports = {
  loginService,
  forgotPasswordService,
  resetPasswordService,
};
