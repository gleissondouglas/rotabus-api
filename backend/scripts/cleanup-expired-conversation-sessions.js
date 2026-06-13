const prisma = require("../src/config/prisma");
const { cleanupExpiredSessions } = require("../src/modules/journeys/dialog/conversation-session-cleanup.service");

async function main() {
  console.log("[CleanupScript] Iniciando limpeza de sessões expiradas...");
  const result = await cleanupExpiredSessions();
  
  if (result.success) {
    console.log(`[CleanupScript] Sucesso! Foram removidas ${result.deletedCount} sessões expiradas.`);
  } else {
    console.error("[CleanupScript] Falha na limpeza das sessões expiradas:", result.error);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("[CleanupScript] Erro fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
      console.log("[CleanupScript] Conexão com o banco finalizada.");
    } catch (disconnectError) {
      console.error("[CleanupScript] Erro ao desconectar do banco de dados:", disconnectError.message);
    }
  });
