import {
  isLikelyNoiseTranscript,
  normalizeVoiceTranscript,
  parseVoiceIntent,
} from "./voiceIntentParser";

describe("voiceIntentParser", () => {
  describe("normalizeVoiceTranscript", () => {
    it("normaliza letras, acentos, pontuação e espaços", () => {
      expect(normalizeVoiceTranscript("  É   esse mesmo?! ")).toBe("e esse mesmo");
      expect(normalizeVoiceTranscript("Opção   três.")).toBe("opcao tres");
      expect(normalizeVoiceTranscript("NÃO ENTENDI")).toBe("nao entendi");
    });
  });

  describe("parseVoiceIntent", () => {
    it("mapeia confirmações com e sem acento", () => {
      expect(parseVoiceIntent("sim")).toEqual({ type: "CONFIRM", transcript: "sim" });
      expect(parseVoiceIntent("Isso.")).toEqual({ type: "CONFIRM", transcript: "isso" });
      expect(parseVoiceIntent("correto")).toEqual({ type: "CONFIRM", transcript: "correto" });
      expect(parseVoiceIntent("pode ser")).toEqual({ type: "CONFIRM", transcript: "pode ser" });
      expect(parseVoiceIntent("é esse")).toEqual({ type: "CONFIRM", transcript: "e esse" });
      expect(parseVoiceIntent("esse mesmo")).toEqual({ type: "CONFIRM", transcript: "esse mesmo" });
      expect(parseVoiceIntent("vamos")).toEqual({ type: "CONFIRM", transcript: "vamos" });
      expect(parseVoiceIntent("bora")).toEqual({ type: "CONFIRM", transcript: "bora" });
    });

    it("mapeia comando de iniciar navegação", () => {
      expect(parseVoiceIntent("iniciar")).toEqual({ type: "START_NAVIGATION", transcript: "iniciar" });
      expect(parseVoiceIntent("iniciar navegação")).toEqual({ type: "START_NAVIGATION", transcript: "iniciar navegacao" });
      expect(parseVoiceIntent("começar")).toEqual({ type: "START_NAVIGATION", transcript: "comecar" });
    });

    it("mapeia comando de mostrar detalhes", () => {
      expect(parseVoiceIntent("ver detalhes")).toEqual({ type: "SHOW_DETAILS", transcript: "ver detalhes" });
      expect(parseVoiceIntent("mostrar detalhes")).toEqual({ type: "SHOW_DETAILS", transcript: "mostrar detalhes" });
      expect(parseVoiceIntent("detalhes da rota")).toEqual({ type: "SHOW_DETAILS", transcript: "detalhes da rota" });
    });

    it("mapeia comando de ocultar detalhes", () => {
      expect(parseVoiceIntent("ocultar detalhes")).toEqual({ type: "HIDE_DETAILS", transcript: "ocultar detalhes" });
      expect(parseVoiceIntent("fechar detalhes")).toEqual({ type: "HIDE_DETAILS", transcript: "fechar detalhes" });
      expect(parseVoiceIntent("esconder detalhes")).toEqual({ type: "HIDE_DETAILS", transcript: "esconder detalhes" });
    });

    it("mapeia rejeições para cancelar e perguntar destino novamente", () => {
      expect(parseVoiceIntent("não")).toEqual({
        type: "CANCEL_THEN_ASK_DESTINATION",
        transcript: "nao",
      });
      expect(parseVoiceIntent("nao")).toEqual({
        type: "CANCEL_THEN_ASK_DESTINATION",
        transcript: "nao",
      });
      expect(parseVoiceIntent("errado")).toEqual({
        type: "CANCEL_THEN_ASK_DESTINATION",
        transcript: "errado",
      });
      expect(parseVoiceIntent("outro destino")).toEqual({
        type: "CANCEL_THEN_ASK_DESTINATION",
        transcript: "outro destino",
      });
      expect(parseVoiceIntent("mudar")).toEqual({
        type: "CANCEL_THEN_ASK_DESTINATION",
        transcript: "mudar",
      });
      expect(parseVoiceIntent("nenhuma")).toEqual({
        type: "CANCEL_THEN_ASK_DESTINATION",
        transcript: "nenhuma",
      });
      expect(parseVoiceIntent("nenhum")).toEqual({
        type: "CANCEL_THEN_ASK_DESTINATION",
        transcript: "nenhum",
      });
    });

    it("mapeia repetição", () => {
      expect(parseVoiceIntent("repetir")).toEqual({ type: "REPEAT", transcript: "repetir" });
      expect(parseVoiceIntent("fala de novo")).toEqual({ type: "REPEAT", transcript: "fala de novo" });
      expect(parseVoiceIntent("não entendi")).toEqual({ type: "REPEAT", transcript: "nao entendi" });
      expect(parseVoiceIntent("nao entendi")).toEqual({ type: "REPEAT", transcript: "nao entendi" });
    });

    it("mapeia seleção da primeira opção", () => {
      expect(parseVoiceIntent("primeira")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 0,
        transcript: "primeira",
      });
      expect(parseVoiceIntent("opção um")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 0,
        transcript: "opcao um",
      });
      expect(parseVoiceIntent("número um")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 0,
        transcript: "numero um",
      });
    });

    it("mapeia seleção da segunda opção", () => {
      expect(parseVoiceIntent("segunda")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 1,
        transcript: "segunda",
      });
      expect(parseVoiceIntent("opcao dois")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 1,
        transcript: "opcao dois",
      });
      expect(parseVoiceIntent("numero dois")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 1,
        transcript: "numero dois",
      });
    });

    it("mapeia seleção da terceira opção", () => {
      expect(parseVoiceIntent("terceira")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 2,
        transcript: "terceira",
      });
      expect(parseVoiceIntent("opção três")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 2,
        transcript: "opcao tres",
      });
      expect(parseVoiceIntent("número três")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 2,
        transcript: "numero tres",
      });
    });

    it("mapeia seleção por número acima da terceira opção", () => {
      expect(parseVoiceIntent("quarta")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 3,
        transcript: "quarta",
      });
      expect(parseVoiceIntent("opção quatro")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 3,
        transcript: "opcao quatro",
      });
      expect(parseVoiceIntent("número 4")).toEqual({
        type: "SELECT_OPTION",
        optionIndex: 3,
        transcript: "numero 4",
      });
    });

    it("mapeia cancelamento global", () => {
      expect(parseVoiceIntent("cancelar")).toEqual({ type: "CANCEL", transcript: "cancelar" });
      expect(parseVoiceIntent("voltar ao início")).toEqual({
        type: "CANCEL",
        transcript: "voltar ao inicio",
      });
    });

    it("mapeia texto livre útil como destino", () => {
      expect(parseVoiceIntent("Centro")).toEqual({
        type: "DESTINATION_TEXT",
        text: "centro",
        transcript: "centro",
      });
      expect(parseVoiceIntent("Praça Rui Barbosa")).toEqual({
        type: "DESTINATION_TEXT",
        text: "praca rui barbosa",
        transcript: "praca rui barbosa",
      });
    });

    it("mapeia entrada vazia", () => {
      expect(parseVoiceIntent("")).toEqual({ type: "EMPTY", transcript: "" });
      expect(parseVoiceIntent("   ...   ")).toEqual({ type: "EMPTY", transcript: "" });
    });

    it("não trata ruído curto como destino", () => {
      expect(parseVoiceIntent("ah")).toEqual({ type: "UNCLEAR", transcript: "ah" });
      expect(parseVoiceIntent("1")).toEqual({ type: "UNCLEAR", transcript: "1" });
      expect(parseVoiceIntent("hm")).toEqual({ type: "UNCLEAR", transcript: "hm" });
      expect(parseVoiceIntent("Centro")).toEqual({
        type: "DESTINATION_TEXT",
        text: "centro",
        transcript: "centro",
      });
    });
  });

  describe("isLikelyNoiseTranscript", () => {
    it("aceita destino curto conhecido e rejeita ruído mínimo", () => {
      expect(isLikelyNoiseTranscript("Centro")).toBe(false);
      expect(isLikelyNoiseTranscript("UFTM")).toBe(false);
      expect(isLikelyNoiseTranscript("ah")).toBe(true);
      expect(isLikelyNoiseTranscript("o")).toBe(true);
    });
  });
});
