import { parseVoiceTimeIntent } from "../utils/voiceTimeParser";

describe("voiceTimeParser", () => {
  const referenceDate = new Date(2026, 5, 15, 10, 0, 0); // Monday June 15 10:00 AM local

  it("should parse NOW intents", () => {
    expect(parseVoiceTimeIntent("agora", referenceDate)).toEqual({ type: "NOW" });
    expect(parseVoiceTimeIntent("quero ir agora", referenceDate)).toEqual({ type: "NOW" });
    expect(parseVoiceTimeIntent("quero sair agora", referenceDate)).toEqual({ type: "NOW" });
  });

  it("should parse explicit hours (DEPARTURE)", () => {
    expect(parseVoiceTimeIntent("quero ir hoje às 4 da tarde", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "16:00"
    });
    expect(parseVoiceTimeIntent("quero ir hoje às 16 horas", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "16:00"
    });
    expect(parseVoiceTimeIntent("quero sair às 15 horas", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "15:00"
    });
    expect(parseVoiceTimeIntent("quero ir às três e meia da tarde", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "15:30"
    });
  });

  it("should parse relative times (DEPARTURE)", () => {
    expect(parseVoiceTimeIntent("quero ir daqui 30 minutos", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "10:30"
    });
    expect(parseVoiceTimeIntent("quero ir daqui uma hora", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "11:00"
    });
  });

  it("should parse tomorrow times (DEPARTURE)", () => {
    expect(parseVoiceTimeIntent("quero ir amanhã nesse mesmo horário", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-16",
      time: "10:00"
    });
    expect(parseVoiceTimeIntent("quero sair amanhã às 7 da manhã", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-16",
      time: "07:00"
    });
  });

  it("should parse weekdays (DEPARTURE)", () => {
    // Thursday = 2026-06-18
    expect(parseVoiceTimeIntent("quero ir quinta-feira três e meia da tarde", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-18",
      time: "15:30"
    });
  });

  it("should parse explicit hours (ARRIVAL)", () => {
    expect(parseVoiceTimeIntent("quero chegar amanhã às 4 da tarde", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-16",
      time: "16:00"
    });
    expect(parseVoiceTimeIntent("quero chegar amanhã às 16 horas", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-16",
      time: "16:00"
    });
    expect(parseVoiceTimeIntent("preciso chegar lá às 8", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-15",
      time: "08:00"
    });
    expect(parseVoiceTimeIntent("quero chegar hoje às 15 horas", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-15",
      time: "15:00"
    });
    // Thursday = 2026-06-18
    expect(parseVoiceTimeIntent("quero chegar quinta-feira três e meia da tarde", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-18",
      time: "15:30"
    });
  });

  it("should parse cases with filler words and complex arrival phrases", () => {
    expect(parseVoiceTimeIntent("quero chegar amanhã às 16 lá nessa escola", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-16",
      time: "16:00"
    });
    expect(parseVoiceTimeIntent("quero chegar lá amanhã às três da tarde", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-16",
      time: "15:00"
    });
    expect(parseVoiceTimeIntent("tenho que estar lá amanhã às quatro da tarde", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-16",
      time: "16:00"
    });
    expect(parseVoiceTimeIntent("preciso chegar nessa escola às 16 horas", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-15",
      time: "16:00"
    });
    expect(parseVoiceTimeIntent("preciso estar lá amanhã às dez", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-16",
      time: "10:00"
    });
  });

  it("should parse departure cases from prompt", () => {
    expect(parseVoiceTimeIntent("quero ir amanhã às 16", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-16",
      time: "16:00"
    });
    expect(parseVoiceTimeIntent("quero sair às três da tarde", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "15:00"
    });
    expect(parseVoiceTimeIntent("quero ir daqui 30 minutos", referenceDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "10:30"
    });
  });

  it("should parse relative times (ARRIVAL)", () => {
    expect(parseVoiceTimeIntent("preciso chegar daqui 1 hora", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-15",
      time: "11:00"
    });
  });

  it("should parse general times like 'de manhã'", () => {
    expect(parseVoiceTimeIntent("quero chegar lá amanhã de manhã", referenceDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-16",
      time: "08:00"
    });
  });
});