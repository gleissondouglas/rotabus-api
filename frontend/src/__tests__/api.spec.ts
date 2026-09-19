import { request } from "../utils/api";
import { sessionService } from "../services/session.service";
import { Alert } from "react-native";

jest.mock("../services/session.service", () => ({
  sessionService: {
    clearSession: jest.fn(),
  },
}));

jest.mock("expo-router", () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Alert.alert = jest.fn();
  return rn;
});

// Mock do global fetch
global.fetch = jest.fn();

describe("api helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve retornar o json em caso de sucesso (200)", async () => {
    const mockResponse = { data: "test" };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await request("http://test.com/api");
    expect(result).toEqual(mockResponse);
  });

  it("deve disparar erro comum quando a api retorna status ruim diferente de 401", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: "Bad request error" }),
    });

    await expect(request("http://test.com/api")).rejects.toThrow("Bad request error");
  });

  it("deve interceptar erro 401 e deslogar o usuário (Segurança de Sessão)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    });

    await expect(request("http://test.com/api/protected-route")).rejects.toThrow("Sessão expirada.");
    
    // Verifica os gatilhos de segurança
    expect(sessionService.clearSession).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Sessão Expirada",
      "Sua sessão expirou por segurança. Por favor, entre novamente.",
      expect.any(Array)
    );
  });

  it("NÃO deve deslogar e exibir alert se o 401 vier da própria rota de login", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Credenciais inválidas" }),
    });

    await expect(request("http://test.com/api/auth/login")).rejects.toThrow("Credenciais inválidas");
    
    // Não deve acionar a segurança de deslogamento
    expect(sessionService.clearSession).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("deve lidar com json() lançando exceção", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error("Invalid json"); },
    });

    await expect(request("http://test.com/api")).rejects.toThrow("Erro na requisição (500)");
  });

  it("deve lançar erro amigável quando ocorrer AbortError (Timeout)", async () => {
    const error = new Error("Abort");
    error.name = "AbortError";
    (global.fetch as jest.Mock).mockRejectedValueOnce(error);

    await expect(request("http://test.com/api")).rejects.toThrow("O servidor demorou muito para responder. Verifique sua conexão.");
  });

  it("deve lançar erro amigável quando ocorrer erro de rede (Failed to fetch)", async () => {
    const error = new Error("Failed to fetch");
    (global.fetch as jest.Mock).mockRejectedValueOnce(error);

    await expect(request("http://test.com/api")).rejects.toThrow("Não foi possível conectar ao servidor. Verifique sua conexão com a internet.");
  });

  it("deve chamar router.replace ao pressionar OK no alerta de sessão expirada", async () => {
    const router = require("expo-router").router;
    let onPressCallback: any = null;
    (Alert.alert as jest.Mock).mockImplementation((_t, _m, buttons) => {
      onPressCallback = buttons[0].onPress;
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    });

    await expect(request("http://test.com/api/protected-route")).rejects.toThrow("Sessão expirada.");
    expect(onPressCallback).toBeDefined();
    
    onPressCallback();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
