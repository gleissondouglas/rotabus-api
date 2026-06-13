const { toConversationalPlan, toConversationalResolve } = require("../../../src/modules/journeys/conversational.mapper");

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
  });
});
