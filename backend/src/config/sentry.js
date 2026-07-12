const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");
const env = require("./env");

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "set-cookie"]);

function scrubSentryEvent(event) {
  if (event.request?.headers) {
    for (const header of Object.keys(event.request.headers)) {
      if (SENSITIVE_HEADERS.has(header.toLowerCase())) {
        event.request.headers[header] = "[Filtered]";
      }
    }
  }

  if (event.request?.data) {
    event.request.data = "[Filtered]";
  }

  return event;
}

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
    tracesSampleRate: env.sentryTracesSampleRate,
    // Profiling
    profilesSampleRate: env.sentryProfilesSampleRate,
    environment: env.nodeEnv,
    beforeSend: scrubSentryEvent,
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
