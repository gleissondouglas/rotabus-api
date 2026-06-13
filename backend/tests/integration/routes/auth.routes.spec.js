const request = require('supertest');

// Mocks devem ser definidos antes de importar o app
jest.mock('../../../src/modules/auth/auth.service', () => ({
  loginService: jest.fn(),
  forgotPasswordService: jest.fn(),
  resetPasswordService: jest.fn(),
}));

jest.mock('../../../src/shared/middlewares/rateLimiter.middleware', () => ({
  globalLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
}));

const app = require('../../../src/app');
const { loginService, forgotPasswordService, resetPasswordService } = require('../../../src/modules/auth/auth.service');

describe('Auth Routes (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    test('deve retornar 400 para body inválido (campos ausentes)', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: true,
        message: 'Email e senha são obrigatórios e devem ser textos válidos.'
      });
      expect(loginService).not.toHaveBeenCalled();
    });

    test('deve normalizar email com trim/lowercase e chamar o service mockado', async () => {
      const mockResponse = { message: 'Login realizado com sucesso.', token: 'fake-token' };
      loginService.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/auth/login')
        .send({ email: '  USER@Example.COM  ', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      
      // Verifica se o middleware de validação normalizou os dados antes de passar ao controller/service
      expect(loginService).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123'
      });
    });
  });

  describe('POST /auth/forgot-password', () => {
    test('deve retornar 400 para email inválido', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'email-invalido' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: true,
        message: 'Informe um email válido.'
      });
      expect(forgotPasswordService).not.toHaveBeenCalled();
    });

    test('deve normalizar email válido antes de chamar o service', async () => {
      const mockResponse = { message: 'Se esse email estiver cadastrado, enviaremos instruções para recuperar a senha.' };
      forgotPasswordService.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: '  TESTE@gmail.com  ' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(forgotPasswordService).toHaveBeenCalledWith({
        email: 'teste@gmail.com'
      });
    });
  });

  describe('POST /auth/reset-password', () => {
    test('deve retornar 400 para payload inválido (senha fraca)', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'a'.repeat(32), newPassword: '123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('A nova senha deve ter entre 6 e 128 caracteres');
      expect(resetPasswordService).not.toHaveBeenCalled();
    });

    test('deve chamar o service mockado quando o payload for válido', async () => {
      const mockResponse = { message: 'Senha redefinida com sucesso.' };
      resetPasswordService.mockResolvedValue(mockResponse);

      const validPayload = { 
        token: 'a'.repeat(32), 
        newPassword: 'StrongPassword123' 
      };

      const response = await request(app)
        .post('/auth/reset-password')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(resetPasswordService).toHaveBeenCalledWith(validPayload);
    });
  });
});
