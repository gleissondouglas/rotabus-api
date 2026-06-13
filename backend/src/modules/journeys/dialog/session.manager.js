const crypto = require("crypto");

const sessions = new Map();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutos em milissegundos

function getCompositeKey(userId, sessionId) {
  const safeUserId = userId !== undefined && userId !== null ? String(userId) : "anonymous";
  return `${safeUserId}:${sessionId}`;
}

function createSession({ userId, initialState = "IDLE", metadata = {} }) {
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const compositeKey = getCompositeKey(userId, sessionId);
  const now = Date.now();

  const session = {
    sessionId,
    userId: userId || null,
    currentState: initialState,
    lastAccessedAt: now,
    expiresAt: now + DEFAULT_TTL_MS,
    metadata,
  };

  sessions.set(compositeKey, session);
  return session;
}

function getSession({ userId, sessionId }) {
  if (!sessionId) return null;
  
  const compositeKey = getCompositeKey(userId, sessionId);
  const session = sessions.get(compositeKey);

  if (!session) return null;

  const now = Date.now();
  if (now > session.expiresAt) {
    sessions.delete(compositeKey);
    return null;
  }

  // Atualiza timestamp de acesso e expiração (sliding window)
  session.lastAccessedAt = now;
  session.expiresAt = now + DEFAULT_TTL_MS;
  sessions.set(compositeKey, session);

  return session;
}

function updateSession({ userId, sessionId, patch }) {
  const session = getSession({ userId, sessionId });
  if (!session) return null;

  const compositeKey = getCompositeKey(userId, sessionId);
  const updatedSession = {
    ...session,
    ...patch,
    lastAccessedAt: Date.now(),
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  };

  sessions.set(compositeKey, updatedSession);
  return updatedSession;
}

function deleteSession({ userId, sessionId }) {
  const compositeKey = getCompositeKey(userId, sessionId);
  return sessions.delete(compositeKey);
}

function clearExpiredSessions() {
  const now = Date.now();
  let clearedCount = 0;

  for (const [key, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(key);
      clearedCount++;
    }
  }

  return clearedCount;
}

// Para testes unitários, permite limpar todo o Map
function clearAllSessions() {
  sessions.clear();
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
