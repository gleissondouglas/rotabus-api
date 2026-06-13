const {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  clearExpiredSessions,
  clearAllSessions,
  DEFAULT_TTL_MS,
} = require("../../../../src/modules/journeys/dialog/session.manager");

describe("SessionManager (In-Memory)", () => {
  beforeEach(() => {
    clearAllSessions();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("deve criar uma sessão com ID e estado inicial", async () => {
    const userId = 1;
    const session = await createSession({ userId, initialState: "IDLE", metadata: { key: "value" } });

    expect(session.sessionId).toBeDefined();
    expect(session.userId).toBe(userId);
    expect(session.currentState).toBe("IDLE");
    expect(session.metadata.key).toBe("value");
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  test("deve recuperar uma sessão existente e renovar o tempo de expiração (sliding TTL)", async () => {
    const userId = 1;
    const session = await createSession({ userId });
    
    jest.advanceTimersByTime(5 * 60 * 1000); // Avança 5 minutos

    const retrieved = await getSession({ userId, sessionId: session.sessionId });
    expect(retrieved).not.toBeNull();
    expect(retrieved.sessionId).toBe(session.sessionId);
    
    // O tempo de expiração deve ter sido atualizado para mais 10 minutos a partir de agora
    expect(retrieved.expiresAt).toBe(Date.now() + DEFAULT_TTL_MS);
  });

  test("deve retornar null ao tentar recuperar uma sessão expirada", async () => {
    const userId = 1;
    const session = await createSession({ userId });
    
    jest.advanceTimersByTime(DEFAULT_TTL_MS + 1000); // Avança mais que o TTL

    const retrieved = await getSession({ userId, sessionId: session.sessionId });
    expect(retrieved).toBeNull();
  });

  test("deve atualizar parcialmente os campos da sessão", async () => {
    const userId = 1;
    const session = await createSession({ userId });

    const updated = await updateSession({
      userId,
      sessionId: session.sessionId,
      patch: { currentState: "WAITING_CONFIRMATION", metadata: { destination: "Centro" } },
    });

    expect(updated.currentState).toBe("WAITING_CONFIRMATION");
    expect(updated.metadata.destination).toBe("Centro");
  });

  test("deve excluir uma sessão por ID", async () => {
    const userId = 1;
    const session = await createSession({ userId });

    const deleted = await deleteSession({ userId, sessionId: session.sessionId });
    expect(deleted).toBe(true);

    const retrieved = await getSession({ userId, sessionId: session.sessionId });
    expect(retrieved).toBeNull();
  });

  test("deve limpar em lote sessões expiradas", async () => {
    await createSession({ userId: 1 });
    await createSession({ userId: 2 });

    jest.advanceTimersByTime(DEFAULT_TTL_MS + 1000);

    await createSession({ userId: 3 }); // Esta sessão não está expirada

    const clearedCount = await clearExpiredSessions();
    expect(clearedCount).toBe(2);
  });
});
