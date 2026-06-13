const hashProvider = require("../../shared/providers/hash.provider");

const {
  validateCreateUserInput,
  validateChangePasswordInput,
  validateUpdateProfileInput,
} = require("./users.validator");

const {
  findUserByEmail,
  findUserById,
  findUserByIdWithPassword,
  findAllUsers,
  countUsersByRole,
  createUser,
  deleteUserById,
  updateUser,
  updateUserPasswordHash,
} = require("./users.repository");

async function createUserService(userData) {
  const validatedData = validateCreateUserInput(userData);

  const existingUser = await findUserByEmail(validatedData.email);

  if (existingUser) {
    const error = new Error("Já existe um usuário com esse email.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await hashProvider.generateHash(validatedData.password);

  const newUser = await createUser({
    name: validatedData.name,
    email: validatedData.email,
    passwordHash,
  });

  return {
    message: "Usuário criado com sucesso.",
    user: newUser,
  };
}

async function listUsersService() {
  const users = await findAllUsers();

  return {
    message: "Usuários encontrados com sucesso.",
    users,
  };
}

async function getProfileService(userId) {
  const user = await findUserById(userId);

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.statusCode = 404;
    throw error;
  }

  return {
    message: "Perfil encontrado com sucesso.",
    user,
  };
}

async function deleteUserService({ userIdToDelete, authenticatedUserId }) {
  const userId = Number(userIdToDelete);
  const authUserId = Number(authenticatedUserId);

  if (!Number.isInteger(userId) || userId <= 0) {
    const error = new Error("ID do usuário inválido.");
    error.statusCode = 400;
    throw error;
  }

  if (userId === authUserId) {
    const error = new Error(
      "Você não pode deletar sua própria conta de administrador por essa rota.",
    );
    error.statusCode = 400;
    throw error;
  }

  const user = await findUserById(userId);

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const deletedUser = await deleteUserById(userId);

  return {
    message: "Usuário deletado com sucesso.",
    user: deletedUser,
  };
}

async function deleteOwnUserService(userId) {
  if (!userId) {
    const error = new Error("ID do usuário não fornecido.");
    error.statusCode = 400;
    throw error;
  }

  const user = await findUserById(userId);

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.statusCode = 404;
    throw error;
  }

  // Regra de segurança: não permitir excluir o último administrador
  if (user.role === "ADMIN") {
    const adminCount = await countUsersByRole("ADMIN");
    
    if (adminCount <= 1) {
      const error = new Error("Não é possível excluir o último administrador do sistema.");
      error.statusCode = 400;
      throw error;
    }
  }

  // LGPD: Anonimizar logs de acesso antes de excluir o usuário.
  // O schema.prisma define onDelete: SetNull para o userId em ApiUsage,
  // mas o ipAddress (dado pessoal) permaneceria intacto.
  const apiUsageRepository = require("../../shared/repositories/apiUsage.repository");
  await apiUsageRepository.anonymizeUsageByUserId(userId);

  // Deleta o usuário. As relações PasswordResetToken (Cascade) 
  // são tratadas conforme definido no schema.prisma.
  const deletedUser = await deleteUserById(userId);

  return {
    message: "Conta excluída com sucesso.",
    user: deletedUser,
  };
}

async function changePasswordService({ userId, currentPassword, newPassword }) {
  const validatedData = validateChangePasswordInput({
    currentPassword,
    newPassword,
  });

  const user = await findUserByIdWithPassword(userId);

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const passwordMatches = await hashProvider.compareHash(
    validatedData.currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    const error = new Error("Senha atual incorreta.");
    error.statusCode = 401;
    throw error;
  }

  const newPasswordHash = await hashProvider.generateHash(validatedData.newPassword);

  const updatedUser = await updateUserPasswordHash({
    id: userId,
    passwordHash: newPasswordHash,
  });

  return {
    message: "Senha alterada com sucesso.",
    user: updatedUser,
  };
}

async function updateProfileService({ userId, name }) {
  const validatedData = validateUpdateProfileInput({ name });

  try {
    const updatedUser = await updateUser(userId, {
      name: validatedData.name,
    });

    return {
      message: "Perfil atualizado com sucesso.",
      user: updatedUser,
    };
  } catch (error) {
    if (error.code === "P2025") {
      const err = new Error("Usuário não encontrado.");
      err.statusCode = 404;
      throw err;
    }
    throw error;
  }
}

module.exports = {
  createUserService,
  listUsersService,
  getProfileService,
  deleteUserService,
  deleteOwnUserService,
  changePasswordService,
  updateProfileService,
};
