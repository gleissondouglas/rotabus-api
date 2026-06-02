import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";

/**
 * IP do computador para testes em dispositivo físico.
 * TODO: Atualize este IP caso mude de rede ou de computador.
 */
const YOUR_COMPUTER_IP = "192.168.0.193";

function getBaseUrl() {
  const extraApiUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  
  // No simulador iOS, localhost costuma ser mais estável que o IP externo
  if (__DEV__ && Platform.OS === "ios" && !Device.isDevice) {
    return "http://localhost:3000";
  }

  // Se houver uma URL no .env, use-a
  if (extraApiUrl && !extraApiUrl.includes("localhost")) {
    return extraApiUrl;
  }

  if (__DEV__) {
    // Android Emulator
    if (Platform.OS === "android" && !Device.isDevice) {
      return "http://10.0.2.2:3000";
    }

    // Fallback geral para dev (usa o IP fixo ou localhost)
    return extraApiUrl || `http://${YOUR_COMPUTER_IP}:3000`;
  }

  return extraApiUrl || "https://api.sua-nuvem.com";
}

export const API_BASE_URL = getBaseUrl();

console.log("[APIConfig] Servidor configurado em:", API_BASE_URL);
