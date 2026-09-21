import { Platform } from "react-native";
import { isConnected, withRetry } from "../utils/network";

describe("network util", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe("withRetry", () => {
    it("deve tentar novamente quando houver erro de rede", async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("Network request failed"))
        .mockResolvedValueOnce("sucesso");
        
      const result = await withRetry(fn, 1, 10);
      expect(result).toBe("sucesso");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("não deve tentar novamente se não for erro de rede", async () => {
      const fn = jest.fn().mockRejectedValueOnce(new Error("Auth Error"));
      
      await expect(withRetry(fn, 1, 10)).rejects.toThrow("Auth Error");
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("isConnected", () => {
    let originalPlatformOS: typeof Platform.OS;

    beforeAll(() => {
      originalPlatformOS = Platform.OS;
    });

    afterAll(() => {
      Platform.OS = originalPlatformOS;
    });

    it("deve retornar onLine da window no modo web quando NetInfo não estiver disponível", async () => {
      Platform.OS = "web";
      Object.defineProperty(window, "navigator", {
        value: { onLine: true },
        configurable: true
      });
      
      const { isConnected: isConnectedLocal } = require("../utils/network");
      const result = await isConnectedLocal();
      expect(result).toBe(true);
    });

    it("deve retornar true na exception do isConnected", async () => {
      Platform.OS = "android";
      jest.doMock("@react-native-community/netinfo", () => {
        return {
          fetch: () => { throw new Error("NetInfo throw"); }
        };
      });

      const { isConnected: isConnectedLocal } = require("../utils/network");
      const result = await isConnectedLocal();
      expect(result).toBe(true);
    });

    it("deve lidar com falha ao carregar modulo NetInfo", async () => {
      Platform.OS = "ios";
      jest.doMock("@react-native-community/netinfo", () => {
        throw new Error("Cannot load module");
      });
      
      const { isConnected: isConnectedLocal } = require("../utils/network");
      const result = await isConnectedLocal();
      expect(result).toBe(true);
    });

    it("deve retornar o status de isInternetReachable", async () => {
      Platform.OS = "android";
      jest.doMock("@react-native-community/netinfo", () => {
        return {
          fetch: () => Promise.resolve({ isConnected: true, isInternetReachable: false })
        };
      });

      jest.mock("../config/api.config", () => ({
        API_BASE_URL: "https://api.rotabus.com"
      }));

      // @ts-ignore
      const prevDev = global.__DEV__;
      // @ts-ignore
      global.__DEV__ = false;

      const { isConnected: isConnectedLocal } = require("../utils/network");
      const result = await isConnectedLocal();
      expect(result).toBe(false); // isInternetReachable is false, isConnected is true => false

      // @ts-ignore
      global.__DEV__ = prevDev;
    });
  });
});
