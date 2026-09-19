const {
  getShortStopName,
  getSecondsFromDuration,
  stripHtmlTags,
} = require("../../../../src/modules/journeys/utils/mapper-helpers");

describe("mapper-helpers", () => {
  describe("getShortStopName", () => {
    test("deve retornar o nome antes da vírgula", () => {
      expect(getShortStopName("Ponto A, Centro")).toBe("Ponto A");
    });
    test("deve retornar o nome completo se não houver vírgula", () => {
      expect(getShortStopName("Ponto A")).toBe("Ponto A");
    });
    test("deve retornar 'ponto não identificado' se nulo", () => {
      expect(getShortStopName(null)).toBe("ponto não identificado");
    });
  });

  describe("getSecondsFromDuration", () => {
    test("deve retornar 0 se vazio", () => {
      expect(getSecondsFromDuration(null)).toBe(0);
      expect(getSecondsFromDuration("")).toBe(0);
    });
    test("deve retornar o valor em segundos sem o s", () => {
      expect(getSecondsFromDuration("120s")).toBe(120);
      expect(getSecondsFromDuration("300s")).toBe(300);
    });
    test("deve retornar 0 se parse falhar", () => {
      expect(getSecondsFromDuration("asds")).toBe(0);
    });
    test("deve aceitar números", () => {
      expect(getSecondsFromDuration(120)).toBe(120);
    });
  });

  describe("stripHtmlTags", () => {
    test("deve remover tags", () => {
      expect(stripHtmlTags("<b>teste</b>")).toBe("teste");
    });
    test("deve retornar vazio se nulo", () => {
      expect(stripHtmlTags(null)).toBe("");
    });
  });
});
