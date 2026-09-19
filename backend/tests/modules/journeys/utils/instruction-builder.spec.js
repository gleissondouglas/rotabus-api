const builder = require("../../../../src/modules/journeys/utils/instruction-builder");

describe("instruction-builder", () => {
  describe("humanizeWalkingInstruction", () => {
    test("vazio", () => {
      expect(builder.humanizeWalkingInstruction(null)).toBe("Siga pelo caminho indicado");
    });
    test("simplifica", () => {
      expect(builder.humanizeWalkingInstruction("Siga na direção norte na R. Teste", "TURN_RIGHT")).toBe("Vire à direita");
    });
  });

  describe("buildTransitInstruction", () => {
    test("simula buildFriendlyMessage e buildTransitInstruction", () => {
      const steps = [
        { type: "walk", durationMin: 5, distanceMeters: 500, instruction: "Siga" },
        { type: "transit", line: "123", from: "Ponto A", to: "Ponto B", departureTime: "10:00", arrivalTime: "10:30" }
      ];
      const summary = {
        leaveHomeText: "às 09:55",
        initialWalkTimeMin: 5,
        finalWalkTimeMin: 0,
        referenceDateTime: new Date().toISOString()
      };
      
      const msg = builder.buildFriendlyMessage(steps, summary);
      expect(msg).toContain("Saia de onde você está às 09:55.");
      expect(msg).toContain("Caminhe cerca de 5 minutos");
      expect(msg).toContain("Pegue o ônibus 123");
    });
  });

  describe("buildVoiceBlock", () => {
    test("somente caminhada", () => {
      const steps = [{ type: "walk" }];
      const block = builder.buildVoiceBlock(steps, {}, "Detalhes");
      expect(block.shortMessage).toBe("Você pode ir caminhando até o destino.");
    });
    test("com onibus", () => {
      const steps = [{ type: "transit", line: "123", from: "Ponto A" }];
      const block = builder.buildVoiceBlock(steps, { initialWalkTimeMin: 5, initialWalkDistanceMeters: 500 }, "Detalhes");
      expect(block.firstStopQuestion).toContain("O ponto fica a cerca de 5 minutos");
    });
  });

  describe("buildFirstStopGuideBlock", () => {
    test("sem transit", () => {
      expect(builder.buildFirstStopGuideBlock([{ type: "walk" }], {}).available).toBe(false);
    });
    test("com transit", () => {
      const steps = [
        { type: "walk", instruction: "Siga" },
        { type: "transit", line: "123", from: "Ponto A" }
      ];
      const block = builder.buildFirstStopGuideBlock(steps, { initialWalkTimeMin: 5, initialWalkDistanceMeters: 500 });
      expect(block.available).toBe(true);
      expect(block.walkingSteps.length).toBe(1);
    });
  });

  describe("buildWalkingOnlyScreenBlock", () => {
    test("cria block correto", () => {
      const block = builder.buildWalkingOnlyScreenBlock({ totalDurationMin: 15, totalDistanceMeters: 1000 });
      expect(block.title).toBe("Rota a pé");
    });
  });

  describe("buildWalkingOnlyVoiceBlock", () => {
    test("cria block correto", () => {
      const block = builder.buildWalkingOnlyVoiceBlock([], { totalDurationMin: 15, totalDistanceMeters: 1000 });
      expect(block.shortMessage).toContain("Você pode ir caminhando");
    });
  });
});
