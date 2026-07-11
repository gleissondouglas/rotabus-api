import { Platform } from "react-native";
import { API_BASE_URL } from "../config/api.config";

// Importação defensiva para evitar erro de NativeModule null durante avaliação
let NetInfo: any = null;
try {
  if (Platform.OS !== "web") {
    // O require condicional impede a avaliação do módulo nativo na web.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const netInfoModule = require("@react-native-community/netinfo");
    NetInfo = netInfoModule.default || netInfoModule;
  }
} catch (error) {
  console.warn("[NetworkUtil] Falha ao carregar NetInfo:", error);
}

/**
 * Utilitário para verificar a conectividade e gerenciar retentativas.
 */

/**
 * Verifica se o dispositivo está conectado à internet.
 */
export async function isConnected(): Promise<boolean> {
  try {
    if (!NetInfo || !NetInfo.fetch) {
      // Fallback para web ou quando o módulo falha
      if (Platform.OS === "web") {
        return window.navigator.onLine;
      }
      return true; 
    }
    
    const state = await NetInfo.fetch();
    
    // Identifica se estamos usando um backend local para desenvolvimento
    const isLocalBackend = 
      API_BASE_URL.includes("localhost") || 
      API_BASE_URL.includes("127.0.0.1") || 
      API_BASE_URL.includes("10.0.2.2") ||
      API_BASE_URL.includes("192.168.");

    if (__DEV__ || isLocalBackend) {
      // Em dev/simulador local, basta o dispositivo estar conectado na rede local (Wi-Fi/Ethernet)
      return !!state.isConnected;
    }
    
    return !!state.isConnected && state.isInternetReachable !== false;
  } catch (error) {
    console.warn("[NetworkUtil] Erro ao verificar conexão:", error);
    return true; 
  }
}

/**
 * Executa uma função assíncrona com retentativas em caso de falha de rede.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }

    // Se for erro de rede ou timeout, tenta novamente
    const isNetworkError = 
      error instanceof Error && 
      (error.message.includes("Network") || 
       error.message.includes("timeout") || 
       error.message.includes("Network request failed") ||
       error.message.includes("NativeModule.RNCNetInfo is null"));

    if (isNetworkError) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }

    throw error;
  }
}
