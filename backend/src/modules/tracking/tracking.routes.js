const express = require('express');
const router = express.Router();
const trackingController = require('./tracking.controller');
const { authMiddleware } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { pingLocationSchema } = require('./tracking.validator');
const rateLimit = require('express-rate-limit');

// Rate limit inteligente: 1 ping a cada 5 segundos por usuário/dispositivo
// Previne bloqueios mútuos entre passageiros que compartilham o mesmo CGNAT móvel (mesmo IP)
const pingLimiter = rateLimit({
  windowMs: 5 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.headers?.['x-device-id'] || req.ip,
  message: { error: true, message: 'Aguarde alguns segundos antes de enviar outra localização.' },
});

// Rota para o aplicativo ENVIAR o GPS do passageiro (Modo "Waze")
router.post('/ping', authMiddleware, pingLimiter, validate(pingLocationSchema), trackingController.pingLocation);

// Rota para o aplicativo CONSULTAR onde o ônibus está
router.get('/bus/:lineId', trackingController.getBus);

module.exports = router;

