import { router } from "expo-router";
import { sessionService } from "../services/session.service";
import { Alert } from "react-native";
import { addBreadcrumb } from "../config/sentry.config";

/**
 * Utilitário central para chamadas de API.
 * Gerencia timeouts, cabeçalhos comuns e erros globais (ex: 401).
 */

interface RequestOptions extends RequestInit {
  timeout?: number;
}

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeout = 10000, ...fetchOptions } = options;

  // Loga a tentativa de requisição no Sentry para monitoramento
  addBreadcrumb(`API Request: ${fetchOptions.method || 'GET'} ${url}`, "network");

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(id);

    // TRATAMENTO GLOBAL DE 401 (Não autorizado/Sessão expirada)
    if (response.status === 401) {
      console.warn("[API] Sessão expirada ou não autorizada.");
      await sessionService.clearSession();
      
      Alert.alert(
        "Sessão Expirada",
        "Sua sessão expirou por segurança. Por favor, entre novamente.",
        [{ text: "OK", onPress: () => router.replace("/") }]
      );
      
      throw new Error("Sessão expirada.");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.message || result?.error || `Erro na requisição (${response.status})`);
    }

    return result as T;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("O servidor demorou muito para responder. Verifique sua conexão.");
    }
    throw error;
  }
}
