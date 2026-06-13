const bcrypt = require("bcrypt");

/**
 * Provedor para operações de hash de dados (ex: senhas).
 * Encapsula o uso da biblioteca bcrypt.
 */
async function generateHash(payload) {
  // Mantendo o padrão de 10 rounds conforme uso atual no sistema
  return bcrypt.hash(payload, 10);
}

async function compareHash(payload, hashed) {
  return bcrypt.compare(payload, hashed);
}

module.exports = {
  generateHash,
  compareHash,
};
