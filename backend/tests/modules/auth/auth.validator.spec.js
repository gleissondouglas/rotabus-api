const { 
  validateLoginInput, 
  validateForgotPasswordInput, 
  validateResetPasswordInput,
  ValidationError
} = require('../../../src/modules/auth/auth.validator');

describe('Auth Validator (Baseline)', () => {
  describe('validateLoginInput', () => {
    test('deve normalizar email (trim e lowercase) e retornar dados válidos', () => {
      const input = { email: '  USER@Example.COM  ', password: 'password123' };
      const result = validateLoginInput(input);
      expect(result.email).toBe('user@example.com');
      expect(result.password).toBe('password123');
    });

    test('deve lançar ValidationError se email for inválido', () => {
      const input = { email: 'invalid-email', password: 'password123' };
      expect(() => validateLoginInput(input)).toThrow(ValidationError);
      expect(() => validateLoginInput(input)).toThrow('Informe um email válido.');
    });

    test('deve lançar ValidationError se campos estiverem ausentes', () => {
      expect(() => validateLoginInput({})).toThrow('Email e senha são obrigatórios');
    });
  });

  describe('validateForgotPasswordInput', () => {
    test('deve normalizar email', () => {
      const result = validateForgotPasswordInput({ email: ' TEST@test.com ' });
      expect(result.email).toBe('test@test.com');
    });
  });

  describe('validateResetPasswordInput', () => {
    test('deve validar token curto', () => {
      const input = { token: 'short', newPassword: 'Password1' };
      expect(() => validateResetPasswordInput(input)).toThrow('Token de recuperação inválido.');
    });

    test('deve validar complexidade da senha (mínimo uma letra e um número)', () => {
      const input = { token: 'a'.repeat(32), newPassword: 'onlyletters' };
      expect(() => validateResetPasswordInput(input)).toThrow('A nova senha deve ter entre 6 e 128 caracteres, contendo pelo menos uma letra e um número.');
    });

    test('deve aceitar senha válida', () => {
      const input = { token: 'a'.repeat(32), newPassword: 'Valid1Password' };
      const result = validateResetPasswordInput(input);
      expect(result.newPassword).toBe('Valid1Password');
    });
  });
});
