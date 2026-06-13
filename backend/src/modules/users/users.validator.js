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

const changePasswordBaseSchema = z
  .string()
  .trim()
  .min(6, "A nova senha deve ter pelo menos 6 caracteres.")
  .max(128, "A nova senha deve ter no máximo 128 caracteres.")
  .regex(/^(?=.*[A-Za-z])(?=.*\d).{6,}$/, "A nova senha deve conter pelo menos uma letra e um número.");

const createUserSchema = z.object({
  name: z.string({
    message: "Nome, email e senha são obrigatórios e devem ser textos válidos.",
  }).trim().min(1, "O nome não pode estar vazio.").min(3, "O nome deve ter pelo menos 3 caracteres.").max(100, "O nome deve ter no máximo 100 caracteres.").regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "O nome contém caracteres inválidos."),
  email: z.string({
    message: "Nome, email e senha são obrigatórios e devem ser textos válidos.",
  }).trim().toLowerCase().min(1, "Email e senha não podem estar vazios.").max(254).email("Informe um email válido."),
  password: z.string({
    message: "Nome, email e senha são obrigatórios e devem ser textos válidos.",
  }).trim().min(1, "Email e senha não podem estar vazios.").min(6, "A senha deve ter pelo menos 6 caracteres.").max(128, "A senha deve ter no máximo 128 caracteres.").regex(/^(?=.*[A-Za-z])(?=.*\d).{6,}$/, "A senha deve conter pelo menos uma letra e um número."),
});

const changePasswordSchema = z.object({
  currentPassword: z.string({
    message: "Senha atual e nova senha são obrigatórias e devem ser textos válidos.",
  }).trim().min(1, "As senhas não podem estar vazias."),
  newPassword: z.string({
    message: "Senha atual e nova senha são obrigatórias e devem ser textos válidos.",
  }).trim().min(1, "As senhas não podem estar vazias.").min(6, "A nova senha deve ter pelo menos 6 caracteres.").max(128, "A nova senha deve ter no máximo 128 caracteres.").regex(/^(?=.*[A-Za-z])(?=.*\d).{6,}$/, "A nova senha deve conter pelo menos uma letra e um número."),
}).refine(data => data.currentPassword !== data.newPassword, {
  message: "A nova senha deve ser diferente da senha atual.",
  path: ["newPassword"]
});

const updateProfileSchema = z.object({
  name: nameSchema
});

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
  const result = createUserSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0].message);
  }
  return result.data;
}

function validateChangePasswordInput(data) {
  const result = changePasswordSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0].message);
  }
  return result.data;
}

function validateUpdateProfileInput(data) {
  const result = updateProfileSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0].message);
  }
  return result.data;
}

module.exports = {
  ValidationError,
  validateCreateUserInput,
  validateChangePasswordInput,
  validateUpdateProfileInput,
  createUserSchema,
  changePasswordSchema,
  updateProfileSchema,
};
