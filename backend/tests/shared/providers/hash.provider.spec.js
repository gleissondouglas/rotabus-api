const { generateHash, compareHash } = require('../../../src/shared/providers/hash.provider');

describe('HashProvider', () => {
  const plainPassword = 'password123';

  test('deve gerar um hash diferente da senha original', async () => {
    const hash = await generateHash(plainPassword);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(plainPassword);
    expect(hash.length).toBeGreaterThan(10);
  });

  test('deve retornar true ao comparar senha correta com seu hash', async () => {
    const hash = await generateHash(plainPassword);
    const isMatch = await compareHash(plainPassword, hash);
    expect(isMatch).toBe(true);
  });

  test('deve retornar false ao comparar senha incorreta com hash', async () => {
    const hash = await generateHash(plainPassword);
    const isMatch = await compareHash('wrong-password', hash);
    expect(isMatch).toBe(false);
  });

  test('deve gerar hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const hash1 = await generateHash(plainPassword);
    const hash2 = await generateHash(plainPassword);
    expect(hash1).not.toBe(hash2);
  });
});
