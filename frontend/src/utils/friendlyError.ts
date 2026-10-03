/**
 * Utilitário para humanização e sanitização de mensagens de erro.
 * Garante que termos técnicos (ex: banco de dados, Prisma, códigos HTTP, stacks)
 * NUNCA sejam exibidos ao usuário final, priorizando idosos e pessoas com baixa literacia digital.
 */

const TECHNICAL_ERROR_PATTERNS = [
  /prisma/i,
  /database/i,
  /sessionstate/i,
  /sql/i,
  /syntaxerror/i,
  /42704/i,
  /22p02/i,
  /p1001/i,
  /p1010/i,
  /p3018/i,
  /network\s*error/i,
  /failed\s*with\s*status\s*code\s*500/i,
  /econnrefused/i,
  /etimedout/i,
  /enotfound/i,
  /type\s*"public\./i,
  /cannot\s*read\s*properties/i,
  /null\s*is\s*not\s*an\s*object/i,
  /undefined\s*is\s*not\s*an\s*object/i,
  /column/i,
  /table/i,
  /relation/i,
];

export function getFriendlyErrorMessage(error: unknown): string {
  if (!error) {
    return "Não foi possível concluir a ação no momento. Por favor, tente novamente.";
  }

  // Extrai texto bruto da mensagem
  let rawMessage = "";
  if (typeof error === "string") {
    rawMessage = error;
  } else if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, any>;
    rawMessage =
      errObj.response?.data?.message ||
      errObj.response?.data?.error ||
      errObj.message ||
      "";
  }

  const trimmed = rawMessage.trim();
  if (!trimmed) {
    return "Tivemos uma instabilidade temporária na conexão. Por favor, tente novamente.";
  }

  // Verifica se é limite de requisições (429)
  if (
    trimmed.toLowerCase().includes("muitas requisições") ||
    trimmed.includes("429") ||
    trimmed.toLowerCase().includes("limite diário")
  ) {
    return "Muitas buscas seguidas. Por favor, aguarde alguns instantes e tente novamente.";
  }

  // Verifica se é falha de microfone / permissão
  if (
    trimmed.toLowerCase().includes("microfone") ||
    trimmed.toLowerCase().includes("permission-denied") ||
    trimmed.toLowerCase().includes("permissão")
  ) {
    return "Não conseguimos acessar seu microfone. Você pode digitar o destino ou tentar novamente.";
  }

  // Detecta se contém qualquer padrão técnico impeditivo
  const hasTechnicalTerms = TECHNICAL_ERROR_PATTERNS.some((pattern) =>
    pattern.test(trimmed),
  );

  if (hasTechnicalTerms) {
    return "Tivemos uma instabilidade momentânea com nossos servidores. Por favor, tente novamente em instantes.";
  }

  // Se a mensagem for limpa e amigável (ex: "Não encontrei esse lugar..."), preserva
  return trimmed;
}
