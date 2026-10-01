import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { appStorage } from "../services/storage.service";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe("appStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Native Platform (iOS/Android)", () => {
    beforeAll(() => {
      Platform.OS = "ios"; // Simulando mobile
    });

    it("deve usar SecureStore para setItem", async () => {
      await appStorage.setItem("token", "123");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("token", "123");
    });

    it("deve usar SecureStore para getItem", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("123");
      const value = await appStorage.getItem("token");
      expect(value).toBe("123");
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith("token");
    });

    it("deve usar SecureStore para deleteItem", async () => {
      await appStorage.deleteItem("token");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("token");
    });

    it("deve dividir payloads maiores que 1800 bytes em chunks no setItem", async () => {
      const largePayload = "a".repeat(4000); // 4000 bytes > 1800
      await appStorage.setItem("large_route", largePayload);

      // Deve ter criado 3 chunks: chunk_0 (1800), chunk_1 (1800), chunk_2 (400) + manifesto
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("large_route__chunk_0", "a".repeat(1800));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("large_route__chunk_1", "a".repeat(1800));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("large_route__chunk_2", "a".repeat(400));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("large_route", "__ROTABUS_CHUNKED__:3");
    });

    it("deve reconstruir payloads divididos em chunks no getItem", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
        if (key === "large_route") return Promise.resolve("__ROTABUS_CHUNKED__:2");
        if (key === "large_route__chunk_0") return Promise.resolve("chunk1_");
        if (key === "large_route__chunk_1") return Promise.resolve("chunk2");
        return Promise.resolve(null);
      });

      const value = await appStorage.getItem("large_route");
      expect(value).toBe("chunk1_chunk2");
    });

    it("deve deletar todos os chunks ao chamar deleteItem em dado chunked", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("__ROTABUS_CHUNKED__:2");
      await appStorage.deleteItem("large_route");

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("large_route__chunk_0");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("large_route__chunk_1");
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("large_route");
    });
  });

  describe("Web Platform", () => {
    const mockLocalStorage = {
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
    };

    beforeAll(() => {
      Platform.OS = "web";
      Object.defineProperty(global, "localStorage", {
        value: mockLocalStorage,
        writable: true,
      });
    });

    afterAll(() => {
      Platform.OS = "ios";
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("deve usar localStorage para setItem na web", async () => {
      await appStorage.setItem("token", "123");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("token", "123");
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it("deve usar localStorage para getItem na web", async () => {
      mockLocalStorage.getItem.mockReturnValueOnce("123");
      const value = await appStorage.getItem("token");
      expect(value).toBe("123");
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("token");
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it("deve usar localStorage para deleteItem na web", async () => {
      await appStorage.deleteItem("token");
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("token");
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });
  });
});
