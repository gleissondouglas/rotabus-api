const { validate } = require('../../../src/shared/middlewares/validate.middleware');
const { z } = require('zod');

describe('Validate Middleware', () => {
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

  const userSchema = z.object({
    email: z.string().trim().toLowerCase().email('Email inválido'),
    age: z.number().min(18, 'Mínimo 18 anos')
  });

  test('deve validar req.body com sucesso e normalizar os dados', () => {
    req.body = { email: '  TESTE@gmail.com  ', age: 25 };
    
    const middleware = validate(userSchema, 'body');
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'teste@gmail.com', age: 25 });
  });

  test('deve validar req.query quando location for "query"', () => {
    const querySchema = z.object({
      search: z.string().trim()
    });
    req.query = { search: '  busca  ' };

    const middleware = validate(querySchema, 'query');
    middleware(req, res, next);

    expect(req.query.search).toBe('busca');
    expect(next).toHaveBeenCalledWith();
  });

  test('deve validar req.params quando location for "params"', () => {
    const paramsSchema = z.object({
      id: z.string().uuid('ID inválido')
    });
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    req.params = { id: validUuid };

    const middleware = validate(paramsSchema, 'params');
    middleware(req, res, next);

    expect(req.params.id).toBe(validUuid);
    expect(next).toHaveBeenCalledWith();
  });

  test('deve chamar next(error) com statusCode 400 quando o schema falhar', () => {
    req.body = { email: 'email-invalido', age: 10 };
    
    const middleware = validate(userSchema, 'body');
    middleware(req, res, next);

    const errorSentToNext = next.mock.calls[0][0];
    expect(errorSentToNext).toBeInstanceOf(Error);
    expect(errorSentToNext.statusCode).toBe(400);
    expect(errorSentToNext.name).toBe('ValidationError');
    // ZodError geralmente retorna a primeira falha que encontrar
    expect(errorSentToNext.message).toBeDefined(); 
  });

  test('deve passar erros que não são do Zod adiante', () => {
    const brokenSchema = {
      parse: () => { throw new Error('Erro inesperado'); }
    };
    
    const middleware = validate(brokenSchema);
    middleware(req, res, next);

    const errorSentToNext = next.mock.calls[0][0];
    expect(errorSentToNext.message).toBe('Erro inesperado');
    expect(errorSentToNext.statusCode).toBeUndefined();
  });
});
