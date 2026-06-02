const prisma = require("../../config/prisma");

async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: {
      email,
    },
  });
}

async function findUserById(id) {
  return prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function findUserByIdWithPassword(id) {
  return prisma.user.findUnique({
    where: {
      id,
    },
  });
}

async function findAllUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function countUsersByRole(role) {
  return prisma.user.count({
    where: {
      role,
    },
  });
}

async function createUser({ name, email, passwordHash }) {
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function updateUser(id, data) {
  return prisma.user.update({
    where: {
      id,
    },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function deleteUserById(id) {
  return prisma.user.delete({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function updateUserPasswordHash({ id, passwordHash }) {
  return prisma.user.update({
    where: {
      id,
    },
    data: {
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      updatedAt: true,
    },
  });
}

module.exports = {
  findUserByEmail,
  findUserById,
  findUserByIdWithPassword,
  findAllUsers,
  countUsersByRole,
  createUser,
  deleteUserById,
  updateUser,
  updateUserPasswordHash,
};
