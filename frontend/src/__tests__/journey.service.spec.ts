import { journeyService } from "../services/journey.service";
import { sessionService } from "../services/session.service";
import { cache } from "../utils/cache";
import { request } from "../utils/api";

jest.mock("../utils/api", () => ({
  request: jest.fn(),
}));

jest.mock("../services/session.service", () => {
  let sessionId: string | null = null;
  return {
    sessionService: {
      getToken: jest.fn().mockResolvedValue("mock-token"),
      getSessionId: jest.fn().mockImplementation(() => sessionId),
      setSessionId: jest.fn().mockImplementation((id) => { sessionId = id; }),
      clearSessionId: jest.fn().mockImplementation(() => { sessionId = null; }),
    },
  };
});

jest.mock("../utils/network", () => ({
  withRetry: jest.fn((fn) => fn()),
}));

jest.mock("../utils/cache", () => ({
  cache: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  },
}));

describe("journeyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionService.clearSessionId();
  });

  describe("planJourney", () => {
    const mockRequest = {
      origin: { lat: -19, lng: -47 },
      destination: { text: "Shopping" },
    };

    it("deve retornar rota do cache se existir (Evita custo desnecessário)", async () => {
      const mockCachedResponse = { summary: { busLines: ["100"], totalDurationMin: 15 }, steps: [] };
      (cache.get as jest.Mock).mockResolvedValueOnce(mockCachedResponse);

      const result = await journeyService.planJourney(mockRequest);

      expect(cache.get).toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
      expect(result).toEqual(mockCachedResponse);
    });

    it("deve fazer requisição à API se o cache estiver vazio e salvar sessionId", async () => {
      (cache.get as jest.Mock).mockResolvedValueOnce(null);
      const mockApiResponse = {
        summary: { busLines: ["100"], totalDurationMin: 25 },
        metadata: { sessionId: "new-session" },
        steps: [],
      };
      (request as jest.Mock).mockResolvedValueOnce(mockApiResponse);

      const result = await journeyService.planJourney(mockRequest);

      expect(request).toHaveBeenCalled();
      expect(sessionService.setSessionId).toHaveBeenCalledWith("new-session");
      expect(sessionService.getSessionId()).toBe("new-session");
      expect(cache.set).toHaveBeenCalled();
      expect(result).toEqual(mockApiResponse);
    });

    it("deve injetar sessionId nas requisições se disponível na sessão", async () => {
      sessionService.setSessionId("uuid-123");
      (cache.get as jest.Mock).mockResolvedValueOnce(null);
      (request as jest.Mock).mockResolvedValueOnce({
        summary: { totalDurationMin: 20 },
        metadata: { sessionId: "uuid-123" },
      });

      await journeyService.planJourney({
        origin: { lat: 1, lng: 2 },
        destination: { text: "Centro" },
      });

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/journeys/plan"),
        expect.objectContaining({
          body: expect.stringContaining('"sessionId":"uuid-123"'),
        })
      );
    });

    it("deve limpar o sessionId local se o servidor disser que a sessão expirou", async () => {
      sessionService.setSessionId("uuid-expired");
      (cache.get as jest.Mock).mockResolvedValueOnce(null);
      (request as jest.Mock).mockRejectedValueOnce(new Error("Sessão conversacional não encontrada"));

      await expect(journeyService.planJourney(mockRequest)).rejects.toThrow(
        "Sessão conversacional não encontrada"
      );

      expect(sessionService.clearSessionId).toHaveBeenCalled();
      expect(sessionService.getSessionId()).toBeNull();
    });

    it("deve tolerar quando o backend não retornar campos conversacionais na resposta (fallback)", async () => {
      (cache.get as jest.Mock).mockResolvedValueOnce(null);
      (request as jest.Mock).mockResolvedValueOnce({
        summary: { totalDurationMin: 30, busLines: ["10"] },
        steps: [],
      });

      const result = await journeyService.planJourney({
        origin: { lat: 1, lng: 2 },
        destination: { text: "Centro" },
      });

      expect(result.summary.totalDurationMin).toBe(30);
      expect((result as any).speechText).toBeUndefined();
      expect(sessionService.setSessionId).not.toHaveBeenCalled();
    });

    it("deve seguir fluxo normal de fallback quando não houver sessionId", async () => {
      sessionService.clearSessionId();
      (cache.get as jest.Mock).mockResolvedValueOnce(null);
      (request as jest.Mock).mockResolvedValueOnce({
        summary: { totalDurationMin: 45, busLines: ["20"] },
        steps: [],
      });

      const result = await journeyService.planJourney({
        origin: { lat: 1, lng: 2 },
        destination: { text: "Shopping" },
      });

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/journeys/plan"),
        expect.objectContaining({
          body: JSON.stringify({
            origin: { lat: 1, lng: 2 },
            destination: { text: "Shopping" },
          }),
        })
      );
      expect(result.summary.totalDurationMin).toBe(45);
    });
  });

  describe("executeCommand", () => {
    it("deve executar comandos via executeCommand e gerenciar sessionId", async () => {
      (request as jest.Mock).mockResolvedValueOnce({
        conversationState: "WAITING_CONFIRMATION",
        metadata: { sessionId: "uuid-789" },
      });

      await journeyService.executeCommand({
        sessionId: "uuid-789",
        command: "CONFIRM",
      });

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/journeys/command"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ sessionId: "uuid-789", command: "CONFIRM" }),
        })
      );
      expect(sessionService.setSessionId).toHaveBeenCalledWith("uuid-789");
    });

    it("deve limpar sessionId local se o comando for CANCEL", async () => {
      sessionService.setSessionId("uuid-789");
      (request as jest.Mock).mockResolvedValueOnce({
        conversationState: "IDLE",
        metadata: {},
      });

      await journeyService.executeCommand({
        sessionId: "uuid-789",
        command: "CANCEL",
      });

      expect(sessionService.clearSessionId).toHaveBeenCalled();
      expect(sessionService.getSessionId()).toBeNull();
    });

    it("deve chamar /journeys/command com CONFIRM e manter sessionId", async () => {
      sessionService.setSessionId("uuid-confirm");
      (request as jest.Mock).mockResolvedValueOnce({
        conversationState: "JOURNEY_DISPLAYED",
        metadata: { sessionId: "uuid-confirm" },
      });

      await journeyService.executeCommand({
        sessionId: "uuid-confirm",
        command: "CONFIRM",
      });

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/journeys/command"),
        expect.objectContaining({
          body: JSON.stringify({ sessionId: "uuid-confirm", command: "CONFIRM" }),
        })
      );
      expect(sessionService.setSessionId).toHaveBeenCalledWith("uuid-confirm");
    });

    it("deve chamar /journeys/command com REPEAT e manter sessionId", async () => {
      sessionService.setSessionId("uuid-repeat");
      (request as jest.Mock).mockResolvedValueOnce({
        conversationState: "WAITING_CONFIRMATION",
        metadata: { sessionId: "uuid-repeat" },
      });

      await journeyService.executeCommand({
        sessionId: "uuid-repeat",
        command: "REPEAT",
      });

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/journeys/command"),
        expect.objectContaining({
          body: JSON.stringify({ sessionId: "uuid-repeat", command: "REPEAT" }),
        })
      );
      expect(sessionService.setSessionId).toHaveBeenCalledWith("uuid-repeat");
    });

    it("deve chamar /journeys/command com SELECT_OPTION e atualizar sessionId", async () => {
      sessionService.setSessionId("uuid-select");
      (request as jest.Mock).mockResolvedValueOnce({
        conversationState: "JOURNEY_DISPLAYED",
        metadata: { sessionId: "uuid-select" },
      });

      await journeyService.executeCommand({
        sessionId: "uuid-select",
        command: "SELECT_OPTION",
        payload: { optionIndex: 1, optionName: "Destino B" },
      });

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/journeys/command"),
        expect.objectContaining({
          body: JSON.stringify({
            sessionId: "uuid-select",
            command: "SELECT_OPTION",
            payload: { optionIndex: 1, optionName: "Destino B" },
          }),
        })
      );
    });

    it("deve limpar sessionId local se qualquer endpoint retornar erro de sessão expirada/inativa", async () => {
      sessionService.setSessionId("uuid-expired");
      (request as jest.Mock).mockRejectedValueOnce(
        new Error("Sessão conversacional não encontrada ou expirada.")
      );

      await expect(
        journeyService.executeCommand({
          sessionId: "uuid-expired",
          command: "CONFIRM",
        })
      ).rejects.toThrow("Sessão conversacional não encontrada ou expirada.");

      expect(sessionService.clearSessionId).toHaveBeenCalled();
      expect(sessionService.getSessionId()).toBeNull();
    });
  });

  describe("resolveDestination", () => {
    const mockDestRequest = {
      text: "centro",
      origin: { lat: -19, lng: -47 },
    };

    it("deve bater no cache antes da API para destinos (Evita custos)", async () => {
      const mockCachedDest = {
        resolvedDestination: { lat: 10, lng: 20 },
        cached: true,
      };
      (cache.get as jest.Mock).mockResolvedValueOnce(mockCachedDest);

      const result = await journeyService.resolveDestination(mockDestRequest);

      expect(cache.get).toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
      expect(result).toEqual(mockCachedDest);
    });

    it("deve resolver destino com sucesso e salvar sessionId", async () => {
      (cache.get as jest.Mock).mockResolvedValueOnce(null);
      (request as jest.Mock).mockResolvedValueOnce({
        resolvedDestination: { lat: -19, lng: -43 },
        metadata: { sessionId: "uuid-resolve" },
      });

      const res = await journeyService.resolveDestination({
        origin: { lat: 1, lng: 2 },
        text: "Praça",
      });

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/journeys/resolve-destination"),
        expect.objectContaining({
          body: JSON.stringify({ origin: { lat: 1, lng: 2 }, text: "Praça" }),
        })
      );
      expect(res.resolvedDestination?.lat).toBe(-19);
      expect(sessionService.setSessionId).toHaveBeenCalledWith("uuid-resolve");
      expect(sessionService.getSessionId()).toBe("uuid-resolve");
    });

    it("deve limpar sessionId se resolveDestination retornar erro de sessão", async () => {
      sessionService.setSessionId("uuid-to-clear");
      (cache.get as jest.Mock).mockResolvedValueOnce(null);
      (request as jest.Mock).mockRejectedValueOnce(new Error("Sessão expirada"));

      await expect(
        journeyService.resolveDestination({
          origin: { lat: 1, lng: 2 },
          text: "Praça",
        })
      ).rejects.toThrow("Sessão expirada");

      expect(sessionService.clearSessionId).toHaveBeenCalled();
      expect(sessionService.getSessionId()).toBeNull();
    });
  });
});
