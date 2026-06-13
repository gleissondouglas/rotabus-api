const prisma = require("../src/config/prisma");
const sessionManager = require("../src/modules/journeys/dialog/session.manager");
const crypto = require("crypto");

async function runSmokeTest() {
  console.log("[SmokeTest] Iniciando teste de fumaça da persistência PostgreSQL...");

  // Garante que o driver Postgres está ativo para o teste
  process.env.PERSISTENCE_DRIVER = "postgres";

  const testSessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
  const testUserId = 99999; // ID arbitrário de teste

  try {
    // 1. Criar Sessão
    console.log(`[SmokeTest] 1. Criando sessão testSessionId: ${testSessionId} para userId: ${testUserId}`);
    const createdSession = await sessionManager.createSession({
      userId: testUserId,
      initialState: "WAITING_CONFIRMATION",
      metadata: { source: "smoke-test", originName: "Ponto A" },
      sessionId: testSessionId,
    });

    if (!createdSession || createdSession.sessionId !== testSessionId) {
      throw new Error("Falha ao criar sessão conversacional no banco.");
    }
    console.log("[SmokeTest] Sessão criada com sucesso no banco PostgreSQL!");

    // 2. Buscar Sessão Ativa
    console.log(`[SmokeTest] 2. Buscando sessão testSessionId: ${testSessionId}`);
    const retrievedSession = await sessionManager.getSession({
      userId: testUserId,
      sessionId: testSessionId,
    });

    if (!retrievedSession || retrievedSession.currentState !== "WAITING_CONFIRMATION") {
      throw new Error("Falha ao buscar sessão conversacional ativa.");
    }
    console.log("[SmokeTest] Sessão ativa recuperada e Sliding TTL estendido!");

    // 3. Atualizar Sessão
    console.log(`[SmokeTest] 3. Atualizando estado da sessão testSessionId: ${testSessionId}`);
    const updatedSession = await sessionManager.updateSession({
      userId: testUserId,
      sessionId: testSessionId,
      patch: {
        currentState: "JOURNEY_DISPLAYED",
        metadata: { ...retrievedSession.metadata, updatedBy: "smoke-test" },
      },
    });

    if (!updatedSession || updatedSession.currentState !== "JOURNEY_DISPLAYED" || updatedSession.metadata.updatedBy !== "smoke-test") {
      throw new Error("Falha ao atualizar metadados da sessão conversacional.");
    }
    console.log("[SmokeTest] Sessão atualizada e FSM transicionada com sucesso!");

    // 4. Deletar Sessão (Simulação de CANCEL)
    console.log(`[SmokeTest] 4. Removendo a sessão testSessionId: ${testSessionId}`);
    const deleted = await sessionManager.deleteSession({
      userId: testUserId,
      sessionId: testSessionId,
    });

    if (!deleted) {
      throw new Error("Falha ao deletar a sessão conversacional do banco.");
    }
    console.log("[SmokeTest] Sessão removida com sucesso!");

    // 5. Validar que não existe mais
    const nonExistent = await sessionManager.getSession({
      userId: testUserId,
      sessionId: testSessionId,
    });
    if (nonExistent) {
      throw new Error("Sessão ainda pôde ser recuperada após deleção.");
    }
    console.log("[SmokeTest] Validação de deleção concluída!");

    console.log("\n[SmokeTest] ★★★ TESTE DE FUMAÇA CONCLUÍDO COM 100% DE SUCESSO NO POSTGRESQL ★★★");
  } catch (error) {
    console.error("\n[SmokeTest] ❌ FALHA NO TESTE DE FUMAÇA:", error.message);
    process.exitCode = 1;
  }
}

runSmokeTest()
  .finally(async () => {
    try {
      await prisma.$disconnect();
      console.log("[SmokeTest] Conexão com o banco finalizada.");
    } catch (disconnectError) {
      console.error("[SmokeTest] Erro ao desconectar do banco:", disconnectError.message);
    }
  });
