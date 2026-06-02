export function getFriendlyErrorMessage(error: any): string {
  if (!error) {
    return "Algo deu errado. Tente novamente.";
  }

  const message = error.message || "";

  // Erros de rede
  if (
    message.includes("Network request failed") ||
    message.includes("network") ||
    message.includes("fetch")
  ) {
    return "Não consegui conectar ao servidor. Verifique sua internet e tente novamente.";
  }

  // Erros específicos de negócio (se existirem mensagens padronizadas)
  if (message.includes("destino vazio") || message.includes("empty destination")) {
    return "Digite um destino para continuar.";
  }

  if (message.includes("rota não encontrada") || message.includes("no route found")) {
    return "Não encontrei uma rota para esse destino.";
  }

  // Fallback genérico humano
  return "Ocorreu um imprevisto ao processar sua solicitação. Por favor, tente novamente em alguns instantes.";
}
