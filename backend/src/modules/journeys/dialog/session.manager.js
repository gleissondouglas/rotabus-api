const crypto = require("crypto");
const repository = require("./conversation-session.repository");

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutos em milissegundos

// Armazenamento em memória (usado para testes locais e offline fallback)
const memorySessions = new Map();

function getCompositeKey(userId, sessionId) {
  const safeUserId = userId !== undefined && userId !== null ? String(userId) : "anonymous";
  return `${safeUserId}:${sessionId}`;
}

// Helper para mapear o registro do banco de dados no formato de sessão esperado
function mapToSession(dbSession) {
  if (!dbSession) return null;
  return {
    sessionId: dbSession.sessionId,
    userId: dbSession.userId,
    currentState: dbSession.currentState,
    expiresAt: dbSession.expiresAt instanceof Date ? dbSession.expiresAt.getTime() : dbSession.expiresAt,
    metadata: dbSession.context || {},
  };
}

// Retorna se o sistema está configurado para persistência durável no Postgres
function usePostgres() {
  return process.env.PERSISTENCE_DRIVER === "postgres" && process.env.NODE_ENV !== "test";
}

async function createSession({ userId, initialState = "IDLE", metadata = {}, sessionId }) {
  const finalSessionId = sessionId || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"));

  if (usePostgres()) {
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
    const dbSession = await repository.createSession({
      sessionId: finalSessionId,
      userId: userId || null,
      currentState: initialState,
      context: metadata,
      expiresAt,
    });
    return mapToSession(dbSession);
  } else {
    const compositeKey = getCompositeKey(userId, finalSessionId);
    const now = Date.now();
    const session = {
      sessionId: finalSessionId,
      userId: userId || null,
      currentState: initialState,
      lastAccessedAt: now,
      expiresAt: now + DEFAULT_TTL_MS,
      metadata,
    };
    memorySessions.set(compositeKey, session);
    return session;
  }
}

async function getSession({ userId, sessionId }) {
  if (!sessionId) return null;

  if (usePostgres()) {
    const dbSession = await repository.findActiveSession(sessionId);
    if (!dbSession) return null;

    // Garante isolamento da sessão se ela pertencer a outro usuário
    if (dbSession.userId && dbSession.userId !== userId) {
      return null;
    }

    // Sliding TTL: atualiza expiresAt a cada busca
    const newExpiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
    const updatedDbSession = await repository.updateSession(sessionId, {
      expiresAt: newExpiresAt,
    });
    return mapToSession(updatedDbSession);
  } else {
    const compositeKey = getCompositeKey(userId, sessionId);
    const session = memorySessions.get(compositeKey);
    if (!session) return null;

    const now = Date.now();
    if (now > session.expiresAt) {
      memorySessions.delete(compositeKey);
      return null;
    }

    // Sliding TTL: renova no acesso
    session.lastAccessedAt = now;
    session.expiresAt = now + DEFAULT_TTL_MS;
    memorySessions.set(compositeKey, session);
    return session;
  }
}

async function updateSession({ userId, sessionId, patch }) {
  if (usePostgres()) {
    const session = await getSession({ userId, sessionId });
    if (!session) return null;

    const dbPatch = {};
    if (patch.currentState !== undefined) {
      dbPatch.currentState = patch.currentState;
    }
    if (patch.metadata !== undefined) {
      dbPatch.context = {
        ...session.metadata,
        ...patch.metadata,
      };
    }
    if (patch.endedAt !== undefined) {
      dbPatch.endedAt = patch.endedAt;
    }

    // Estende a validade da sessão ativamente no update (Sliding TTL)
    dbPatch.expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);

    const updatedDbSession = await repository.updateSession(sessionId, dbPatch);
    return mapToSession(updatedDbSession);
  } else {
    const session = await getSession({ userId, sessionId });
    if (!session) return null;

    const compositeKey = getCompositeKey(userId, sessionId);
    const updatedSession = {
      ...session,
      ...patch,
      lastAccessedAt: Date.now(),
      expiresAt: Date.now() + DEFAULT_TTL_MS,
    };
    memorySessions.set(compositeKey, updatedSession);
    return updatedSession;
  }
}

async function deleteSession({ userId, sessionId }) {
  if (usePostgres()) {
    return repository.deleteSession(sessionId);
  } else {
    const compositeKey = getCompositeKey(userId, sessionId);
    return memorySessions.delete(compositeKey);
  }
}

async function clearExpiredSessions() {
  if (usePostgres()) {
    return repository.deleteExpiredSessions();
  } else {
    const now = Date.now();
    let clearedCount = 0;
    for (const [key, session] of memorySessions.entries()) {
      if (now > session.expiresAt) {
        memorySessions.delete(key);
        clearedCount++;
      }
    }
    return clearedCount;
  }
}

function clearAllSessions() {
  // Chamada síncrona mantida em memória para compatibilidade com beforeEach de testes unitários
  memorySessions.clear();
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  clearExpiredSessions,
  clearAllSessions,
  DEFAULT_TTL_MS,
};
