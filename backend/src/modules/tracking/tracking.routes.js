const express = require('express');
const router = express.Router();
const trackingController = require('./tracking.controller');
const { authMiddleware } = require('../auth/auth.middleware');
const { validate } = require('../../shared/middlewares/validate.middleware');
const { pingLocationSchema } = require('./tracking.validator');
const rateLimit = require('express-rate-limit');

// Rate limit: máximo 1 ping a cada 5 segundos por IP (proteção contra spam de GPS falso)
const pingLimiter = rateLimit({
  windowMs: 5 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'Aguarde alguns segundos antes de enviar outra localização.' },
});

// Rota para o aplicativo ENVIAR o GPS do passageiro (Modo "Waze")
router.post('/ping', authMiddleware, pingLimiter, validate(pingLocationSchema), trackingController.pingLocation);

// Rota para o aplicativo CONSULTAR onde o ônibus está
router.get('/bus/:lineId', trackingController.getBus);

module.exports = router;

