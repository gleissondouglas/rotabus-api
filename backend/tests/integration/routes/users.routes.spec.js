const request = require('supertest');

// Mocks devem ser definidos antes de importar o app
jest.mock('../../../src/modules/auth/auth.middleware', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 1, email: 'test@test.com', role: 'USER' };
    next();
  },
}));

jest.mock('../../../src/modules/users/users.service', () => ({
  createUserService: jest.fn(),
  updateProfileService: jest.fn(),
  changePasswordService: jest.fn(),
  listUsersService: jest.fn(),
  getProfileService: jest.fn(),
  deleteUserService: jest.fn(),
  deleteOwnUserService: jest.fn(),
}));

jest.mock('../../../src/shared/middlewares/rateLimiter.middleware', () => ({
  globalLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
}));

const app = require('../../../src/app');
const { 
  createUserService, 
  updateProfileService, 
  changePasswordService 
} = require('../../../src/modules/users/users.service');

describe('Users Routes (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /users', () => {
    test('deve retornar 400 para body inválido (campos ausentes)', async () => {
      const response = await request(app)
        .post('/users')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain('obrigatórios');
      expect(createUserService).not.toHaveBeenCalled();
    });

    test('deve normalizar email e nome e chamar o service quando o body for válido', async () => {
      const mockResponse = { message: 'Usuário criado com sucesso.', user: { id: 1, name: 'João Silva', email: 'joao@silva.com' } };
      createUserService.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/users')
        .send({ 
          name: '  João Silva  ', 
          email: '  JOAO@silva.com  ', 
          password: 'Password123' 
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockResponse);
      expect(createUserService).toHaveBeenCalledWith({
        name: 'João Silva',
        email: 'joao@silva.com',
        password: 'Password123'
      });
    });
  });

  describe('PATCH /users/me', () => {
    test('deve retornar 400 para payload inválido (nome muito curto)', async () => {
      const response = await request(app)
        .patch('/users/me')
        .send({ name: 'Jo' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('pelo menos 3 caracteres');
      expect(updateProfileService).not.toHaveBeenCalled();
    });

    test('deve chamar o service com dados normalizados quando payload for válido', async () => {
      const mockResponse = { message: 'Perfil atualizado com sucesso.', user: { id: 1, name: 'João Atualizado' } };
      updateProfileService.mockResolvedValue(mockResponse);

      const response = await request(app)
        .patch('/users/me')
        .send({ name: '  João Atualizado  ' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(updateProfileService).toHaveBeenCalledWith({
        userId: 1, // Injetado pelo mock do authMiddleware
        name: 'João Atualizado'
      });
    });
  });

  describe('PATCH /users/me/password', () => {
    test('deve retornar 400 quando a nova senha for inválida (sem números)', async () => {
      const response = await request(app)
        .patch('/users/me/password')
        .send({ 
          currentPassword: 'OldPassword123', 
          newPassword: 'OnlyLetters' 
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('pelo menos uma letra e um número');
      expect(changePasswordService).not.toHaveBeenCalled();
    });

    test('deve retornar 400 quando a nova senha for igual à senha atual', async () => {
      const response = await request(app)
        .patch('/users/me/password')
        .send({ 
          currentPassword: 'SamePassword123', 
          newPassword: 'SamePassword123' 
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('diferente da senha atual');
      expect(changePasswordService).not.toHaveBeenCalled();
    });

    test('deve chamar o service quando o payload for válido', async () => {
      const mockResponse = { message: 'Senha alterada com sucesso.' };
      changePasswordService.mockResolvedValue(mockResponse);

      const payload = { 
        currentPassword: 'OldPassword123', 
        newPassword: 'NewPassword456' 
      };

      const response = await request(app)
        .patch('/users/me/password')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(changePasswordService).toHaveBeenCalledWith({
        userId: 1,
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword456'
      });
    });
  });
});
