import { getFriendlyErrorMessage } from "../utils/friendlyError";

describe("Friendly Error Utility", () => {
  test("deve converter erros técnicos do Prisma e SQL em mensagem acolhedora", () => {
    const prismaError =
      "Invalid `prisma.conversationSession.create()` invocation: type 'public.SessionState' does not exist";
    const result = getFriendlyErrorMessage(prismaError);
    expect(result).toBe(
      "Tivemos uma instabilidade momentânea com nossos servidores. Por favor, tente novamente em instantes.",
    );
  });

  test("deve tratar erros de conexão de rede genéricos", () => {
    const networkError = new Error("Network Error");
    const result = getFriendlyErrorMessage(networkError);
    expect(result).toBe(
      "Tivemos uma instabilidade momentânea com nossos servidores. Por favor, tente novamente em instantes.",
    );
  });

  test("deve identificar limite diário ou 429 de requisições", () => {
    const rateLimitError = {
      response: {
        data: {
          message: "Muitas requisições seguidas. Tente novamente mais tarde.",
        },
      },
    };
    const result = getFriendlyErrorMessage(rateLimitError);
    expect(result).toBe(
      "Muitas buscas seguidas. Por favor, aguarde alguns instantes e tente novamente.",
    );
  });

  test("deve identificar falhas de permissão de microfone", () => {
    const micError = new Error("permission-denied microfone");
    const result = getFriendlyErrorMessage(micError);
    expect(result).toBe(
      "Não conseguimos acessar seu microfone. Você pode digitar o destino ou tentar novamente.",
    );
  });

  test("deve preservar mensagens já limpas e de negócio", () => {
    const cleanMessage = "Não encontrei esse lugar. Tente falar de forma diferente.";
    const result = getFriendlyErrorMessage(cleanMessage);
    expect(result).toBe(cleanMessage);
  });

  test("deve retornar mensagem padrão para valores nulos ou vazios", () => {
    expect(getFriendlyErrorMessage(null)).toBe(
      "Não foi possível concluir a ação no momento. Por favor, tente novamente.",
    );
    expect(getFriendlyErrorMessage("   ")).toBe(
      "Tivemos uma instabilidade temporária na conexão. Por favor, tente novamente.",
    );
  });
});
