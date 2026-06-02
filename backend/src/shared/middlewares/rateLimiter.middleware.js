const rateLimit = require("express-rate-limit");

/**
 * Limite global para evitar DDoS e spam em toda a API.
 * 150 requisições por IP a cada 15 minutos.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 150,
  message: {
    message: "Muitas requisições vindas deste IP, tente novamente após 15 minutos.",
  },
  standardHeaders: true, // Retorna info de limite nos cabeçalhos `RateLimit-*`
  legacyHeaders: false, // Desativa os cabeçalhos `X-RateLimit-*`
});

/**
 * Limite específico para a rota de login para evitar ataques de força bruta.
 * 10 tentativas por IP a cada 15 minutos.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: {
    message: "Muitas tentativas de login, tente novamente após 15 minutos por segurança.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalLimiter,
  loginLimiter,
};
