const {
  cleanDestinationText,
  applyLocalAliases,
  guessQueryType,
  checkIfGenericCity,
  shouldShowOptionsForKnownTerm,
  evaluateConfidence,
} = require("../../../../src/modules/journeys/local-intelligence/local-intelligence.service");

describe("LocalIntelligence Service", () => {
  describe("cleanDestinationText", () => {
    test("deve remover prefixos comuns de fala", () => {
      expect(cleanDestinationText("me leva para o shopping")).toBe("shopping");
      expect(cleanDestinationText("quero ir para a praca")).toBe("praca");
      expect(cleanDestinationText("ir até UPA")).toBe("upa");
    });

    test("deve remover pontuação final", () => {
      expect(cleanDestinationText("shopping uberaba.")).toBe("shopping uberaba");
      expect(cleanDestinationText("rodoviaria!")).toBe("rodoviaria");
    });

    test("deve retornar vazio se não houver texto", () => {
      expect(cleanDestinationText("")).toBe("");
      expect(cleanDestinationText(null)).toBe("");
    });
  });

  describe("applyLocalAliases", () => {
    test("deve mapear aliases locais de Uberaba", () => {
      expect(applyLocalAliases("shopping uberaba")).toBe("Shopping Uberaba, Uberaba - MG");
      expect(applyLocalAliases("centro")).toBe("Praça Rui Barbosa, Uberaba - MG");
      expect(applyLocalAliases("Desconhecido")).toBe("Desconhecido");
    });
  });

  describe("guessQueryType", () => {
    test("deve classificar categoria genérica", () => {
      expect(guessQueryType("hospital")).toBe("generic_category");
      expect(guessQueryType("supermercado")).toBe("generic_category");
    });

    test("deve classificar endereço", () => {
      expect(guessQueryType("Rua Leopoldino de Oliveira, 100")).toBe("address");
      expect(guessQueryType("Avenida Santos Dumont")).toBe("address");
    });

    test("deve classificar local específico", () => {
      expect(guessQueryType("Shopping Uberaba")).toBe("specific_place");
      expect(guessQueryType("UPA do Mirante")).toBe("specific_place");
    });
  });

  describe("checkIfGenericCity", () => {
    test("deve validar se o nome do resultado se refere à cidade genericamente", () => {
      expect(checkIfGenericCity("Uberaba")).toBe(true);
      expect(checkIfGenericCity("Uberaba, MG")).toBe(true);
      expect(checkIfGenericCity("Shopping Uberaba")).toBe(false);
    });
  });

  describe("shouldShowOptionsForKnownTerm", () => {
    test("deve retornar true para termos conhecidos com múltiplos candidatos", () => {
      expect(shouldShowOptionsForKnownTerm("hospital", [{}, {}])).toBe(true);
    });

    test("deve retornar false para termo conhecido com candidato único", () => {
      expect(shouldShowOptionsForKnownTerm("hospital", [{}])).toBe(false);
    });
  });

  describe("evaluateConfidence", () => {
    test("deve retornar low para categoria genérica", () => {
      expect(evaluateConfidence("hospital", { name: "Hospital Mário Palmério" }, "generic_category")).toBe("low");
    });

    test("deve retornar high quando houver correspondência de palavra chave", () => {
      expect(evaluateConfidence("shopping uberaba", { name: "Shopping Center Uberaba" }, "specific_place")).toBe("high");
    });
  });
});
