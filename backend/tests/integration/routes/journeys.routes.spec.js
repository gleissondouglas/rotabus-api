const request = require('supertest');

// Mocks devem ser definidos antes de importar o app
jest.mock('../../../src/modules/auth/auth.middleware', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 1, email: 'test@test.com', role: 'USER' };
    next();
  },
}));

jest.mock('../../../src/shared/middlewares/dailyLimit.middleware', () => ({
  dailyJourneyLimit: (req, res, next) => next(),
}));

jest.mock('../../../src/shared/middlewares/rateLimiter.middleware', () => ({
  globalLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
}));

jest.mock('../../../src/modules/journeys/journeys.service', () => ({
  planJourney: jest.fn(),
  resolveDestinationService: jest.fn(),
  reverseGeocodeService: jest.fn(),
  transcribeAudioService: jest.fn(),
}));

const app = require('../../../src/app');
const { planJourney, resolveDestinationService } = require('../../../src/modules/journeys/journeys.service');

describe('Journeys Routes (Integration)', () => {
  const validOrigin = { lat: -19.747, lng: -47.939 };
  const validDestination = { text: 'Praça Rui Barbosa' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /journeys/plan', () => {
    test('deve retornar 400 para body inválido (campos ausentes)', async () => {
      const response = await request(app)
        .post('/journeys/plan')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('obrigatórios');
      expect(planJourney).not.toHaveBeenCalled();
    });

    test('deve validar coordenadas inválidas', async () => {
      const response = await request(app)
        .post('/journeys/plan')
        .send({
          origin: { lat: -91, lng: 0 },
          destination: validDestination
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('entre -90 e 90');
    });

    test('deve aceitar payload válido e chamar o service mockado', async () => {
      const mockResponse = { summary: { busLines: [] }, routes: [] };
      planJourney.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/journeys/plan')
        .send({
          origin: validOrigin,
          destination: validDestination
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(planJourney).toHaveBeenCalled();
    });

    test('deve preservar suporte ao campo legado departureTime', async () => {
      const departureTime = '2026-06-13T14:20:00Z';
      planJourney.mockResolvedValue({ ok: true });

      const response = await request(app)
        .post('/journeys/plan')
        .send({
          origin: validOrigin,
          destination: validDestination,
          departureTime
        });

      expect(response.status).toBe(200);
      // O validateMiddleware deve transformar departureTime em timePreference antes do service
      const calledArg = planJourney.mock.calls[0][0];
      expect(calledArg.timePreference.type).toBe('DEPARTURE');
      expect(calledArg.timePreference.dateTime).toBe(departureTime);
    });

    test('deve normalizar routingPreference para UPPERCASE', async () => {
      planJourney.mockResolvedValue({ ok: true });

      await request(app)
        .post('/journeys/plan')
        .send({
          origin: validOrigin,
          destination: validDestination,
          routingPreference: 'less_walking'
        });

      const calledArg = planJourney.mock.calls[0][0];
      expect(calledArg.routingPreference).toBe('LESS_WALKING');
    });
  });

  describe('POST /journeys/resolve-destination', () => {
    test('deve retornar 400 para body inválido (texto curto)', async () => {
      const response = await request(app)
        .post('/journeys/resolve-destination')
        .send({ text: 'A', origin: validOrigin });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('pelo menos 2 caracteres');
      expect(resolveDestinationService).not.toHaveBeenCalled();
    });

    test('deve aceitar payload válido e chamar o service mockado', async () => {
      const mockResponse = { mode: 'resolved', candidates: [] };
      resolveDestinationService.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/journeys/resolve-destination')
        .send({ text: '  Shopping Uberaba  ', origin: validOrigin });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      // Verifica normalização de texto (trim)
      expect(resolveDestinationService).toHaveBeenCalledWith({
        text: 'Shopping Uberaba',
        origin: validOrigin
      });
    });
  });
});
