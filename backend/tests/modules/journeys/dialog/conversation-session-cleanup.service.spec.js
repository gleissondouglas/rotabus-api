const { cleanupExpiredSessions } = require("../../../../src/modules/journeys/dialog/conversation-session-cleanup.service");
const repository = require("../../../../src/modules/journeys/dialog/conversation-session.repository");

jest.mock("../../../../src/modules/journeys/dialog/conversation-session.repository", () => ({
  deleteExpiredSessions: jest.fn(),
}));

describe("ConversationSessionCleanupService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve limpar sessões expiradas com sucesso e retornar contagem", async () => {
    repository.deleteExpiredSessions.mockResolvedValue(5);

    const result = await cleanupExpiredSessions();

    expect(repository.deleteExpiredSessions).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      deletedCount: 5,
    });
  });

  test("deve tratar erro do repositório de forma controlada", async () => {
    repository.deleteExpiredSessions.mockRejectedValue(new Error("Erro de banco"));

    const result = await cleanupExpiredSessions();

    expect(repository.deleteExpiredSessions).toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      deletedCount: 0,
      error: "Erro de banco",
    });
  });
});
