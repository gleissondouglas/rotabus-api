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

const repository = require("../../../../src/modules/journeys/dialog/conversation-session.repository");
jest.mock("../../../../src/modules/journeys/dialog/conversation-session.repository", () => ({
  createSession: jest.fn(),
  findActiveSession: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
  deleteExpiredSessions: jest.fn()
}));

describe("SessionManager (Postgres)", () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PERSISTENCE_DRIVER = "postgres";
    process.env.NODE_ENV = "production"; // Bypass 'test' restriction in usePostgres
  });

  afterEach(() => {
    process.env.PERSISTENCE_DRIVER = undefined;
    process.env.NODE_ENV = originalEnv;
  });

  test("deve criar uma sessão no Postgres", async () => {
    repository.createSession.mockResolvedValue({
      sessionId: "123",
      userId: 1,
      currentState: "IDLE",
      context: {},
      expiresAt: new Date(Date.now() + DEFAULT_TTL_MS)
    });

    const session = await createSession({ userId: 1 });
    
    expect(repository.createSession).toHaveBeenCalled();
    expect(session.sessionId).toBe("123");
    expect(session.userId).toBe(1);
    expect(session.currentState).toBe("IDLE");
  });

  test("deve recuperar uma sessão existente e renovar TTL no Postgres", async () => {
    repository.findActiveSession.mockResolvedValue({
      sessionId: "123",
      userId: 1,
      currentState: "IDLE",
      context: {},
      expiresAt: new Date()
    });

    repository.updateSession.mockResolvedValue({
      sessionId: "123",
      userId: 1,
      currentState: "IDLE",
      context: {},
      expiresAt: new Date(Date.now() + DEFAULT_TTL_MS)
    });

    const retrieved = await getSession({ userId: 1, sessionId: "123" });
    expect(retrieved).not.toBeNull();
    expect(repository.findActiveSession).toHaveBeenCalledWith("123");
    expect(repository.updateSession).toHaveBeenCalledWith("123", expect.objectContaining({ expiresAt: expect.any(Date) }));
  });

  test("deve atualizar sessão no Postgres", async () => {
    repository.findActiveSession.mockResolvedValue({
      sessionId: "123",
      userId: 1,
      currentState: "IDLE",
      context: {},
      expiresAt: new Date()
    });

    repository.updateSession.mockImplementation(async (id, patch) => {
      // Mock para ambos - quando atualiza o TTL no get e quando atualiza o estado
      return {
        sessionId: "123",
        userId: 1,
        currentState: patch.currentState || "IDLE",
        context: patch.context || {},
        expiresAt: patch.expiresAt || new Date()
      };
    });

    const updated = await updateSession({
      userId: 1,
      sessionId: "123",
      patch: { currentState: "WAITING_CONFIRMATION" }
    });

    expect(updated.currentState).toBe("WAITING_CONFIRMATION");
    expect(repository.updateSession).toHaveBeenCalled();
  });

  test("deve excluir sessão no Postgres", async () => {
    repository.deleteSession.mockResolvedValue(true);
    const deleted = await deleteSession({ userId: 1, sessionId: "123" });
    expect(deleted).toBe(true);
    expect(repository.deleteSession).toHaveBeenCalledWith("123");
  });

  test("deve limpar sessões expiradas no Postgres", async () => {
    repository.deleteExpiredSessions.mockResolvedValue(5);
    const count = await clearExpiredSessions();
    expect(count).toBe(5);
    expect(repository.deleteExpiredSessions).toHaveBeenCalled();
  });
});

