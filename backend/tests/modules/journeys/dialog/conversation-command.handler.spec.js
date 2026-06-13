const { handleCommand } = require("../../../../src/modules/journeys/dialog/conversation-command.handler");
const sessionManager = require("../../../../src/modules/journeys/dialog/session.manager");
const dialogManager = require("../../../../src/modules/journeys/dialog/dialog.manager");

describe("ConversationCommandHandler", () => {
  const userId = 123;
  let session;

  beforeEach(async () => {
    sessionManager.clearAllSessions();
    session = await sessionManager.createSession({ userId, initialState: dialogManager.STATES.IDLE });
  });

  test("deve lançar erro se sessionId não for informado", async () => {
    await expect(
      handleCommand({ userId, command: "CANCEL" })
    ).rejects.toThrow("O sessionId é obrigatório");
  });

  test("deve lançar erro se command não for informado", async () => {
    await expect(
      handleCommand({ userId, sessionId: session.sessionId })
    ).rejects.toThrow("O comando é obrigatório");
  });

  test("deve lançar erro se a sessão não existir", async () => {
    await expect(
      handleCommand({ userId, sessionId: "non-existent-session-id", command: "CANCEL" })
    ).rejects.toThrow("Sessão conversacional não encontrada ou expirada");
  });

  test("deve processar o comando CANCEL com sucesso, movendo para IDLE e deletando a sessão", async () => {
    await sessionManager.updateSession({
      userId,
      sessionId: session.sessionId,
      patch: { currentState: dialogManager.STATES.WAITING_CONFIRMATION }
    });

    const result = await handleCommand({
      userId,
      sessionId: session.sessionId,
      command: "CANCEL"
    });

    expect(result.success).toBe(true);
    expect(result.command).toBe("CANCEL");
    expect(result.previousState).toBe(dialogManager.STATES.WAITING_CONFIRMATION);
    expect(result.currentState).toBe(dialogManager.STATES.IDLE);
    expect(result.sessionDeleted).toBe(true);

    // Verifica se a sessão foi realmente apagada
    const retrieved = await sessionManager.getSession({ userId, sessionId: session.sessionId });
    expect(retrieved).toBeNull();
  });

  test("deve processar o comando REPEAT mantendo o estado atual", async () => {
    await sessionManager.updateSession({
      userId,
      sessionId: session.sessionId,
      patch: { currentState: dialogManager.STATES.WAITING_CONFIRMATION }
    });

    const result = await handleCommand({
      userId,
      sessionId: session.sessionId,
      command: "REPEAT"
    });

    expect(result.success).toBe(true);
    expect(result.command).toBe("REPEAT");
    expect(result.previousState).toBe(dialogManager.STATES.WAITING_CONFIRMATION);
    expect(result.currentState).toBe(dialogManager.STATES.WAITING_CONFIRMATION);
    expect(result.repeatTriggered).toBe(true);

    // Sessão deve continuar existindo no estado anterior
    const retrieved = await sessionManager.getSession({ userId, sessionId: session.sessionId });
    expect(retrieved).not.toBeNull();
    expect(retrieved.currentState).toBe(dialogManager.STATES.WAITING_CONFIRMATION);
  });

  test("deve processar o comando CONFIRM a partir de WAITING_CONFIRMATION, avançando para JOURNEY_DISPLAYED", async () => {
    await sessionManager.updateSession({
      userId,
      sessionId: session.sessionId,
      patch: { currentState: dialogManager.STATES.WAITING_CONFIRMATION }
    });

    const result = await handleCommand({
      userId,
      sessionId: session.sessionId,
      command: "CONFIRM"
    });

    expect(result.success).toBe(true);
    expect(result.command).toBe("CONFIRM");
    expect(result.previousState).toBe(dialogManager.STATES.WAITING_CONFIRMATION);
    expect(result.currentState).toBe(dialogManager.STATES.JOURNEY_DISPLAYED);

    const retrieved = await sessionManager.getSession({ userId, sessionId: session.sessionId });
    expect(retrieved).not.toBeNull();
    expect(retrieved.currentState).toBe(dialogManager.STATES.JOURNEY_DISPLAYED);
    expect(retrieved.metadata.confirmedAt).toBeDefined();
  });

  test("deve lançar erro ao tentar usar CONFIRM em estado diferente de WAITING_CONFIRMATION", async () => {
    await expect(
      handleCommand({
        userId,
        sessionId: session.sessionId,
        command: "CONFIRM"
      })
    ).rejects.toThrow("Comando CONFIRM inválido para o estado atual");
  });

  test("deve processar o comando SELECT_OPTION a partir de WAITING_DESTINATION_SELECTION, avançando para JOURNEY_DISPLAYED", async () => {
    await sessionManager.updateSession({
      userId,
      sessionId: session.sessionId,
      patch: { currentState: dialogManager.STATES.WAITING_DESTINATION_SELECTION }
    });

    const result = await handleCommand({
      userId,
      sessionId: session.sessionId,
      command: "SELECT_OPTION",
      payload: { optionIndex: 1, optionName: "Shopping Uberaba" }
    });

    expect(result.success).toBe(true);
    expect(result.command).toBe("SELECT_OPTION");
    expect(result.previousState).toBe(dialogManager.STATES.WAITING_DESTINATION_SELECTION);
    expect(result.currentState).toBe(dialogManager.STATES.JOURNEY_DISPLAYED);

    const retrieved = await sessionManager.getSession({ userId, sessionId: session.sessionId });
    expect(retrieved).not.toBeNull();
    expect(retrieved.currentState).toBe(dialogManager.STATES.JOURNEY_DISPLAYED);
    expect(retrieved.metadata.selectedOptionIndex).toBe(1);
    expect(retrieved.metadata.selectedOptionName).toBe("Shopping Uberaba");
  });

  test("deve lançar erro ao tentar usar SELECT_OPTION em estado diferente de WAITING_DESTINATION_SELECTION", async () => {
    await expect(
      handleCommand({
        userId,
        sessionId: session.sessionId,
        command: "SELECT_OPTION"
      })
    ).rejects.toThrow("Comando SELECT_OPTION inválido para o estado atual");
  });

  test("deve lançar erro para comando desconhecido", async () => {
    await expect(
      handleCommand({
        userId,
        sessionId: session.sessionId,
        command: "INVALID_CMD"
      })
    ).rejects.toThrow("Comando conversacional desconhecido ou não suportado");
  });
});
