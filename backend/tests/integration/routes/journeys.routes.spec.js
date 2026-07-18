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
  recordDailyJourneyUsage: jest.fn().mockResolvedValue(true),
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
const { recordDailyJourneyUsage } = require('../../../src/shared/middlewares/dailyLimit.middleware');

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
      planJourney.mockResolvedValue({ journey: mockResponse, source: 'PROVIDER' });

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
      expect(recordDailyJourneyUsage).toHaveBeenCalledTimes(1);
    });

    test('deve reutilizar sessionId se fornecido no cabeçalho X-Session-ID', async () => {
      const mockResponse = { summary: { busLines: ['10'] }, routes: [] };
      planJourney.mockResolvedValue({ journey: mockResponse, source: 'CACHE' });

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
      expect(recordDailyJourneyUsage).not.toHaveBeenCalled();
    });

    test('deve preservar suporte ao campo legado departureTime', async () => {
      const departureTime = new Date().toISOString();
      planJourney.mockResolvedValue({ journey: { ok: true }, source: 'CACHE' });

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
      planJourney.mockResolvedValue({ journey: { ok: true }, source: 'CACHE' });

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
      expect(resolveDestinationService).toHaveBeenCalledWith(
        {
          text: 'Shopping Uberaba',
          origin: validOrigin
        },
        expect.anything()
      );
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

  describe('POST /journeys/command', () => {
    let activeSessionId;
    const testUserId = 1; // Corresponde ao mock de authMiddleware

    beforeEach(async () => {
      const { clearAllSessions, createSession } = require('../../../src/modules/journeys/dialog/session.manager');
      clearAllSessions();
      // Criamos uma sessão de teste no estado WAITING_CONFIRMATION
      const session = await createSession({ userId: testUserId, initialState: 'WAITING_CONFIRMATION' });
      activeSessionId = session.sessionId;
    });

    test('deve retornar 400 para body inválido (parâmetros ausentes)', async () => {
      const response = await request(app)
        .post('/journeys/command')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('obrigatório');
    });

    test('deve retornar 400 para ID de sessão inválido (não UUID)', async () => {
      const response = await request(app)
        .post('/journeys/command')
        .send({
          sessionId: 'not-a-uuid',
          command: 'CONFIRM'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('UUID');
    });

    test('deve retornar 400 para comando desconhecido', async () => {
      const response = await request(app)
        .post('/journeys/command')
        .send({
          sessionId: activeSessionId,
          command: 'INVALID_COMMAND'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('expected one of');
    });

    test('deve retornar 400 se a sessão conversacional não for encontrada', async () => {
      const validUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post('/journeys/command')
        .send({
          sessionId: validUuid,
          command: 'CANCEL'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('não encontrada');
    });

    test('deve processar o comando CANCEL com sucesso', async () => {
      const response = await request(app)
        .post('/journeys/command')
        .send({
          sessionId: activeSessionId,
          command: 'CANCEL'
        });

      expect(response.status).toBe(200);
      expect(response.body.speechText).toBe('Interação cancelada.');
      expect(response.body.conversationState).toBe('IDLE');
      expect(response.body.metadata.sessionId).toBe(''); // ID removido
    });

    test('deve processar o comando REPEAT com sucesso', async () => {
      const response = await request(app)
        .post('/journeys/command')
        .send({
          sessionId: activeSessionId,
          command: 'REPEAT'
        });

      expect(response.status).toBe(200);
      expect(response.body.speechText).toBe('Repetindo: é esse o destino que você deseja?');
      expect(response.body.conversationState).toBe('WAITING_CONFIRMATION');
    });

    test('deve processar o comando CONFIRM com sucesso', async () => {
      const response = await request(app)
        .post('/journeys/command')
        .send({
          sessionId: activeSessionId,
          command: 'CONFIRM'
        });

      expect(response.status).toBe(200);
      expect(response.body.speechText).toBe('Destino confirmado. Exibindo a melhor rota.');
      expect(response.body.conversationState).toBe('JOURNEY_DISPLAYED');
    });

    test('deve processar o comando SELECT_OPTION com sucesso', async () => {
      // Ajustamos a sessão existente para WAITING_DESTINATION_SELECTION
      const { updateSession } = require('../../../src/modules/journeys/dialog/session.manager');
      await updateSession({
        userId: testUserId,
        sessionId: activeSessionId,
        patch: { currentState: 'WAITING_DESTINATION_SELECTION' }
      });

      const response = await request(app)
        .post('/journeys/command')
        .send({
          sessionId: activeSessionId,
          command: 'SELECT_OPTION',
          payload: { optionIndex: 0, optionName: 'Uberaba' }
        });

      expect(response.status).toBe(200);
      expect(response.body.speechText).toBe('Opção selecionada. Exibindo a melhor rota.');
      expect(response.body.conversationState).toBe('JOURNEY_DISPLAYED');
    });
  });
});

describe('Fallback HTTP', () => {
  test('deve retornar JSON padronizado para rota inexistente', async () => {
    const response = await request(app).get('/rota-inexistente');

    expect(response.status).toBe(404);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({
      error: true,
      message: 'Rota não encontrada.',
    });
  });
});
