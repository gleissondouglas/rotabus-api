import { Platform } from "react-native";

// Importação defensiva para evitar erro de NativeModule null durante avaliação
let NetInfo: any = null;
try {
  if (Platform.OS !== "web") {
    NetInfo = require("@react-native-community/netinfo").default || require("@react-native-community/netinfo");
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
    return !!state.isConnected && !!state.isInternetReachable;
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
