class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
  }
}

function validateEmail(email) {
  if (!email || typeof email !== "string") return false;

  if (email.length > 254) return false;

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  return emailRegex.test(email);
}

function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return false;
  }

  if (password.length < 6) {
    return false;
  }

  if (password.length > 128) {
    return false;
  }

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  return passwordRegex.test(password);
}

function validateLoginInput({ email, password }) {
  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    throw new ValidationError(
      "Email e senha são obrigatórios e devem ser textos válidos.",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    throw new ValidationError("Email e senha não podem estar vazios.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw new ValidationError("Informe um email válido.");
  }

  return {
    email: normalizedEmail,
    password: normalizedPassword,
  };
}

function validateForgotPasswordInput({ email }) {
  if (!email || typeof email !== "string") {
    throw new ValidationError(
      "Email é obrigatório e deve ser um texto válido.",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new ValidationError("Email não pode estar vazio.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw new ValidationError("Informe um email válido.");
  }

  return {
    email: normalizedEmail,
  };
}

function validateResetPasswordInput({ token, newPassword }) {
  if (
    !token ||
    !newPassword ||
    typeof token !== "string" ||
    typeof newPassword !== "string"
  ) {
    throw new ValidationError(
      "Token e nova senha são obrigatórios e devem ser textos válidos.",
    );
  }

  const normalizedToken = token.trim();
  const normalizedNewPassword = newPassword.trim();

  if (!normalizedToken || !normalizedNewPassword) {
    throw new ValidationError("Token e nova senha não podem estar vazios.");
  }

  if (normalizedToken.length < 20) {
    throw new ValidationError("Token de recuperação inválido.");
  }

  if (!validatePassword(normalizedNewPassword)) {
    throw new ValidationError(
      "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.",
    );
  }

  return {
    token: normalizedToken,
    newPassword: normalizedNewPassword,
  };
}

module.exports = {
  ValidationError,
  validateLoginInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
};
