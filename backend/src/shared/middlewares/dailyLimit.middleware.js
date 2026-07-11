const apiUsageRepository = require("../repositories/apiUsage.repository");

/**
 * Middleware para impor o limite estrito de 10 chamadas externas de rota por dia.
 * Considera tanto o IP quanto o ID do usuário autenticado.
 */
async function dailyJourneyLimit(req, res, next) {
  try {
    const ip = req.ip || req.connection?.remoteAddress || "0.0.0.0";
    const userId = req.user?.id || null;
    const userRole = req.user?.role || "USER";
    const endpoint = "/journeys";

    // Usuários ADMIN têm buscas ilimitadas
    const isAdmin = userRole === "ADMIN";
    if (isAdmin) {
      return next();
    }

    // Define o início do dia atual (00:00:00)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const usageCount = await apiUsageRepository.countUsage({
      ipAddress: ip,
      userId,
      since: startOfToday,
      endpoint,
    });

    if (usageCount >= 10) {
      return res.status(429).json({
        error: true,
        message: "Limite diário atingido. Tente novamente amanhã.",
        code: "DAILY_LIMIT_EXCEEDED",
      });
    }

    // O registro só será efetuado pelo controller se o provider externo responder
    // com sucesso. Respostas do cache e falhas não consomem a cota.
    req.dailyJourneyUsage = {
      userId,
      ipAddress: ip,
      endpoint,
    };

    next();
  } catch (error) {
    console.error("[DailyLimit] Erro na verificação:", error.message);
    next();
  }
}

async function recordDailyJourneyUsage(req) {
  if (!req.dailyJourneyUsage) return false;

  try {
    await apiUsageRepository.createUsage(req.dailyJourneyUsage);
    return true;
  } catch (error) {
    // O controle de custo não deve transformar uma rota já calculada em erro 500.
    console.error("[DailyLimit] Erro ao registrar uso:", error.message);
    return false;
  }
}

module.exports = { dailyJourneyLimit, recordDailyJourneyUsage };
