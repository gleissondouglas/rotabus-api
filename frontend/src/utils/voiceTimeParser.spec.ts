import { parseVoiceTimeIntent } from "./voiceTimeParser";

describe("voiceTimeParser", () => {
  const mockDate = new Date(2026, 5, 14, 10, 0, 0); // Domingo, 14 de Junho de 2026

  it("deve interpretar 'agora' como NOW", () => {
    expect(parseVoiceTimeIntent("agora")).toEqual({ type: "NOW" });
    expect(parseVoiceTimeIntent("sair agora")).toEqual({ type: "NOW" });
    expect(parseVoiceTimeIntent("pode ser agora")).toEqual({ type: "NOW" });
  });

  it("deve interpretar 'repetir' como REPEAT", () => {
    expect(parseVoiceTimeIntent("repetir")).toEqual({ type: "REPEAT" });
    expect(parseVoiceTimeIntent("fala de novo")).toEqual({ type: "REPEAT" });
  });

  it("deve interpretar 'cancelar' ou 'voltar' como CANCEL", () => {
    expect(parseVoiceTimeIntent("cancelar")).toEqual({ type: "CANCEL" });
    expect(parseVoiceTimeIntent("voltar")).toEqual({ type: "CANCEL" });
  });

  it("deve interpretar 'hoje às oito' como hoje 08:00", () => {
    expect(parseVoiceTimeIntent("hoje às oito", mockDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-14",
      time: "08:00"
    });
  });

  it("deve interpretar 'hoje às 08:30' como hoje 08:30", () => {
    expect(parseVoiceTimeIntent("hoje às 08:30", mockDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-14",
      time: "08:30"
    });
  });

  it("deve interpretar 'amanhã às nove' como amanhã 09:00", () => {
    expect(parseVoiceTimeIntent("amanhã às nove", mockDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "09:00"
    });
  });

  it("deve interpretar 'amanhã às 09:15' como amanhã 09:15", () => {
    expect(parseVoiceTimeIntent("amanhã às 09:15", mockDate)).toEqual({
      type: "DEPARTURE_TIME",
      date: "2026-06-15",
      time: "09:15"
    });
  });

  it("deve interpretar 'chegar às oito' como ARRIVAL_TIME", () => {
    expect(parseVoiceTimeIntent("chegar às oito", mockDate)).toEqual({
      type: "ARRIVAL_TIME",
      date: "2026-06-14",
      time: "08:00"
    });
  });

  it("deve retornar UNKNOWN para textos inválidos", () => {
    expect(parseVoiceTimeIntent("qualquer coisa")).toEqual({ type: "UNKNOWN" });
    expect(parseVoiceTimeIntent("hoje às trinta horas")).toEqual({ type: "UNKNOWN" });
  });
});
