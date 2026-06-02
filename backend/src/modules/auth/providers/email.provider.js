async function sendPasswordResetEmail({ to, name, resetLink }) {
  if (process.env.NODE_ENV !== "production") {
    console.log("======================================");
    console.log("SIMULAÇÃO DE EMAIL DE RECUPERAÇÃO");
    console.log("Para:", to);
    console.log("Nome:", name);
    console.log("Link de recuperação:", resetLink);
    console.log("======================================");
  }

  return {
    success: true,
  };
}

module.exports = {
  sendPasswordResetEmail,
};
