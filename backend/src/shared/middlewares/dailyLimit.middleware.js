const apiUsageRepository = require("../repositories/apiUsage.repository");

function createDailyLimitMiddleware(endpoint, limit, errorMessage, errorCode) {
  return async function(req, res, next) {
    try {
      const ip = req.ip || req.connection?.remoteAddress || "0.0.0.0";
      const userId = req.user?.id || null;
      const userRole = req.user?.role || "USER";

      const isAdmin = String(userRole).toUpperCase() === "ADMIN";
      if (isAdmin) {
        return next();
      }

      // Define o início do dia atual considerando o fuso horário de Brasília (UTC-3)
      const now = new Date();
      const spTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      // Calcula o offset UTC dinâmico baseado no fuso horário configurado
      const spOffset = (() => {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo",
          timeZoneName: "shortOffset",
        });
        const parts = formatter.formatToParts(now);
        const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-3";
        const match = tzPart.match(/GMT([+-]?\d+)/);
        const hours = match ? parseInt(match[1], 10) : -3;
        const sign = hours >= 0 ? "+" : "-";
        return `${sign}${String(Math.abs(hours)).padStart(2, "0")}:00`;
      })();
      const isoDate = `${spTime.getFullYear()}-${String(spTime.getMonth() + 1).padStart(2, "0")}-${String(spTime.getDate()).padStart(2, "0")}T00:00:00.000${spOffset}`;
      const startOfToday = new Date(isoDate);

      const usageCount = await apiUsageRepository.countUsage({
        ipAddress: ip,
        userId,
        since: startOfToday,
        endpoint,
      });

      if (usageCount >= limit) {
        return res.status(429).json({
          error: true,
          message: errorMessage,
          code: errorCode,
        });
      }

      req[`dailyUsage_${endpoint}`] = {
        userId,
        ipAddress: ip,
        endpoint,
      };

      next();
    } catch (error) {
      console.error(`[DailyLimit] Erro na verificação (${endpoint}):`, error.message);
      // SEGURANÇA: em caso de falha no banco, bloqueia o acesso em vez de liberar.
      // Retornar 503 evita que um atacante derrube o banco para bypassar as cotas.
      return res.status(503).json({
        error: true,
        message: "Serviço temporariamente indisponível. Tente novamente em instantes.",
      });
    }
  }
}

function createUsageRecorder(endpoint) {
  return async function(req) {
    const usageData = req[`dailyUsage_${endpoint}`];
    if (!usageData) return false;

    try {
      await apiUsageRepository.createUsage(usageData);
      return true;
    } catch (error) {
      console.error(`[DailyLimit] Erro ao registrar uso (${endpoint}):`, error.message);
      return false;
    }
  }
}

// Rotas (5 requisições por dia)
const dailyJourneyLimit = createDailyLimitMiddleware("/journeys", 5, "Limite diário atingido. Tente novamente amanhã.", "DAILY_LIMIT_EXCEEDED");
const recordDailyJourneyUsage = createUsageRecorder("/journeys");

// Places (10 requisições por dia)
const dailyPlacesLimit = createDailyLimitMiddleware("/places", 10, "Limite diário de buscas de lugares atingido. Tente novamente amanhã.", "DAILY_PLACES_LIMIT_EXCEEDED");
const recordDailyPlacesUsage = createUsageRecorder("/places");

// Geocode (20 requisições por dia)
const dailyGeocodeLimit = createDailyLimitMiddleware("/geocode", 20, "Limite diário de geolocalização atingido.", "DAILY_GEOCODE_LIMIT_EXCEEDED");
const recordDailyGeocodeUsage = createUsageRecorder("/geocode");



// Transcrição de Áudio (20 requisições por dia)
const dailyTranscribeLimit = createDailyLimitMiddleware("/transcribe", 20, "Limite diário de transcrição de áudio atingido.", "DAILY_TRANSCRIBE_LIMIT_EXCEEDED");
const recordDailyTranscribeUsage = createUsageRecorder("/transcribe");

module.exports = {
  dailyJourneyLimit, recordDailyJourneyUsage,
  dailyPlacesLimit, recordDailyPlacesUsage,
  dailyGeocodeLimit, recordDailyGeocodeUsage,
  dailyTranscribeLimit, recordDailyTranscribeUsage
};
