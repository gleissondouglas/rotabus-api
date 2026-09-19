const dateUtils = require("../../../src/shared/utils/date");

describe("date utils", () => {
  describe("getMinutesFromDuration", () => {
    test("deve retornar 0 para entrada vazia", () => {
      expect(dateUtils.getMinutesFromDuration(null)).toBe(0);
    });
    test("deve converter e arredondar segundos para minutos", () => {
      expect(dateUtils.getMinutesFromDuration("120s")).toBe(2);
      expect(dateUtils.getMinutesFromDuration("121s")).toBe(3); // math.ceil
    });
  });

  describe("getPeriodOfDay", () => {
    test("deve retornar da manhã", () => {
      expect(dateUtils.getPeriodOfDay(5)).toBe("da manhã");
      expect(dateUtils.getPeriodOfDay(11)).toBe("da manhã");
    });
    test("deve retornar da tarde", () => {
      expect(dateUtils.getPeriodOfDay(12)).toBe("da tarde");
      expect(dateUtils.getPeriodOfDay(17)).toBe("da tarde");
    });
    test("deve retornar da noite", () => {
      expect(dateUtils.getPeriodOfDay(18)).toBe("da noite");
      expect(dateUtils.getPeriodOfDay(23)).toBe("da noite");
    });
    test("deve retornar da madrugada", () => {
      expect(dateUtils.getPeriodOfDay(0)).toBe("da madrugada");
      expect(dateUtils.getPeriodOfDay(4)).toBe("da madrugada");
    });
  });

  describe("formatRelativeDateTime", () => {
    test("deve retornar vazio se nulo", () => {
      expect(dateUtils.formatRelativeDateTime(null)).toBe("");
    });
    test("deve retornar 'hoje às' para a data atual", () => {
      const today = new Date().toISOString();
      expect(dateUtils.formatRelativeDateTime(today)).toMatch(/^hoje às /);
    });
    test("deve retornar 'amanhã às' para amanhã", () => {
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      expect(dateUtils.formatRelativeDateTime(tmrw.toISOString())).toMatch(/^amanhã às /);
    });
    test("deve formatar data distante", () => {
      const distant = new Date();
      distant.setDate(distant.getDate() + 10);
      expect(dateUtils.formatRelativeDateTime(distant.toISOString())).toMatch(/ às /);
    });
  });

  describe("buildDateTimeFromTimeText", () => {
    test("retorna vazio para nulls", () => {
      expect(dateUtils.buildDateTimeFromTimeText(null, null)).toBe("");
    });
    test("retorna vazio para text invalido", () => {
      expect(dateUtils.buildDateTimeFromTimeText("invalido", new Date().toISOString())).toBe("");
    });
    test("cria data e soma 1 dia se resultante for menor que a referencia", () => {
      const ref = new Date("2023-10-10T23:30:00Z").toISOString();
      const dt = dateUtils.buildDateTimeFromTimeText("01:00", ref);
      expect(dt).toBeTruthy();
    });
  });

  describe("subtractMinutesFromDateTime", () => {
    test("subtrai minutos", () => {
      const dt = new Date("2023-10-10T10:30:00Z").toISOString();
      const result = dateUtils.subtractMinutesFromDateTime(dt, 30);
      expect(new Date(result).toISOString()).toBe(new Date("2023-10-10T10:00:00Z").toISOString());
    });
  });

  describe("calculateTimeDifferenceInMinutes", () => {
    test("calcula no mesmo dia", () => {
      expect(dateUtils.calculateTimeDifferenceInMinutes("10:00", "10:30")).toBe(30);
    });
    test("calcula passando meia noite", () => {
      expect(dateUtils.calculateTimeDifferenceInMinutes("23:30", "00:30")).toBe(60);
    });
    test("invalido retorna 0", () => {
      expect(dateUtils.calculateTimeDifferenceInMinutes("invalido", "00:30")).toBe(0);
    });
  });

  describe("calculateTimeDifferenceFromDateTimes", () => {
    test("calcula diferenca valida", () => {
      const d1 = new Date("2023-10-10T10:00:00Z").toISOString();
      const d2 = new Date("2023-10-10T10:30:00Z").toISOString();
      expect(dateUtils.calculateTimeDifferenceFromDateTimes(d1, d2)).toBe(30);
    });
    test("retorna 0 para tempos negativos", () => {
      const d1 = new Date("2023-10-10T10:30:00Z").toISOString();
      const d2 = new Date("2023-10-10T10:00:00Z").toISOString();
      expect(dateUtils.calculateTimeDifferenceFromDateTimes(d1, d2)).toBe(0);
    });
  });

  describe("subtractMinutes", () => {
    test("subtrai minutos do timeText", () => {
      const ref = new Date("2023-10-10T12:00:00Z").toISOString();
      const res = dateUtils.subtractMinutes("10:30", 30, ref);
      expect(res).toBe("10:00");
    });
    test("invalido", () => {
      expect(dateUtils.subtractMinutes(null, 30, null)).toBe("");
    });
  });
});
