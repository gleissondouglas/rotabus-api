require("dotenv").config();
const prisma = require("../src/config/prisma");

/**
 * Script para promover um usuário existente ao cargo de ADMIN.
 * Uso: ADMIN_EMAIL=usuario@email.com node scripts/ensureAdmin.js
 */
async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    console.error("❌ ERRO: A variável de ambiente ADMIN_EMAIL não está definida.");
    console.log("Dica: Use 'ADMIN_EMAIL=seu@email.com npm run admin:ensure'");
    process.exit(1);
  }

  console.log(`🔍 Buscando usuário com o e-mail: ${adminEmail}...`);

  try {
    const user = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!user) {
      console.warn("⚠️  AVISO: Usuário não encontrado no banco de dados.");
      console.log("Ação: Crie a conta primeiro pelo App ou API e rode o script novamente.");
      process.exit(1);
    }

    if (user.role === "ADMIN") {
      console.log(`✅ O usuário ${adminEmail} já é um administrador.`);
      process.exit(0);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });

    console.log(`🚀 SUCESSO: O usuário ${adminEmail} foi promovido a ADMIN.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Ocorreu um erro ao atualizar o usuário:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

ensureAdmin();
