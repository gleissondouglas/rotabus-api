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

  test("debug timezone", () => {
    const date = new Date("2026-06-13T14:30:00Z");
    const formatted = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    console.log("FORMATTED DEBUG:", formatted);
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
});
