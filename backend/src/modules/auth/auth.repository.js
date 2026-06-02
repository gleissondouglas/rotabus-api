const prisma = require("../../config/prisma");

async function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  return prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

async function findPasswordResetTokenByHash(tokenHash) {
  return prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  });
}

async function markPasswordResetTokenAsUsed(id) {
  return prisma.passwordResetToken.update({
    where: {
      id,
    },
    data: {
      usedAt: new Date(),
    },
  });
}

async function invalidateUserPasswordResetTokens(userId) {
  return prisma.passwordResetToken.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });
}

module.exports = {
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  markPasswordResetTokenAsUsed,
  invalidateUserPasswordResetTokens,
};
