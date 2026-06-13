const { sanitizeMiddleware } = require('../../../src/shared/middlewares/sanitize.middleware');

describe('Sanitize Middleware (Baseline)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {}
    };
    res = {};
    next = jest.fn();
  });

  test('deve remover tags HTML de strings no body', () => {
    req.body = { name: '<b>Teste</b>', city: '<script>alert(1)</script>Uberaba' };
    sanitizeMiddleware(req, res, next);
    expect(req.body.name).toBe('Teste');
    expect(req.body.city).toBe('alert(1)Uberaba');
    expect(next).toHaveBeenCalled();
  });

  test('deve preservar o campo audioBase64 sem alterações', () => {
    const audioData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    req.body = { 
      text: 'Olá <b>Mundo</b>', 
      audioBase64: audioData 
    };
    sanitizeMiddleware(req, res, next);
    expect(req.body.text).toBe('Olá Mundo');
    expect(req.body.audioBase64).toBe(audioData); // Deve ser idêntico
  });

  test('deve sanitizar query params e path params', () => {
    req.query = { search: '<u>busca</u> ' };
    req.params = { id: ' 123 ' };
    sanitizeMiddleware(req, res, next);
    expect(req.query.search).toBe('busca');
    expect(req.params.id).toBe('123');
  });

  test('deve lidar com objetos aninhados', () => {
    req.body = {
      user: {
        bio: '<i>Sou desenvolvedor</i>'
      }
    };
    sanitizeMiddleware(req, res, next);
    expect(req.body.user.bio).toBe('Sou desenvolvedor');
  });
});
