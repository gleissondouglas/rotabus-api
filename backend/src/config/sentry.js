const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

/**
 * Inicializa o monitoramento de erros com Sentry para o Backend.
 */
function initSentry() {
  const dsn = process.env.SENTRY_BACKEND_DSN;

  if (!dsn) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[Sentry] SENTRY_BACKEND_DSN não configurado em produção!");
    }
    return;
  }

  Sentry.init({
    dsn: dsn,
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Tracing
    tracesSampleRate: 1.0, // Em produção, reduza para algo como 0.1
    // Profiling
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || "development",
  });

  console.log("[Sentry] Monitoramento inicializado no Backend.");
}

/**
 * Captura uma exceção manualmente.
 */
function captureException(error, context) {
  if (context) {
    Sentry.setContext("extra", context);
  }
  Sentry.captureException(error);
}

module.exports = {
  initSentry,
  captureException
};
