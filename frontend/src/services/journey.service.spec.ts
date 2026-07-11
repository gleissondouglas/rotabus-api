import { journeyService } from "./journey.service";
import { sessionService } from "./session.service";
import { request } from "../utils/api";

jest.mock("../utils/api", () => ({
  request: jest.fn(),
}));

jest.mock("./session.service", () => {
  let sessionId: string | null = null;
  return {
    sessionService: {
      getToken: jest.fn().mockResolvedValue("mock-token"),
      getSessionId: jest.fn().mockImplementation(() => sessionId),
      setSessionId: jest.fn().mockImplementation((id) => { sessionId = id; }),
      clearSessionId: jest.fn().mockImplementation(() => { sessionId = null; }),
    }
  };
});

jest.mock("../utils/network", () => ({
  withRetry: (fn: any) => fn(),
}));

jest.mock("../utils/cache", () => ({
  cache: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  }
}));

describe("JourneyService & SessionId Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionService.clearSessionId();
  });

  test("deve injetar sessionId nas requisições se disponível na sessão", async () => {
    sessionService.setSessionId("uuid-123");
    (request as jest.Mock).mockResolvedValue({
      metadata: { sessionId: "uuid-123" }
    });

    await journeyService.planJourney({
      origin: { lat: 1, lng: 2 },
      destination: { text: "Centro" }
    });

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("/journeys/plan"),
      expect.objectContaining({
        body: expect.stringContaining('"sessionId":"uuid-123"')
      })
    );
  });

  test("deve salvar sessionId de retorno após planJourney", async () => {
    (request as jest.Mock).mockResolvedValue({
      metadata: { sessionId: "uuid-456" }
    });

    await journeyService.planJourney({
      origin: { lat: 1, lng: 2 },
      destination: { text: "Centro" }
    });

    expect(sessionService.setSessionId).toHaveBeenCalledWith("uuid-456");
    expect(sessionService.getSessionId()).toBe("uuid-456");
  });

  test("deve executar comandos via executeCommand e gerenciar sessionId", async () => {
    (request as jest.Mock).mockResolvedValue({
      conversationState: "WAITING_CONFIRMATION",
      metadata: { sessionId: "uuid-789" }
    });

    await journeyService.executeCommand({
      sessionId: "uuid-789",
      command: "CONFIRM"
    });

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("/journeys/command"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionId: "uuid-789", command: "CONFIRM" })
      })
    );
    expect(sessionService.setSessionId).toHaveBeenCalledWith("uuid-789");
  });

  test("deve limpar sessionId local se o comando for CANCEL", async () => {
    sessionService.setSessionId("uuid-789");
    (request as jest.Mock).mockResolvedValue({
      conversationState: "IDLE",
      metadata: {}
    });

    await journeyService.executeCommand({
      sessionId: "uuid-789",
      command: "CANCEL"
    });

    expect(sessionService.clearSessionId).toHaveBeenCalled();
    expect(sessionService.getSessionId()).toBeNull();
  });

  test("deve chamar /journeys/command com CONFIRM e manter sessionId", async () => {
    sessionService.setSessionId("uuid-confirm");
    (request as jest.Mock).mockResolvedValue({
      conversationState: "JOURNEY_DISPLAYED",
      metadata: { sessionId: "uuid-confirm" }
    });

    await journeyService.executeCommand({
      sessionId: "uuid-confirm",
      command: "CONFIRM"
    });

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("/journeys/command"),
      expect.objectContaining({
        body: JSON.stringify({ sessionId: "uuid-confirm", command: "CONFIRM" })
      })
    );
    expect(sessionService.setSessionId).toHaveBeenCalledWith("uuid-confirm");
  });

  test("deve chamar /journeys/command com REPEAT e manter sessionId", async () => {
    sessionService.setSessionId("uuid-repeat");
    (request as jest.Mock).mockResolvedValue({
      conversationState: "WAITING_CONFIRMATION",
      metadata: { sessionId: "uuid-repeat" }
    });

    await journeyService.executeCommand({
      sessionId: "uuid-repeat",
      command: "REPEAT"
    });

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("/journeys/command"),
      expect.objectContaining({
        body: JSON.stringify({ sessionId: "uuid-repeat", command: "REPEAT" })
      })
    );
    expect(sessionService.setSessionId).toHaveBeenCalledWith("uuid-repeat");
  });

  test("deve chamar /journeys/command com SELECT_OPTION e atualizar sessionId", async () => {
    sessionService.setSessionId("uuid-select");
    (request as jest.Mock).mockResolvedValue({
      conversationState: "JOURNEY_DISPLAYED",
      metadata: { sessionId: "uuid-select" }
    });

    await journeyService.executeCommand({
      sessionId: "uuid-select",
      command: "SELECT_OPTION",
      payload: { optionIndex: 1, optionName: "Destino B" }
    });

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("/journeys/command"),
      expect.objectContaining({
        body: JSON.stringify({
          sessionId: "uuid-select",
          command: "SELECT_OPTION",
          payload: { optionIndex: 1, optionName: "Destino B" }
        })
      })
    );
  });

  test("deve limpar sessionId local se qualquer endpoint retornar erro de sessão expirada/inativa", async () => {
    sessionService.setSessionId("uuid-expired");
    (request as jest.Mock).mockRejectedValue(new Error("Sessão conversacional não encontrada ou expirada."));

    await expect(journeyService.executeCommand({
      sessionId: "uuid-expired",
      command: "CONFIRM"
    })).rejects.toThrow("Sessão conversacional não encontrada ou expirada.");

    expect(sessionService.clearSessionId).toHaveBeenCalled();
  });

  test("deve tolerar quando o backend não retornar campos conversacionais na resposta (fallback)", async () => {
    (request as jest.Mock).mockResolvedValue({
      summary: { totalDurationMin: 30, busLines: ["10"] },
      steps: []
    });

    const result = await journeyService.planJourney({
      origin: { lat: 1, lng: 2 },
      destination: { text: "Centro" }
    });

    expect(result.summary.totalDurationMin).toBe(30);
    expect(result.speechText).toBeUndefined();
    expect(sessionService.setSessionId).not.toHaveBeenCalled();
  });

  test("deve seguir fluxo normal de fallback quando não houver sessionId", async () => {
    sessionService.clearSessionId();
    (request as jest.Mock).mockResolvedValue({
      summary: { totalDurationMin: 45, busLines: ["20"] },
      steps: []
    });

    const result = await journeyService.planJourney({
      origin: { lat: 1, lng: 2 },
      destination: { text: "Shopping" }
    });

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("/journeys/plan"),
      expect.objectContaining({
        body: JSON.stringify({
          origin: { lat: 1, lng: 2 },
          destination: { text: "Shopping" }
        })
      })
    );
    expect(result.summary.totalDurationMin).toBe(45);
  });
});
