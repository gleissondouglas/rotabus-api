const { 
  validateCreateUserInput, 
  validateChangePasswordInput,
  ValidationError
} = require('../../../src/modules/users/users.validator');

describe('Users Validator (Baseline)', () => {
  describe('validateCreateUserInput', () => {
    test('deve validar nome com caracteres permitidos', () => {
      const input = { name: 'João d\'Ávila-Souza', email: 'test@test.com', password: 'Password1' };
      const result = validateCreateUserInput(input);
      expect(result.name).toBe('João d\'Ávila-Souza');
    });

    test('deve lançar erro para nome muito curto', () => {
      const input = { name: 'Jo', email: 'test@test.com', password: 'Password1' };
      expect(() => validateCreateUserInput(input)).toThrow('O nome deve ter pelo menos 3 caracteres.');
    });

    test('deve lançar erro para caracteres inválidos no nome', () => {
      const input = { name: 'João 123', email: 'test@test.com', password: 'Password1' };
      expect(() => validateCreateUserInput(input)).toThrow('O nome contém caracteres inválidos.');
    });
  });

  describe('validateChangePasswordInput', () => {
    test('deve validar se nova senha é igual à atual', () => {
      const input = { currentPassword: 'Password1', newPassword: 'Password1' };
      expect(() => validateChangePasswordInput(input)).toThrow('A nova senha deve ser diferente da senha atual.');
    });

    test('deve aceitar senhas diferentes', () => {
      const input = { currentPassword: 'Password1', newPassword: 'NewPassword2' };
      const result = validateChangePasswordInput(input);
      expect(result.newPassword).toBe('NewPassword2');
    });
  });
});
