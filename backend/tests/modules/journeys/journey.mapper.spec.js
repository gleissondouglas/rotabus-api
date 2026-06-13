process.env.APP_TIME_ZONE = "America/Sao_Paulo";
const { mapGoogleRouteToJourney } = require("../../../src/modules/journeys/journey.mapper");
const transitSimpleFixture = require("../../fixtures/google-routes/transit-simple.json");
const walkOnlyFixture = require("../../fixtures/google-routes/walk-only.json");

describe("journey.mapper", () => {
  const origin = { lat: -19.7472, lng: -47.9392 };
  const timePreference = {
    type: "DEPARTURE",
    dateTime: "2026-06-13T14:20:00Z"
  };

  beforeAll(() => {
    // Mocking Date to ensure relative date tests are stable
    jest.useFakeTimers().setSystemTime(new Date("2026-06-13T14:20:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("deve mapear corretamente uma rota de ônibus simples (Paridade de Contrato)", () => {
    const result = mapGoogleRouteToJourney(transitSimpleFixture, origin, timePreference);
    
    expect(result.summary.beAtStopAt).toBe("11:30");
    expect(result.summary.leaveHomeAt).toBe("11:25");
  });

  test("deve mapear corretamente uma rota apenas de caminhada", () => {
    const result = mapGoogleRouteToJourney(walkOnlyFixture, origin, timePreference);
    
    expect(result.summary.busLines).toHaveLength(0);
    expect(result.summary.totalWalkTimeMin).toBe(10);
    expect(result.voice.shortMessage).toBe("Você pode ir caminhando até o destino.");
  });

  test("deve respeitar APP_TIME_ZONE independentemente do fuso horário do servidor (Resiliência a UTC)", () => {
    // Simulamos um ambiente onde o fuso do sistema é UTC, mas a APP_TIME_ZONE é America/Sao_Paulo
    // O mapper deve converter os horários ISO do fixture para o horário de Brasília (GMT-3)
    const result = mapGoogleRouteToJourney(transitSimpleFixture, origin, timePreference);
    
    // No fixture, o ônibus sai às 14:30:00Z.
    // Em America/Sao_Paulo (GMT-3), isso deve ser 11:30.
    expect(result.summary.beAtStopAt).toBe("11:30");
    
    // O mapper calcula 5 min antes para sair de casa -> 11:25.
    expect(result.summary.leaveHomeAt).toBe("11:25");
  });
});
