import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isBetween from "dayjs/plugin/isBetween";
import {
  getNow,
  isOperationalTime,
  formatLocalDateTimeWithOffset,
  getTodayDateText,
  getCurrentTimeText,
  buildLocalDateTimeFromInputs,
  getNext7Days,
  formatMinutesToFriendlyText,
  formatBusWaitingTimeToFriendlyText,
  formatBusWaitingTimeToFriendlyTextShort,
} from "../utils/date-time";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

describe("date-time utility", () => {
  const DEFAULT_TIMEZONE = "America/Sao_Paulo";
  // Data de referência determinística: Sábado, 13 de Junho de 2026 às 12:00:00 no fuso de Brasília
  const referenceDateStr = "2026-06-13T12:00:00";
  const refDate = dayjs.tz(referenceDateStr, DEFAULT_TIMEZONE).toDate();

  describe("getNow", () => {
    it("deve retornar data atual no fuso de Brasília", () => {
      const now = getNow();
      expect(now).toBeDefined();
      expect(now.isValid()).toBe(true);
      expect(now.format("YYYY-MM-DD")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("deve converter uma data Date para o fuso de Brasília", () => {
      const date = new Date("2026-06-13T15:00:00Z");
      const result = getNow(date);
      expect(result.isValid()).toBe(true);
      expect(result.toISOString()).toBe(date.toISOString());
    });

    it("deve converter uma data string para o fuso de Brasília", () => {
      const dateStr = "2026-06-13T12:00:00-03:00";
      const result = getNow(dateStr);
      expect(result.isValid()).toBe(true);
      expect(result.format("YYYY-MM-DD HH:mm")).toBe("2026-06-13 12:00");
    });

    it("deve converter um timestamp numérico para o fuso de Brasília", () => {
      const timestamp = 1781352000000;
      const result = getNow(timestamp);
      expect(result.isValid()).toBe(true);
      expect(result.valueOf()).toBe(timestamp);
    });
  });

  describe("isOperationalTime", () => {
    it("deve retornar true para horários de 4h a 23h", () => {
      expect(isOperationalTime(4, 0)).toBe(true);
      expect(isOperationalTime(4, 30)).toBe(true);
      expect(isOperationalTime(12, 0)).toBe(true);
      expect(isOperationalTime(18, 45)).toBe(true);
      expect(isOperationalTime(23, 0)).toBe(true);
      expect(isOperationalTime(23, 59)).toBe(true);
    });

    it("deve retornar false para horários de 0h a 3h", () => {
      expect(isOperationalTime(0, 0)).toBe(false);
      expect(isOperationalTime(1, 30)).toBe(false);
      expect(isOperationalTime(2, 15)).toBe(false);
      expect(isOperationalTime(3, 0)).toBe(false);
      expect(isOperationalTime(3, 59)).toBe(false);
    });

    it("deve retornar false para horários fora da faixa de 24h", () => {
      expect(isOperationalTime(-1, 0)).toBe(false);
      expect(isOperationalTime(24, 0)).toBe(false);
    });
  });

  describe("formatLocalDateTimeWithOffset", () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it("deve retornar string ISO válida", () => {
      const result = formatLocalDateTimeWithOffset(refDate);
      expect(typeof result).toBe("string");
      expect(dayjs(result).isValid()).toBe(true);
      expect(result).toBe(refDate.toISOString());
    });

    it("deve retornar string ISO válida quando chamada sem argumentos", () => {
      const result = formatLocalDateTimeWithOffset();
      expect(typeof result).toBe("string");
      expect(dayjs(result).isValid()).toBe(true);
    });

    it("deve registrar mensagem de log no console ao formatar a data", () => {
      const result = formatLocalDateTimeWithOffset(refDate);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[DateTime] Formatando data para Brasília:",
        result
      );
    });
  });

  describe("getTodayDateText", () => {
    it("deve retornar formato YYYY-MM-DD", () => {
      const todayText = getTodayDateText();
      expect(todayText).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(todayText).toBe(getNow().format("YYYY-MM-DD"));
    });
  });

  describe("getCurrentTimeText", () => {
    it("deve retornar formato HH:mm", () => {
      const timeText = getCurrentTimeText();
      expect(timeText).toMatch(/^\d{2}:\d{2}$/);
      expect(timeText).toBe(getNow().format("HH:mm"));
    });
  });

  describe("buildLocalDateTimeFromInputs", () => {
    it("deve converter data e hora válidas para ISO", () => {
      const iso = buildLocalDateTimeFromInputs("2026-06-13", "14:30");
      expect(iso).toBe(
        dayjs.tz("2026-06-13 14:30", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString()
      );
    });

    it("deve processar corretamente entradas com espaços em branco nas extremidades", () => {
      const iso = buildLocalDateTimeFromInputs("  2026-06-13  ", "  08:15  ");
      expect(iso).toBe(
        dayjs.tz("2026-06-13 08:15", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString()
      );
    });

    it("deve lançar erro se data estiver vazia", () => {
      expect(() => buildLocalDateTimeFromInputs("", "14:30")).toThrow(
        "Informe a data e o horário."
      );
      expect(() => buildLocalDateTimeFromInputs("   ", "14:30")).toThrow(
        "Informe a data e o horário."
      );
    });

    it("deve lançar erro se hora estiver vazia", () => {
      expect(() => buildLocalDateTimeFromInputs("2026-06-13", "")).toThrow(
        "Informe a data e o horário."
      );
      expect(() => buildLocalDateTimeFromInputs("2026-06-13", "   ")).toThrow(
        "Informe a data e o horário."
      );
    });

    it("deve lançar erro se ambos data e hora estiverem vazios", () => {
      expect(() => buildLocalDateTimeFromInputs("", "")).toThrow(
        "Informe a data e o horário."
      );
    });

    it("deve lançar erro para data inválida", () => {
      const spy = jest.spyOn(dayjs, "tz").mockReturnValueOnce({
        isValid: () => false,
      } as any);

      expect(() => buildLocalDateTimeFromInputs("2026-02-30", "14:30")).toThrow(
        "Data ou horário inválido."
      );

      spy.mockRestore();
    });

    it("deve lançar erro quando o parsing da data/horário resultar em data inválida", () => {
      const spy = jest.spyOn(dayjs, "tz").mockReturnValueOnce({
        isValid: () => false,
      } as any);

      expect(() => buildLocalDateTimeFromInputs("invalida", "invalido")).toThrow(
        "Data ou horário inválido."
      );

      spy.mockRestore();
    });
  });

  describe("getNext7Days", () => {
    it("deve retornar 7 opções com labels corretos (Hoje, Amanhã, dia da semana)", () => {
      // 13 de Junho de 2026 é Sábado
      const days = getNext7Days(refDate);
      expect(days).toHaveLength(7);

      expect(days[0]).toEqual({
        dateText: "2026-06-13",
        label: "Hoje",
        dayNum: 13,
      });

      expect(days[1]).toEqual({
        dateText: "2026-06-14",
        label: "Amanhã",
        dayNum: 14,
      });

      expect(days[2]).toEqual({
        dateText: "2026-06-15",
        label: "Seg",
        dayNum: 15,
      });

      expect(days[3]).toEqual({
        dateText: "2026-06-16",
        label: "Ter",
        dayNum: 16,
      });

      expect(days[4]).toEqual({
        dateText: "2026-06-17",
        label: "Qua",
        dayNum: 17,
      });

      expect(days[5]).toEqual({
        dateText: "2026-06-18",
        label: "Qui",
        dayNum: 18,
      });

      expect(days[6]).toEqual({
        dateText: "2026-06-19",
        label: "Sex",
        dayNum: 19,
      });
    });

    it("deve funcionar quando chamado sem argumento de data de referência", () => {
      const days = getNext7Days();
      expect(days).toHaveLength(7);
      expect(days[0].label).toBe("Hoje");
      expect(days[1].label).toBe("Amanhã");
    });
  });

  describe("formatMinutesToFriendlyText", () => {
    it("deve retornar 'Chegando' para 0 ou negativo", () => {
      expect(formatMinutesToFriendlyText(0)).toBe("Chegando");
      expect(formatMinutesToFriendlyText(-1)).toBe("Chegando");
      expect(formatMinutesToFriendlyText(-10)).toBe("Chegando");
    });

    it("deve retornar 'X min' para valores < 60", () => {
      expect(formatMinutesToFriendlyText(1)).toBe("1 min");
      expect(formatMinutesToFriendlyText(15)).toBe("15 min");
      expect(formatMinutesToFriendlyText(45)).toBe("45 min");
      expect(formatMinutesToFriendlyText(59)).toBe("59 min");
    });

    it("deve retornar 'Xh Ymin' para valores >= 60", () => {
      expect(formatMinutesToFriendlyText(65)).toBe("1h 5min");
      expect(formatMinutesToFriendlyText(90)).toBe("1h 30min");
      expect(formatMinutesToFriendlyText(125)).toBe("2h 5min");
      expect(formatMinutesToFriendlyText(150)).toBe("2h 30min");
    });

    it("deve retornar 'Xh' quando minutos são exatos", () => {
      expect(formatMinutesToFriendlyText(60)).toBe("1h");
      expect(formatMinutesToFriendlyText(120)).toBe("2h");
      expect(formatMinutesToFriendlyText(180)).toBe("3h");
    });

    it("deve retornar apenas dias e horas para durações acima de 24h (ocultando minutos)", () => {
      expect(formatMinutesToFriendlyText(1440)).toBe("1 dia");
      expect(formatMinutesToFriendlyText(1500)).toBe("1 dia 1h");
      expect(formatMinutesToFriendlyText(1515)).toBe("1 dia 1h");
      expect(formatMinutesToFriendlyText(2880)).toBe("2 dias");
      expect(formatMinutesToFriendlyText(2945)).toBe("2 dias 1h");
      expect(formatMinutesToFriendlyText(4350)).toBe("3 dias");
    });
  });

  describe("formatBusWaitingTimeToFriendlyText", () => {
    it("deve retornar 'Calculando...' para string vazia", () => {
      expect(formatBusWaitingTimeToFriendlyText("", refDate)).toBe("Calculando...");
    });

    it("deve retornar 'Calculando...' para data inválida", () => {
      expect(formatBusWaitingTimeToFriendlyText("data_invalida", refDate)).toBe("Calculando...");
    });

    it("deve retornar 'Chegando agora' para diff entre -2 e 0", () => {
      const nowTarget = dayjs(refDate).toISOString();
      const oneMinAgo = dayjs(refDate).subtract(1, "minute").toISOString();
      const twoMinAgo = dayjs(refDate).subtract(2, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyText(nowTarget, refDate)).toBe("Chegando agora");
      expect(formatBusWaitingTimeToFriendlyText(oneMinAgo, refDate)).toBe("Chegando agora");
      expect(formatBusWaitingTimeToFriendlyText(twoMinAgo, refDate)).toBe("Chegando agora");
    });

    it("deve retornar 'Horário passou' para diff < -2", () => {
      const threeMinAgo = dayjs(refDate).subtract(3, "minute").toISOString();
      const tenMinAgo = dayjs(refDate).subtract(10, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyText(threeMinAgo, refDate)).toBe("Horário passou");
      expect(formatBusWaitingTimeToFriendlyText(tenMinAgo, refDate)).toBe("Horário passou");
    });

    it("deve retornar 'em X min' para diff < 60", () => {
      const in5Min = dayjs(refDate).add(5, "minute").toISOString();
      const in25Min = dayjs(refDate).add(25, "minute").toISOString();
      const in59Min = dayjs(refDate).add(59, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyText(in5Min, refDate)).toBe("em 5 min");
      expect(formatBusWaitingTimeToFriendlyText(in25Min, refDate)).toBe("em 25 min");
      expect(formatBusWaitingTimeToFriendlyText(in59Min, refDate)).toBe("em 59 min");
    });

    it("deve retornar 'em XhY' para diff entre 60 e 720", () => {
      const in1h15 = dayjs(refDate).add(75, "minute").toISOString();
      const in2h30 = dayjs(refDate).add(150, "minute").toISOString();
      const in11h59 = dayjs(refDate).add(719, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyText(in1h15, refDate)).toBe("em 1h15");
      expect(formatBusWaitingTimeToFriendlyText(in2h30, refDate)).toBe("em 2h30");
      expect(formatBusWaitingTimeToFriendlyText(in11h59, refDate)).toBe("em 11h59");
    });

    it("deve retornar 'em Xh' para diff entre 60 e 720 com horas exatas", () => {
      const in1h = dayjs(refDate).add(60, "minute").toISOString();
      const in3h = dayjs(refDate).add(180, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyText(in1h, refDate)).toBe("em 1h");
      expect(formatBusWaitingTimeToFriendlyText(in3h, refDate)).toBe("em 3h");
    });

    it("deve retornar 'hoje às HH:mm' para diff > 12h mesmo dia", () => {
      const morningRef = dayjs.tz("2026-06-13 06:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toDate();
      const nightTarget = dayjs.tz("2026-06-13 22:30", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();

      expect(formatBusWaitingTimeToFriendlyText(nightTarget, morningRef)).toBe("hoje às 22:30");
    });

    it("deve retornar 'amanhã às HH:mm' para amanhã", () => {
      const tomorrowTarget = dayjs.tz("2026-06-14 15:45", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(tomorrowTarget, refDate)).toBe("amanhã às 15:45");
    });

    it("deve retornar dia da semana para 2-7 dias", () => {
      // refDate: 2026-06-13 (Sábado)
      // +2 dias: Segunda-feira (2026-06-15)
      const monTarget = dayjs.tz("2026-06-15 10:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(monTarget, refDate)).toBe("segunda-feira às 10:00");

      // +3 dias: Terça-feira (2026-06-16)
      const tueTarget = dayjs.tz("2026-06-16 11:15", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(tueTarget, refDate)).toBe("terça-feira às 11:15");

      // +4 dias: Quarta-feira (2026-06-17)
      const wedTarget = dayjs.tz("2026-06-17 14:15", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(wedTarget, refDate)).toBe("quarta-feira às 14:15");

      // +5 dias: Quinta-feira (2026-06-18)
      const thuTarget = dayjs.tz("2026-06-18 09:30", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(thuTarget, refDate)).toBe("quinta-feira às 09:30");

      // +6 dias: Sexta-feira (2026-06-19)
      const friTarget = dayjs.tz("2026-06-19 16:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(friTarget, refDate)).toBe("sexta-feira às 16:00");

      // +7 dias: Sábado seguinte (2026-06-20)
      const satTarget = dayjs.tz("2026-06-20 08:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(satTarget, refDate)).toBe("sábado às 08:00");

      // Domingo como alvo (a partir de Sexta-feira 2026-06-12)
      const friRef = dayjs.tz("2026-06-12 12:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toDate();
      const sunTarget = dayjs.tz("2026-06-14 10:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(sunTarget, friRef)).toBe("domingo às 10:00");
    });

    it("deve retornar 'Escolha outro horário' para > 7 dias", () => {
      // +8 dias (2026-06-21)
      const target8Days = dayjs.tz("2026-06-21 12:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(target8Days, refDate)).toBe("Escolha outro horário");

      // +10 dias (2026-06-23)
      const target10Days = dayjs.tz("2026-06-23 12:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyText(target10Days, refDate)).toBe("Escolha outro horário");
    });
  });

  describe("formatBusWaitingTimeToFriendlyTextShort", () => {
    it("deve retornar 'Calculando...' para string vazia", () => {
      expect(formatBusWaitingTimeToFriendlyTextShort("", refDate)).toBe("Calculando...");
    });

    it("deve retornar 'Calculando...' para data inválida", () => {
      expect(formatBusWaitingTimeToFriendlyTextShort("data_invalida", refDate)).toBe("Calculando...");
    });

    it("deve retornar 'Chegando agora' para diff entre -2 e 0", () => {
      const nowTarget = dayjs(refDate).toISOString();
      const oneMinAgo = dayjs(refDate).subtract(1, "minute").toISOString();
      const twoMinAgo = dayjs(refDate).subtract(2, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyTextShort(nowTarget, refDate)).toBe("Chegando agora");
      expect(formatBusWaitingTimeToFriendlyTextShort(oneMinAgo, refDate)).toBe("Chegando agora");
      expect(formatBusWaitingTimeToFriendlyTextShort(twoMinAgo, refDate)).toBe("Chegando agora");
    });

    it("deve retornar 'Horário passou' para diff < -2", () => {
      const threeMinAgo = dayjs(refDate).subtract(3, "minute").toISOString();
      const tenMinAgo = dayjs(refDate).subtract(10, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyTextShort(threeMinAgo, refDate)).toBe("Horário passou");
      expect(formatBusWaitingTimeToFriendlyTextShort(tenMinAgo, refDate)).toBe("Horário passou");
    });

    it("deve retornar 'em X min' para diff < 60", () => {
      const in10Min = dayjs(refDate).add(10, "minute").toISOString();
      const in25Min = dayjs(refDate).add(25, "minute").toISOString();
      const in59Min = dayjs(refDate).add(59, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyTextShort(in10Min, refDate)).toBe("em 10 min");
      expect(formatBusWaitingTimeToFriendlyTextShort(in25Min, refDate)).toBe("em 25 min");
      expect(formatBusWaitingTimeToFriendlyTextShort(in59Min, refDate)).toBe("em 59 min");
    });

    it("deve retornar 'em XhY' para diff entre 60 e 720", () => {
      const in1h15 = dayjs(refDate).add(75, "minute").toISOString();
      const in2h30 = dayjs(refDate).add(150, "minute").toISOString();
      const in11h59 = dayjs(refDate).add(719, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyTextShort(in1h15, refDate)).toBe("em 1h15");
      expect(formatBusWaitingTimeToFriendlyTextShort(in2h30, refDate)).toBe("em 2h30");
      expect(formatBusWaitingTimeToFriendlyTextShort(in11h59, refDate)).toBe("em 11h59");
    });

    it("deve retornar 'em Xh' para diff entre 60 e 720 com horas exatas", () => {
      const in1h = dayjs(refDate).add(60, "minute").toISOString();
      const in2h = dayjs(refDate).add(120, "minute").toISOString();

      expect(formatBusWaitingTimeToFriendlyTextShort(in1h, refDate)).toBe("em 1h");
      expect(formatBusWaitingTimeToFriendlyTextShort(in2h, refDate)).toBe("em 2h");
    });

    it("deve retornar 'hoje, HH:mm' para diff > 12h mesmo dia", () => {
      const morningRef = dayjs.tz("2026-06-13 08:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toDate();
      const nightTarget = dayjs.tz("2026-06-13 22:30", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();

      expect(formatBusWaitingTimeToFriendlyTextShort(nightTarget, morningRef)).toBe("hoje, 22:30");
    });

    it("deve retornar 'amanhã, HH:mm' para amanhã", () => {
      const tomorrowTarget = dayjs.tz("2026-06-14 15:45", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(tomorrowTarget, refDate)).toBe("amanhã, 15:45");
    });

    it("deve retornar dia da semana curto com vírgula para 2-7 dias", () => {
      // refDate: 2026-06-13 (Sábado)
      // +2 dias: Segunda-feira -> "segunda, 10:00"
      const monTarget = dayjs.tz("2026-06-15 10:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(monTarget, refDate)).toBe("segunda, 10:00");

      // +3 dias: Terça-feira -> "terça, 09:10"
      const tueTarget = dayjs.tz("2026-06-16 09:10", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(tueTarget, refDate)).toBe("terça, 09:10");

      // +4 dias: Quarta-feira -> "quarta, 14:00"
      const wedTarget = dayjs.tz("2026-06-17 14:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(wedTarget, refDate)).toBe("quarta, 14:00");

      // +5 dias: Quinta-feira -> "quinta, 18:20"
      const thuTarget = dayjs.tz("2026-06-18 18:20", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(thuTarget, refDate)).toBe("quinta, 18:20");

      // +6 dias: Sexta-feira -> "sexta, 07:30"
      const friTarget = dayjs.tz("2026-06-19 07:30", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(friTarget, refDate)).toBe("sexta, 07:30");

      // +7 dias: Sábado seguinte -> "sábado, 12:00"
      const satTarget = dayjs.tz("2026-06-20 12:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(satTarget, refDate)).toBe("sábado, 12:00");

      // Domingo como alvo (a partir de Sexta-feira 2026-06-12) -> "domingo, 10:00"
      const friRef = dayjs.tz("2026-06-12 12:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toDate();
      const sunTarget = dayjs.tz("2026-06-14 10:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(sunTarget, friRef)).toBe("domingo, 10:00");
    });

    it("deve retornar 'Outro horário' para > 7 dias", () => {
      // +8 dias (2026-06-21)
      const target8Days = dayjs.tz("2026-06-21 12:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(target8Days, refDate)).toBe("Outro horário");

      // +10 dias (2026-06-23)
      const target10Days = dayjs.tz("2026-06-23 12:00", "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE).toISOString();
      expect(formatBusWaitingTimeToFriendlyTextShort(target10Days, refDate)).toBe("Outro horário");
    });
  });
});
