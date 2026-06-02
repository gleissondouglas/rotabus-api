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

function validateName(name) {
  if (!name || typeof name !== "string") {
    throw new ValidationError(
      "O nome é obrigatório e deve ser um texto válido.",
    );
  }

  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new ValidationError("O nome não pode estar vazio.");
  }

  if (normalizedName.length < 3) {
    throw new ValidationError("O nome deve ter pelo menos 3 caracteres.");
  }

  if (normalizedName.length > 100) {
    throw new ValidationError("O nome deve ter no máximo 100 caracteres.");
  }

  const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;

  if (!nameRegex.test(normalizedName)) {
    throw new ValidationError("O nome contém caracteres inválidos.");
  }

  return normalizedName;
}

function validateCreateUserInput({ name, email, password }) {
  if (
    !name ||
    !email ||
    !password ||
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    throw new ValidationError(
      "Nome, email e senha são obrigatórios e devem ser textos válidos.",
    );
  }

  const normalizedName = validateName(name);
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    throw new ValidationError("Email e senha não podem estar vazios.");
  }

  if (!validateEmail(normalizedEmail)) {
    throw new ValidationError("Informe um email válido.");
  }

  if (normalizedPassword.length < 6) {
    throw new ValidationError("A senha deve ter pelo menos 6 caracteres.");
  }

  if (normalizedPassword.length > 128) {
    throw new ValidationError("A senha deve ter no máximo 128 caracteres.");
  }

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  if (!passwordRegex.test(normalizedPassword)) {
    throw new ValidationError(
      "A senha deve conter pelo menos uma letra e um número.",
    );
  }

  return {
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword,
  };
}

function validateChangePasswordInput({ currentPassword, newPassword }) {
  if (
    !currentPassword ||
    !newPassword ||
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string"
  ) {
    throw new ValidationError(
      "Senha atual e nova senha são obrigatórias e devem ser textos válidos.",
    );
  }

  const normalizedCurrentPassword = currentPassword.trim();
  const normalizedNewPassword = newPassword.trim();

  if (!normalizedCurrentPassword || !normalizedNewPassword) {
    throw new ValidationError("As senhas não podem estar vazias.");
  }

  if (normalizedNewPassword.length < 6) {
    throw new ValidationError("A nova senha deve ter pelo menos 6 caracteres.");
  }

  if (normalizedNewPassword.length > 128) {
    throw new ValidationError(
      "A nova senha deve ter no máximo 128 caracteres.",
    );
  }

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  if (!passwordRegex.test(normalizedNewPassword)) {
    throw new ValidationError(
      "A nova senha deve conter pelo menos uma letra e um número.",
    );
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

function validateUpdateProfileInput({ name }) {
  const normalizedName = validateName(name);

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
