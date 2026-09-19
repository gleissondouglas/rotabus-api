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

  describe("resolveDestination", () => {
    test("deve resolver destino com sucesso e salvar sessionId", async () => {
      (request as jest.Mock).mockResolvedValue({
        destination: { lat: -19, lng: -43 },
        metadata: { sessionId: "uuid-resolve" }
      });

      const res = await journeyService.resolveDestination({
        origin: { lat: 1, lng: 2 },
        text: "Praça"
      });

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/journeys/resolve-destination"),
        expect.objectContaining({
          body: JSON.stringify({ origin: { lat: 1, lng: 2 }, text: "Praça" })
        })
      );
      expect(res.destination.lat).toBe(-19);
      expect(sessionService.setSessionId).toHaveBeenCalledWith("uuid-resolve");
    });

    test("deve limpar sessionId se resolveDestination retornar erro de sessão", async () => {
      (request as jest.Mock).mockRejectedValue(new Error("Sessão expirada"));
      await expect(journeyService.resolveDestination({
        origin: { lat: 1, lng: 2 },
        text: "Praça"
      })).rejects.toThrow("Sessão expirada");
      
      expect(sessionService.clearSessionId).toHaveBeenCalled();
    });

    test("deve retornar do cache se houver destino em cache", async () => {
      const { cache } = require("../utils/cache");
      (cache.get as jest.Mock).mockResolvedValueOnce({
        destination: { lat: 10, lng: 20 },
        cached: true
      });

      const res = await journeyService.resolveDestination({
        origin: { lat: 1, lng: 2 },
        text: "Terminal"
      });

      expect(res.destination.lat).toBe(10);
      expect(request).not.toHaveBeenCalled();
    });
  });

  describe("planJourney cache and errors", () => {
    test("deve retornar plano do cache se existir", async () => {
      const { cache } = require("../utils/cache");
      (cache.get as jest.Mock).mockResolvedValueOnce({
        summary: { totalDurationMin: 15 }
      });

      const res = await journeyService.planJourney({
        origin: { lat: 1, lng: 2 },
        destination: { text: "Terminal" }
      });

      expect(res.summary.totalDurationMin).toBe(15);
      expect(request).not.toHaveBeenCalled();
    });

    test("deve limpar sessionId se planJourney retornar erro de sessão", async () => {
      (request as jest.Mock).mockRejectedValue(new Error("sessão expirada"));
      await expect(journeyService.planJourney({
        origin: { lat: 1, lng: 2 },
        destination: { text: "Terminal" }
      })).rejects.toThrow("sessão expirada");
      
      expect(sessionService.clearSessionId).toHaveBeenCalled();
    });
  });
});
