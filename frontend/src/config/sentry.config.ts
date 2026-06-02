import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Inicializa o monitoramento de erros com Sentry para o Frontend.
 */
export function initSentry() {
  const dsn = Constants.expoConfig?.extra?.sentryDsn;

  if (!dsn && !__DEV__) {
    console.warn("[Sentry] DSN não configurado em produção!");
  }

  Sentry.init({
    dsn: dsn || "",
    enabled: !!dsn,
    debug: __DEV__,
    environment: __DEV__ ? "development" : "production",
    enableAutoSessionTracking: true,
    
    // Configurações de Performance
    tracesSampleRate: __DEV__ ? 1.0 : 0.2, // Reduz a amostragem em produção para economizar cota
    
    // Ignora erros comuns de rede que não são "bugs" reais
    ignoreErrors: [
      "Network request failed",
      "The server took too long to respond",
      "Aborted",
    ],

    // Adiciona tags úteis para filtrar erros
    beforeSend(event) {
      if (event.tags) {
        event.tags["platform"] = Platform.OS;
      }
      return event;
    },
  });

  if (dsn && !__DEV__) {
    console.log("[Sentry] Monitoramento inicializado no Frontend.");
  }
}

/**
 * Adiciona uma trilha (breadcrumb) personalizada para facilitar o debug.
 */
export function addBreadcrumb(message: string, category = "app", level: Sentry.SeverityLevel = "info") {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
  });
}

/**
 * Captura uma exceção manualmente.
 */
export function captureException(error: any, context?: any) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}
