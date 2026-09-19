const { toConversationalPlan, toConversationalResolve, toConversationalCommand } = require("../../../src/modules/journeys/conversational.mapper");

describe("conversational.mapper", () => {
  describe("toConversationalPlan", () => {
    test("deve enriquecer corretamente a resposta de planejamento de rota", () => {
      const mockPlan = {
        summary: {
          totalDurationMin: 30,
          busLines: ["10", "12"],
          leaveHomeAt: "11:20",
          beAtStopAt: "11:25",
          arrivalAtDestination: "11:50",
        },
        voice: {
          shortMessage: "Pegue a linha 10 às 11:25.",
        },
        alternatives: [{}],
      };

      const result = toConversationalPlan(mockPlan);

      expect(result.speechText).toBe("Pegue a linha 10 às 11:25.");
      expect(result.expectedInput).toBe("NONE");
      expect(result.conversationState).toBe("JOURNEY_DISPLAYED");
      expect(result.actions).toEqual(["REPEAT", "CANCEL"]);
      expect(result.displayData.title).toBeDefined();
      expect(result.displayData.items).toHaveLength(3);
      // Mantendo o payload legado
      expect(result.summary).toEqual(mockPlan.summary);
      expect(result.voice).toEqual(mockPlan.voice);
    });

    test("deve retornar nulo ou indefinido se a entrada for vazia", () => {
      expect(toConversationalPlan(null)).toBeNull();
      expect(toConversationalPlan(undefined)).toBeUndefined();
    });
  });

  describe("toConversationalResolve", () => {
    test("deve enriquecer corretamente a resposta de resolve-destination com mode 'resolved'", () => {
      const mockResolve = {
        mode: "resolved",
        queryType: "specific_place",
        message: "Destino encontrado.",
        resolvedDestination: { name: "Shopping Uberaba" },
        voice: {
          confirmationQuestion: "Encontrei Shopping Uberaba. É esse o lugar?",
        },
      };

      const result = toConversationalResolve(mockResolve);

      expect(result.speechText).toBe("Encontrei Shopping Uberaba. É esse o lugar?");
      expect(result.expectedInput).toBe("VOICE_OR_TOUCH");
      expect(result.conversationState).toBe("WAITING_CONFIRMATION");
      expect(result.actions).toEqual(["CONFIRM", "CANCEL", "REPEAT"]);
      expect(result.resolvedDestination).toEqual(mockResolve.resolvedDestination);
    });

    test("deve enriquecer corretamente a resposta de resolve-destination com mode 'suggestions'", () => {
      const mockResolve = {
        mode: "suggestions",
        queryType: "generic_category",
        options: [{ name: "Hospital Mário Palmério", address: "Av. Nenê Sabino" }],
        voice: {
          confirmationQuestion: "Qual opção você prefere?",
        },
      };

      const result = toConversationalResolve(mockResolve);

      expect(result.speechText).toBe("Qual opção você prefere?");
      expect(result.expectedInput).toBe("VOICE_OR_TOUCH");
      expect(result.conversationState).toBe("WAITING_DESTINATION_SELECTION");
      expect(result.actions).toEqual(["SELECT_OPTION", "CANCEL"]);
      expect(result.options).toEqual(["Hospital Mário Palmério"]);
    });

    test("modo not_found (sem session)", () => {
      const res = toConversationalResolve({ mode: "not_found" });
      expect(res.conversationState).toBe("WAITING_DESTINATION");
      expect(res.screen).toBe("DESTINATION_RESOLVE");
      expect(res.actions).toEqual(["CANCEL"]);
      expect(res.displayData.title).toBe("Pesquisar destino");
    });
    test("state WAITING_TIME_SELECTION (com session)", () => {
      const res = toConversationalResolve({ mode: "time" }, { currentState: "WAITING_TIME_SELECTION" });
      expect(res.screen).toBe("TIME_SELECTION");
      expect(res.actions).toEqual(["SELECT_TIME", "CANCEL"]);
      expect(res.displayData.title).toBe("Confirmar horário");
    });
    test("candidates branch", () => {
      const resolve = {
        mode: "suggestions",
        candidates: [{ name: "Cand A", address: "Rua A" }]
      };
      const res = toConversationalResolve(resolve, { currentState: "WAITING_DESTINATION_SELECTION" });
      expect(res.options).toEqual(["Cand A"]);
      expect(res.displayData.items).toEqual([{ name: "Cand A", address: "Rua A" }]);
    });
  });

  describe("toConversationalCommand", () => {
    test("retorna nulo", () => {
      expect(toConversationalCommand(null)).toBeNull();
    });
    test("REPEAT com WAITING_DESTINATION_SELECTION", () => {
      const res = toConversationalCommand({ command: "REPEAT", currentState: "WAITING_DESTINATION_SELECTION" });
      expect(res.screen).toBe("SUGGESTIONS_LIST");
      expect(res.actions).toEqual(["SELECT_OPTION", "CANCEL"]);
    });
    test("REPEAT com estado generico", () => {
      const res = toConversationalCommand({ command: "REPEAT", currentState: "IDLE" });
      expect(res.screen).toBe("DESTINATION_RESOLVE");
    });
    test("SELECT_TIME command", () => {
      const res = toConversationalCommand({ command: "SELECT_TIME", currentState: "IDLE" });
      expect(res.screen).toBe("JOURNEY_DISPLAY");
      expect(res.speechText).toBe("Horário confirmado. Exibindo a melhor rota.");
    });
  });
});

