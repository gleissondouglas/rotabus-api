const errorMiddleware = require('../../../src/shared/middlewares/error.middleware');
const sentry = require('../../../src/config/sentry');

// Mock do Sentry
jest.mock('../../../src/config/sentry', () => ({
  captureException: jest.fn()
}));

describe('Error Middleware (Baseline)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { url: '/', method: 'GET', body: {}, user: { id: '1' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('deve retornar erro 400 formatado para ValidationError', () => {
    const error = new Error('Campo obrigatório');
    error.statusCode = 400;
    
    errorMiddleware(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: true,
      message: 'Campo obrigatório'
    });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  test('deve retornar erro 500 e chamar Sentry para erros genéricos', () => {
    const error = new Error('Erro de banco de dados');
    
    errorMiddleware(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: true,
      message: 'Erro de banco de dados'
    });
    expect(sentry.captureException).toHaveBeenCalled();
  });

  test('deve usar mensagem padrão se erro não tiver mensagem', () => {
    const error = { statusCode: 500 };
    
    errorMiddleware(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Erro interno do servidor'
    }));
  });

  test('deve ocultar detalhes técnicos de banco/Prisma em erros 500', () => {
    const error = new Error('Invalid `prisma.conversationSession.create()` invocation: type "public.SessionState" does not exist');
    error.statusCode = 500;

    errorMiddleware(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: true,
      message: 'Não foi possível processar sua solicitação no momento. Por favor, tente novamente em instantes.'
    });
    expect(sentry.captureException).toHaveBeenCalledWith(error, expect.anything());
  });
});
