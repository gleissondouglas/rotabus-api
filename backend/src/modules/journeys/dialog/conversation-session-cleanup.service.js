const repository = require("./conversation-session.repository");

/**
 * Executa a limpeza de sessões conversacionais expiradas no banco de dados.
 * 
 * @returns {Promise<Object>} Resultado da limpeza contendo sucesso e quantidade de sessões removidas.
 */
async function cleanupExpiredSessions() {
  try {
    const deletedCount = await repository.deleteExpiredSessions();
    return {
      success: true,
      deletedCount,
    };
  } catch (error) {
    console.error("[SessionCleanupService] Erro ao limpar sessões expiradas:", error.message);
    return {
      success: false,
      deletedCount: 0,
      error: error.message,
    };
  }
}

module.exports = {
  cleanupExpiredSessions,
};
