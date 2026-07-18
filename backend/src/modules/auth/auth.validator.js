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
  .min(
    6,
    "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.",
  )
  .max(
    128,
    "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.",
  )
  .regex(
    /^(?=.*[A-Za-z])(?=.*\d).{6,}$/,
    "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.",
  );

const loginSchema = z.object({
  email: z
    .string({
      message: "Email e senha são obrigatórios e devem ser textos válidos.",
    })
    .trim()
    .toLowerCase()
    .min(1, "Email e senha não podem estar vazios.")
    .email("Informe um email válido."),
  password: z
    .string({
      message: "Email e senha são obrigatórios e devem ser textos válidos.",
    })
    .trim()
    .min(1, "Email e senha não podem estar vazios."),
});

const forgotPasswordSchema = z.object({
  email: z
    .string({
      message: "Email é obrigatório e deve ser um texto válido.",
    })
    .trim()
    .toLowerCase()
    .min(1, "Email não pode estar vazio.")
    .email("Informe um email válido."),
});

const resetPasswordSchema = z.object({
  token: z
    .string({
      message: "Token e nova senha são obrigatórios e devem ser textos válidos.",
    })
    .trim()
    .min(1, "Token e nova senha não podem estar vazios.")
    .min(20, "Token de recuperação inválido."),
  newPassword: z
    .string({
      message: "Token e nova senha são obrigatórios e devem ser textos válidos.",
    })
    .trim()
    .min(1, "Token e nova senha não podem estar vazios.")
    .min(
      6,
      "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.",
    )
    .max(
      128,
      "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.",
    )
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d).{6,}$/,
      "A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.",
    ),
});

function validateLoginInput(data) {
  const result = loginSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0].message);
  }
  return result.data;
}

function validateForgotPasswordInput(data) {
  const result = forgotPasswordSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0].message);
  }
  return result.data;
}

function validateResetPasswordInput(data) {
  const result = resetPasswordSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0].message);
  }
  return result.data;
}

module.exports = {
  ValidationError,
  validateLoginInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
