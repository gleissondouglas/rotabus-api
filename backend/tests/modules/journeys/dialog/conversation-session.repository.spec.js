const repository = require("../../../../src/modules/journeys/dialog/conversation-session.repository");
const prisma = require("../../../../src/config/prisma");

jest.mock("../../../../src/config/prisma", () => ({
  conversationSession: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

describe("ConversationSessionRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createSession", () => {
    test("deve chamar prisma.conversationSession.create com os dados corretos", async () => {
      const sessionData = {
        sessionId: "session-uuid",
        userId: 1,
        currentState: "WAITING_CONFIRMATION",
        context: { some: "data" },
        expiresAt: new Date(),
      };

      prisma.conversationSession.create.mockResolvedValue(sessionData);

      const result = await repository.createSession(sessionData);

      expect(prisma.conversationSession.create).toHaveBeenCalledWith({
        data: {
          sessionId: sessionData.sessionId,
          userId: sessionData.userId,
          currentState: sessionData.currentState,
          context: sessionData.context,
          expiresAt: sessionData.expiresAt,
        },
      });
      expect(result).toEqual(sessionData);
    });

    test("deve usar valores default se userId, currentState e context não forem fornecidos", async () => {
      const sessionData = {
        sessionId: "session-uuid",
        expiresAt: new Date(),
      };

      await repository.createSession(sessionData);

      expect(prisma.conversationSession.create).toHaveBeenCalledWith({
        data: {
          sessionId: sessionData.sessionId,
          userId: null,
          currentState: "IDLE",
          context: {},
          expiresAt: sessionData.expiresAt,
        },
      });
    });
  });

  describe("findActiveSession", () => {
    test("deve retornar null se sessionId for falsy", async () => {
      const result = await repository.findActiveSession(null);
      expect(result).toBeNull();
      expect(prisma.conversationSession.findFirst).not.toHaveBeenCalled();
    });

    test("deve chamar prisma.conversationSession.findFirst com filtros adequados", async () => {
      const mockSession = { sessionId: "session-uuid", currentState: "IDLE" };
      prisma.conversationSession.findFirst.mockResolvedValue(mockSession);

      const result = await repository.findActiveSession("session-uuid");

      expect(prisma.conversationSession.findFirst).toHaveBeenCalledWith({
        where: {
          sessionId: "session-uuid",
          expiresAt: { gte: expect.any(Date) },
          endedAt: null,
        },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe("updateSession", () => {
    test("deve chamar prisma.conversationSession.update com os patches corretos", async () => {
      const patch = { currentState: "JOURNEY_DISPLAYED" };
      prisma.conversationSession.update.mockResolvedValue({ sessionId: "session-uuid", ...patch });

      const result = await repository.updateSession("session-uuid", patch);

      expect(prisma.conversationSession.update).toHaveBeenCalledWith({
        where: { sessionId: "session-uuid" },
        data: patch,
      });
      expect(result.currentState).toBe("JOURNEY_DISPLAYED");
    });
  });

  describe("deleteSession", () => {
    test("deve retornar true se a sessão foi excluída com sucesso", async () => {
      prisma.conversationSession.deleteMany.mockResolvedValue({ count: 1 });

      const result = await repository.deleteSession("session-uuid");

      expect(prisma.conversationSession.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: "session-uuid" },
      });
      expect(result).toBe(true);
    });

    test("deve retornar false se nenhuma sessão foi excluída", async () => {
      prisma.conversationSession.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repository.deleteSession("session-uuid");

      expect(result).toBe(false);
    });
  });

  describe("deleteExpiredSessions", () => {
    test("deve chamar prisma.conversationSession.deleteMany para remover expirados", async () => {
      prisma.conversationSession.deleteMany.mockResolvedValue({ count: 5 });

      const result = await repository.deleteExpiredSessions();

      expect(prisma.conversationSession.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
      expect(result).toBe(5);
    });
  });
});
