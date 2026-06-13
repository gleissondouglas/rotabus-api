import { sessionService } from "./session.service";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

describe("SessionService - SessionId Persistence", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    sessionService.clearSessionId();
    // Aguarda o término de tarefas assíncronas disparadas em background nos testes anteriores
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  test("deve salvar o sessionId em memória e no storage local", async () => {
    sessionService.setSessionId("uuid-123");
    expect(sessionService.getSessionId()).toBe("uuid-123");
    
    // Pequeno delay para garantir que o background work (.catch) do setItemAsync foi acionado
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("nuvem_session_id", "uuid-123");
  });

  test("deve remover o sessionId da memória e do storage ao limpar a sessão", async () => {
    sessionService.setSessionId("uuid-123");
    sessionService.clearSessionId();
    expect(sessionService.getSessionId()).toBeNull();

    // Pequeno delay
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("nuvem_session_id");
  });

  test("deve restaurar o sessionId do storage local para a memória", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("uuid-stored");
    const restored = await sessionService.restoreSessionId();
    expect(restored).toBe("uuid-stored");
    expect(sessionService.getSessionId()).toBe("uuid-stored");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("nuvem_session_id");
  });

  test("deve retornar null e manter sessionId null se falhar ao restaurar", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error("Storage error"));
    const restored = await sessionService.restoreSessionId();
    expect(restored).toBeNull();
    expect(sessionService.getSessionId()).toBeNull();
  });
});
