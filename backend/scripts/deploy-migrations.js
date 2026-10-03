const { execSync } = require("child_process");

console.log("[DeployMigrations] Iniciando processo de migração do banco de dados...");

// Lista de migrações anteriores que podem ter ficado em estado failed no banco Neon
const migrationsToRollback = [
  "20261003134139_add_enums_and_varchar_limits",
  "20261003140500_add_enums_and_varchar_limits",
];

for (const migration of migrationsToRollback) {
  try {
    console.log(`[DeployMigrations] Verificando status da migração ${migration}...`);
    execSync(`npx prisma migrate resolve --rolled-back ${migration}`, {
      stdio: "inherit",
    });
    console.log(`[DeployMigrations] Migração ${migration} marcada como rolled-back.`);
  } catch (err) {
    console.log(`[DeployMigrations] Migração ${migration} não estava em estado failed.`);
  }
}

// Executa a migração nova infalível
console.log("[DeployMigrations] Aplicando migração atualizada...");
execSync("npx prisma migrate deploy", { stdio: "inherit" });
console.log("[DeployMigrations] Migrações concluídas com sucesso!");
