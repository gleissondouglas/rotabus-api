const prisma = require("../../config/prisma");

/**
 * Repositório para operações na tabela ApiUsage.
 * Centraliza o acesso aos registros de consumo de API/limite diário.
 */

async function countUsage({ ipAddress, userId, since, endpoint }) {
  return prisma.apiUsage.count({
    where: {
      endpoint,
      createdAt: { gte: since },
      OR: [
        { ipAddress },
        ...(userId ? [{ userId }] : []),
      ],
    },
  });
}

async function createUsage({ userId, ipAddress, endpoint }) {
  return prisma.apiUsage.create({
    data: {
      userId,
      ipAddress,
      endpoint,
    },
  });
}

async function anonymizeUsageByUserId(userId) {
  return prisma.apiUsage.updateMany({
    where: { userId },
    data: { ipAddress: "0.0.0.0" },
  });
}

module.exports = {
  countUsage,
  createUsage,
  anonymizeUsageByUserId,
};
