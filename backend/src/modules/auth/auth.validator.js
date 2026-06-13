const { z } = require("zod");

class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
  }
}

// Schemas base para reutilização
const emailSchema = z
  .string({
    invalid_type_error: "Email deve ser um texto válido.",
    required_error: "Email é obrigatório.",
  })
  .trim()
  .toLowerCase()
  .min(1, "Email não pode estar vazio.")
  .max(254, "Email muito longo.")
  .email("Informe um email válido.");

const passwordSchema = z
  .string({
    invalid_type_error: "Senha deve ser um texto válido.",
    required_error: "Senha é obrigatória.",
  })
  .trim()
  .min(6, "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.")
  .max(128, "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.")
  .regex(
    /^(?=.*[A-Za-z])(?=.*\d).{6,}$/,
    "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número."
  );

const loginSchema = z.object({
  email: z.string().min(1, "Email e senha não podem estar vazios."),
  password: z.string().min(1, "Email e senha não podem estar vazios."),
});

function validateLoginInput(data) {
  // 1. Verificação de tipos e presença (Contrato Original)
  if (
    !data.email ||
    !data.password ||
    typeof data.email !== "string" ||
    typeof data.password !== "string"
  ) {
    throw new ValidationError(
      "Email e senha são obrigatórios e devem ser textos válidos."
    );
  }

  // 2. Verificação de vazio (Contrato Original)
  const normalizedEmail = data.email.trim().toLowerCase();
  const normalizedPassword = data.password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    throw new ValidationError("Email e senha não podem estar vazios.");
  }

  // 3. Validação de formato de email (Contrato Original)
  const emailResult = emailSchema.safeParse(normalizedEmail);
  if (!emailResult.success) {
    throw new ValidationError("Informe um email válido.");
  }

  return {
    email: normalizedEmail,
    password: normalizedPassword,
  };
}

function validateForgotPasswordInput(data) {
  if (!data.email || typeof data.email !== "string") {
    throw new ValidationError(
      "Email é obrigatório e deve ser um texto válido."
    );
  }

  const normalizedEmail = data.email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new ValidationError("Email não pode estar vazio.");
  }

  const result = emailSchema.safeParse(normalizedEmail);
  if (!result.success) {
    throw new ValidationError("Informe um email válido.");
  }

  return {
    email: normalizedEmail,
  };
}

function validateResetPasswordInput(data) {
  if (
    !data.token ||
    !data.newPassword ||
    typeof data.token !== "string" ||
    typeof data.newPassword !== "string"
  ) {
    throw new ValidationError(
      "Token e nova senha são obrigatórios e devem ser textos válidos."
    );
  }

  const normalizedToken = data.token.trim();
  const normalizedNewPassword = data.newPassword.trim();

  if (!normalizedToken || !normalizedNewPassword) {
    throw new ValidationError("Token e nova senha não podem estar vazios.");
  }

  if (normalizedToken.length < 20) {
    throw new ValidationError("Token de recuperação inválido.");
  }

  const passwordResult = passwordSchema.safeParse(normalizedNewPassword);
  if (!passwordResult.success) {
    throw new ValidationError(
      "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número."
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
