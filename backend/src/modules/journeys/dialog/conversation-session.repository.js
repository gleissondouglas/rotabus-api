const prisma = require("../../../config/prisma");

/**
 * Repositório para gerenciar a persistência da entidade ConversationSession no banco de dados.
 */

async function createSession({ sessionId, userId, currentState, context, expiresAt }) {
  return prisma.conversationSession.create({
    data: {
      sessionId,
      userId: userId || null,
      currentState: currentState || "IDLE",
      context: context || {},
      expiresAt,
    },
  });
}

async function findActiveSession(sessionId) {
  if (!sessionId) return null;
  return prisma.conversationSession.findFirst({
    where: {
      sessionId,
      expiresAt: { gte: new Date() },
      endedAt: null,
    },
  });
}

async function updateSession(sessionId, patch) {
  return prisma.conversationSession.update({
    where: { sessionId },
    data: patch,
  });
}

async function deleteSession(sessionId) {
  const result = await prisma.conversationSession.deleteMany({
    where: { sessionId },
  });
  return result.count > 0;
}

async function deleteExpiredSessions() {
  const result = await prisma.conversationSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

module.exports = {
  createSession,
  findActiveSession,
  updateSession,
  deleteSession,
  deleteExpiredSessions,
};
