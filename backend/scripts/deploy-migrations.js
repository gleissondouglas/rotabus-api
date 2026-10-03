const { execSync } = require("child_process");

console.log("[DeployMigrations] Iniciando processo de migração do banco de dados...");

// 1. Tenta marcar a migração anterior falhada como rolled-back se estiver em estado failed
try {
  console.log("[DeployMigrations] Verificando se existe migração anterior em estado failed...");
  execSync("npx prisma migrate resolve --rolled-back 20261003134139_add_enums_and_varchar_limits", {
    stdio: "inherit",
  });
  console.log("[DeployMigrations] Migração falhada anterior resolvida com sucesso.");
} catch (err) {
  console.log("[DeployMigrations] Nenhuma migração falhada pendente de rollback.");
}

// 2. Executa a migração nova
console.log("[DeployMigrations] Aplicando migrações pendentes...");
execSync("npx prisma migrate deploy", { stdio: "inherit" });
console.log("[DeployMigrations] Migrações concluídas com sucesso!");
