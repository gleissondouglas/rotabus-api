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
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Informe um email válido.");

const nameSchema = z
  .string({
    required_error: "O nome é obrigatório e deve ser um texto válido.",
    invalid_type_error: "O nome é obrigatório e deve ser um texto válido.",
  })
  .trim()
  .min(1, "O nome não pode estar vazio.")
  .min(3, "O nome deve ter pelo menos 3 caracteres.")
  .max(100, "O nome deve ter no máximo 100 caracteres.")
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "O nome contém caracteres inválidos.");

const passwordSchema = z
  .string()
  .trim()
  .min(6, "A senha deve ter pelo menos 6 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .regex(/^(?=.*[A-Za-z])(?=.*\d).{6,}$/, "A senha deve conter pelo menos uma letra e um número.");

const changePasswordSchema = z
  .string()
  .trim()
  .min(6, "A nova senha deve ter pelo menos 6 caracteres.")
  .max(128, "A nova senha deve ter no máximo 128 caracteres.")
  .regex(/^(?=.*[A-Za-z])(?=.*\d).{6,}$/, "A nova senha deve conter pelo menos uma letra e um número.");

function validateName(name) {
  const result = nameSchema.safeParse(name);
  if (!result.success) {
    // Mantendo a compatibilidade de lançar o primeiro erro encontrado
    const firstError = result.error.issues[0].message;
    throw new ValidationError(firstError);
  }
  return result.data;
}

function validateCreateUserInput(data) {
  // 1. Verificação de tipos e presença (Contrato Original)
  if (
    !data.name ||
    !data.email ||
    !data.password ||
    typeof data.name !== "string" ||
    typeof data.email !== "string" ||
    typeof data.password !== "string"
  ) {
    throw new ValidationError(
      "Nome, email e senha são obrigatórios e devem ser textos válidos.",
    );
  }

  // 2. Normalização e Validação Individual
  const normalizedName = validateName(data.name);
  const normalizedEmail = data.email.trim().toLowerCase();
  const normalizedPassword = data.password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    throw new ValidationError("Email e senha não podem estar vazios.");
  }

  const emailResult = emailSchema.safeParse(normalizedEmail);
  if (!emailResult.success) {
    throw new ValidationError("Informe um email válido.");
  }

  const passwordResult = passwordSchema.safeParse(normalizedPassword);
  if (!passwordResult.success) {
    throw new ValidationError(passwordResult.error.issues[0].message);
  }

  return {
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword,
  };
}

function validateChangePasswordInput(data) {
  if (
    !data.currentPassword ||
    !data.newPassword ||
    typeof data.currentPassword !== "string" ||
    typeof data.newPassword !== "string"
  ) {
    throw new ValidationError(
      "Senha atual e nova senha são obrigatórias e devem ser textos válidos.",
    );
  }

  const normalizedCurrentPassword = data.currentPassword.trim();
  const normalizedNewPassword = data.newPassword.trim();

  if (!normalizedCurrentPassword || !normalizedNewPassword) {
    throw new ValidationError("As senhas não podem estar vazias.");
  }

  const result = changePasswordSchema.safeParse(normalizedNewPassword);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0].message);
  }

  if (normalizedCurrentPassword === normalizedNewPassword) {
    throw new ValidationError(
      "A nova senha deve ser diferente da senha atual.",
    );
  }

  return {
    currentPassword: normalizedCurrentPassword,
    newPassword: normalizedNewPassword,
  };
}

function validateUpdateProfileInput(data) {
  const normalizedName = validateName(data.name);
  return {
    name: normalizedName,
  };
}

module.exports = {
  ValidationError,
  validateCreateUserInput,
  validateChangePasswordInput,
  validateUpdateProfileInput,
};
