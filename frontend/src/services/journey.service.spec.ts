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

    const result = await journeyService.executeCommand({
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
});
