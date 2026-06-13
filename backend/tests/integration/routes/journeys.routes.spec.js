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
      const mockResponse = { summary: { busLines: ['10'] }, routes: [] };
      planJourney.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/journeys/plan')
        .send({
          origin: validOrigin,
          destination: validDestination
        });

      expect(response.status).toBe(200);
      // Validando preservação do payload legado
      expect(response.body.summary).toEqual(mockResponse.summary);
      expect(response.body.routes).toEqual(mockResponse.routes);
      // Validando novos campos conversacionais
      expect(response.body.speechText).toBe("Rota calculada com sucesso.");
      expect(response.body.expectedInput).toBe("NONE");
      expect(response.body.conversationState).toBe("JOURNEY_DISPLAYED");
      expect(response.body.actions).toEqual(["REPEAT", "CANCEL"]);
      expect(response.body.displayData).toBeDefined();
      expect(response.body.metadata.sessionId).toBeDefined(); // sessionId gerado!
      expect(planJourney).toHaveBeenCalled();
    });

    test('deve reutilizar sessionId se fornecido no cabeçalho X-Session-ID', async () => {
      const mockResponse = { summary: { busLines: ['10'] }, routes: [] };
      planJourney.mockResolvedValue(mockResponse);

      // 1. Faz a primeira requisição para gerar a sessão
      const firstResponse = await request(app)
        .post('/journeys/plan')
        .send({
          origin: validOrigin,
          destination: validDestination
        });

      const generatedSessionId = firstResponse.body.metadata.sessionId;
      expect(generatedSessionId).toBeDefined();

      // 2. Faz a segunda requisição enviando o sessionId recebido
      const secondResponse = await request(app)
        .post('/journeys/plan')
        .set('X-Session-ID', generatedSessionId)
        .send({
          origin: validOrigin,
          destination: validDestination
        });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.metadata.sessionId).toBe(generatedSessionId);
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
      const mockResponse = { mode: 'resolved', candidates: [], resolvedDestination: { name: 'Shopping' } };
      resolveDestinationService.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/journeys/resolve-destination')
        .send({ text: '  Shopping Uberaba  ', origin: validOrigin });

      expect(response.status).toBe(200);
      // Validando preservação do payload legado
      expect(response.body.mode).toBe('resolved');
      expect(response.body.resolvedDestination).toEqual(mockResponse.resolvedDestination);
      // Validando novos campos conversacionais
      expect(response.body.speechText).toBeDefined();
      expect(response.body.expectedInput).toBe("VOICE_OR_TOUCH");
      expect(response.body.conversationState).toBe("WAITING_CONFIRMATION");
      expect(response.body.actions).toEqual(["CONFIRM", "CANCEL", "REPEAT"]);
      expect(response.body.displayData).toBeDefined();
      expect(response.body.metadata.sessionId).toBeDefined(); // sessionId gerado!
      // Verifica normalização de texto (trim)
      expect(resolveDestinationService).toHaveBeenCalledWith({
        text: 'Shopping Uberaba',
        origin: validOrigin
      });
    });

    test('deve reutilizar sessionId se fornecido no corpo da requisição', async () => {
      const mockResponse = { mode: 'suggestions', options: [{ name: 'Uniube' }] };
      resolveDestinationService.mockResolvedValue(mockResponse);

      // 1. Faz a primeira requisição para gerar a sessão
      const firstResponse = await request(app)
        .post('/journeys/resolve-destination')
        .send({
          text: 'Uniube',
          origin: validOrigin
        });

      const generatedSessionId = firstResponse.body.metadata.sessionId;
      expect(generatedSessionId).toBeDefined();

      // 2. Faz a segunda requisição enviando o sessionId no corpo
      const secondResponse = await request(app)
        .post('/journeys/resolve-destination')
        .send({
          text: 'Uniube',
          origin: validOrigin,
          sessionId: generatedSessionId
        });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.metadata.sessionId).toBe(generatedSessionId);
      expect(secondResponse.body.conversationState).toBe("WAITING_DESTINATION_SELECTION");
    });
  });
});
