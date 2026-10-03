const bcrypt = require("bcrypt");

/**
 * Provedor para operações de hash de dados (ex: senhas).
 * Encapsula o uso da biblioteca bcrypt.
 * SEGURANÇA: 12 rounds — mais resistente a ataques de força bruta em hardware moderno (2026).
 * Impacto no usuário: ~250ms por hash — imperceptível na prática.
 */
async function generateHash(payload) {
  return bcrypt.hash(payload, 12);
}

async function compareHash(payload, hashed) {
  return bcrypt.compare(payload, hashed);
}

module.exports = {
  generateHash,
  compareHash,
};
