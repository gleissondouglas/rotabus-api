const tokenProvider = require('../../../src/shared/providers/token.provider');
const env = require('../../../src/config/env');

describe('TokenProvider', () => {
  const payload = { sub: 1, email: 'test@test.com', role: 'USER' };

  beforeAll(() => {
    // Garante que existe um secret para os testes
    if (!env.jwtSecret) {
      env.jwtSecret = 'test-secret-key';
    }
  });

  test('deve gerar um token válido contendo o payload', () => {
    const token = tokenProvider.generateToken(payload);
    expect(token).toBeDefined();
    
    const decoded = tokenProvider.verifyToken(token);
    expect(decoded).toMatchObject(payload);
  });

  test('deve lançar erro para token inválido', () => {
    expect(() => tokenProvider.verifyToken('token-invalido')).toThrow('Token inválido.');
  });

  test('deve lançar erro para token expirado', () => {
    // Gera um token que expira em 0 segundos
    const token = tokenProvider.generateToken(payload, { expiresIn: '0s' });
    
    // Pequena pausa para garantir a expiração
    expect(() => tokenProvider.verifyToken(token)).toThrow('Token expirado.');
  });

  test('deve conter campo sub no payload decodificado', () => {
    const token = tokenProvider.generateToken(payload);
    const decoded = tokenProvider.verifyToken(token);
    expect(decoded.sub).toBe(payload.sub);
  });

  describe('Erros de configuração do JWT_SECRET', () => {
    let originalSecret;

    beforeEach(() => {
      originalSecret = env.jwtSecret;
      env.jwtSecret = undefined;
    });

    afterEach(() => {
      env.jwtSecret = originalSecret;
    });

    test('deve lançar erro se JWT_SECRET não configurado ao gerar token', () => {
      expect(() => tokenProvider.generateToken(payload)).toThrow('JWT_SECRET não configurado.');
      try {
        tokenProvider.generateToken(payload);
      } catch (error) {
        expect(error.statusCode).toBe(500);
      }
    });

    test('deve lançar erro se JWT_SECRET não configurado ao verificar token', () => {
      expect(() => tokenProvider.verifyToken('algum-token')).toThrow('JWT_SECRET não configurado.');
      try {
        tokenProvider.verifyToken('algum-token');
      } catch (error) {
        expect(error.statusCode).toBe(500);
      }
    });
  });
});
