import { recentSearchService, DEFAULT_FALLBACK_SEARCHES } from "../recentSearch.service";
import { userService } from "../user.service";
import { appStorage } from "../storage.service";
import { sessionService } from "../session.service";

jest.mock("../user.service", () => ({
  userService: {
    getHistory: jest.fn(),
    addHistory: jest.fn(),
  },
}));

jest.mock("../storage.service", () => ({
  appStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock("../session.service", () => ({
  sessionService: {
    getToken: jest.fn(),
  },
}));

describe("recentSearchService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getRecentSearches", () => {
    it("deve retornar itens do histórico remoto quando o usuário estiver autenticado", async () => {
      (sessionService.getToken as jest.Mock).mockResolvedValue("test-token");
      (userService.getHistory as jest.Mock).mockResolvedValue([
        { id: 10, query: "Shopping Uberaba", address: "Av. Santa Beatriz da Silva", createdAt: "2026-09-24" },
      ]);

      const result = await recentSearchService.getRecentSearches();

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("Shopping Uberaba");
      expect(result[0].title).toBe("Shopping Uberaba");
      expect(appStorage.setItem).toHaveBeenCalled();
    });

    it("deve recorrer ao armazenamento local quando não autenticado", async () => {
      (sessionService.getToken as jest.Mock).mockResolvedValue(null);
      (appStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          { id: "1", query: "Terminal Oeste", title: "Terminal Oeste", subtitle: "Busca recente" },
        ])
      );

      const result = await recentSearchService.getRecentSearches();

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe("Terminal Oeste");
    });

    it("deve retornar DEFAULT_FALLBACK_SEARCHES quando não houver histórico nem dados locais", async () => {
      (sessionService.getToken as jest.Mock).mockResolvedValue(null);
      (appStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await recentSearchService.getRecentSearches();

      expect(result).toEqual(DEFAULT_FALLBACK_SEARCHES);
    });
  });

  describe("addRecentSearch", () => {
    it("deve adicionar nova busca no início da lista local e sincronizar com a API se autenticado", async () => {
      (sessionService.getToken as jest.Mock).mockResolvedValue("test-token");
      (userService.addHistory as jest.Mock).mockResolvedValue({ id: 1 });
      (appStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          { id: "1", query: "Local Antigo", title: "Local Antigo", subtitle: "Endereço" },
        ])
      );

      await recentSearchService.addRecentSearch({
        query: "Novo Local",
        title: "Novo Local",
        address: "Rua Nova, 123",
      });

      expect(appStorage.setItem).toHaveBeenCalledWith(
        "rotaBus_recent_searches",
        expect.stringContaining("Novo Local")
      );
      expect(userService.addHistory).toHaveBeenCalledWith({
        query: "Novo Local",
        address: "Rua Nova, 123",
        lat: undefined,
        lng: undefined,
      });
    });

    it("não deve salvar se query estiver vazia", async () => {
      await recentSearchService.addRecentSearch({ query: "   " });
      expect(appStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
