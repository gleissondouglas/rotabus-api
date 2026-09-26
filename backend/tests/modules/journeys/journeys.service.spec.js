const {
  planJourney,
  reverseGeocodeService,
  transcribeAudioService,
  resolveDestinationService,
} = require("../../../src/modules/journeys/journeys.service");

// Mocks
jest.mock("../../../src/modules/journeys/journeys.validator", () => ({
  validatePlanJourneyInput: jest.fn().mockImplementation((data) => data),
  validateResolveDestinationInput: jest.fn().mockImplementation((data) => data),
}));

jest.mock("../../../src/modules/journeys/providers/routes.provider", () => ({
  computeTransitRoute: jest.fn(),
  computeWalkingRoute: jest.fn(),
}));

jest.mock("../../../src/modules/journeys/journey.mapper", () => ({
  mapGoogleRouteToJourney: jest.fn(),
  mapWalkingOnlyRouteToJourney: jest.fn(),
}));

jest.mock("../../../src/modules/journeys/route-cache", () => ({
  findCachedRoute: jest.fn(),
  createRouteCache: jest.fn(),
}));

jest.mock("../../../src/modules/journeys/providers/geocoding.provider", () => ({
  getAddressFromCoordinates: jest.fn(),
  geocodeAddress: jest.fn(),
}));

jest.mock("../../../src/modules/journeys/providers/speech.provider", () => ({
  transcribe: jest.fn(),
}));

jest.mock("../../../src/modules/journeys/providers/destination.provider", () => ({
  getDestinationContext: jest.fn(),
  searchPlaces: jest.fn(),
}));

jest.mock("../../../src/modules/journeys/local-intelligence/local-intelligence.service", () => ({
  applyLocalAliases: jest.fn().mockImplementation((text) => text),
  guessQueryType: jest.fn().mockReturnValue("specific_place"),
  checkIfGenericCity: jest.fn().mockReturnValue(false),
  evaluateConfidence: jest.fn().mockReturnValue("high"),
  shouldShowOptionsForKnownTerm: jest.fn().mockReturnValue(false),
}));

const routesProvider = require("../../../src/modules/journeys/providers/routes.provider");
const journeyMapper = require("../../../src/modules/journeys/journey.mapper");
const routeCache = require("../../../src/modules/journeys/route-cache");
const geocodingProvider = require("../../../src/modules/journeys/providers/geocoding.provider");
const speechProvider = require("../../../src/modules/journeys/providers/speech.provider");
const destinationProvider = require("../../../src/modules/journeys/providers/destination.provider");
const localIntelligenceService = require("../../../src/modules/journeys/local-intelligence/local-intelligence.service");

describe("Journeys Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("reverseGeocodeService", () => {
    it("deve retornar o endereço correto", async () => {
      geocodingProvider.getAddressFromCoordinates.mockResolvedValue("Rua Teste, 123");
      const result = await reverseGeocodeService({ lat: -10, lng: -20 });
      expect(result).toEqual({ address: "Rua Teste, 123" });
    });

    it("deve lançar erro se lat ou lng faltarem", async () => {
      await expect(reverseGeocodeService({ lat: undefined, lng: -20 })).rejects.toThrow("Latitude e longitude são obrigatórias.");
    });
  });

  describe("transcribeAudioService", () => {
    it("deve retornar o texto transcrito", async () => {
      speechProvider.transcribe.mockResolvedValue("Quero ir para o centro");
      const result = await transcribeAudioService({ audioBase64: "dGVzdGU=", mimeType: "audio/m4a" });
      expect(result).toEqual({ text: "Quero ir para o centro" });
    });

    it("deve lançar erro se o áudio não for enviado", async () => {
      await expect(transcribeAudioService({ audioBase64: "" })).rejects.toThrow("Áudio em base64 é obrigatório.");
    });
  });

  describe("resolveDestinationService", () => {
    it("deve limpar o texto e buscar no places quando specific_place", async () => {
      destinationProvider.searchPlaces.mockResolvedValue([
        {
          name: "Hospital de Teste",
          address: "Rua H, Uberaba",
          lat: 1,
          lng: 1,
          id: "123",
        },
      ]);
      const result = await resolveDestinationService({
        text: "me leva ao hospital",
        origin: { lat: 0, lng: 0 }
      });

      expect(destinationProvider.searchPlaces).toHaveBeenCalledWith(
        "hospital",
        { lat: 0, lng: 0 }
      );
      expect(result.resolvedDestination.name).toBe("Hospital de Teste");
    });

    it("deve usar geocoding quando o queryType for address", async () => {
      localIntelligenceService.guessQueryType.mockReturnValueOnce("address");
      geocodingProvider.geocodeAddress.mockResolvedValue([
        {
          name: "Rua Leopoldino",
          address: "Rua Leopoldino, Uberaba",
          lat: -19.74,
          lng: -47.93,
          isUberaba: true,
        }
      ]);

      const result = await resolveDestinationService({
        text: "Rua Leopoldino de Oliveira",
        origin: { lat: 0, lng: 0 }
      });

      expect(geocodingProvider.geocodeAddress).toHaveBeenCalled();
      expect(result.resolvedDestination.name).toBe("Rua Leopoldino");
    });

    it("deve retornar not_found se nenhum candidato for encontrado", async () => {
      destinationProvider.searchPlaces.mockResolvedValue([]);
      geocodingProvider.geocodeAddress.mockResolvedValue([]);

      const result = await resolveDestinationService({
        text: "lugar_inexistente_123",
        origin: { lat: 0, lng: 0 }
      });

      expect(result.mode).toBe("not_found");
      expect(result.resolvedDestination).toBeNull();
      expect(result.candidates).toEqual([]);
    });

    it("deve retornar suggestions se for categoria genérica com múltiplos resultados com distâncias similares", async () => {
      localIntelligenceService.guessQueryType.mockReturnValueOnce("generic_category");
      destinationProvider.searchPlaces.mockResolvedValue([
        { name: "Farmácia 1", address: "Rua 1, Uberaba", id: "1", lat: -19.7410, lng: -47.9310 },
        { name: "Farmácia 2", address: "Rua 2, Uberaba", id: "2", lat: -19.7415, lng: -47.9315 },
      ]);

      const result = await resolveDestinationService({
        text: "farmacia",
        origin: { lat: -19.7400, lng: -47.9300 }
      });

      expect(result.mode).toBe("suggestions");
      expect(result.candidates.length).toBe(2);
    });

    it("NÃO deve aplicar auto-seleção se for categoria genérica, mesmo que o primeiro lugar seja muito próximo", async () => {
      localIntelligenceService.guessQueryType.mockReturnValueOnce("generic_category");
      destinationProvider.searchPlaces.mockResolvedValue([
        { name: "Farmácia Perto", address: "Rua A, Uberaba", id: "1", lat: -19.7401, lng: -47.9301 },
        { name: "Farmácia Longe", address: "Rua B, Uberaba", id: "2", lat: -19.7900, lng: -47.9900 },
      ]);

      const result = await resolveDestinationService({
        text: "farmacia",
        origin: { lat: -19.7400, lng: -47.9300 }
      });

      expect(result.mode).toBe("suggestions");
      expect(result.candidates.length).toBe(2);
      expect(result.candidates[0].name).toBe("Farmácia Perto");
    });
  });

  describe("planJourney", () => {
    const defaultParams = {
      origin: { lat: -19, lng: -47 },
      destination: { lat: -20, lng: -48, name: "Destino", text: "Destino" },
      timePreference: { type: "DEPARTURE", dateTime: "2026-08-15T12:00:00Z" }
    };

    it("deve retornar a rota do cache se existir", async () => {
      routeCache.findCachedRoute.mockResolvedValue({
        googleResponse: { id: "cached_route" },
        timePreference: defaultParams.timePreference
      });

      journeyMapper.mapGoogleRouteToJourney.mockReturnValue({
        summary: { totalDurationMin: 10 }
      });

      const result = await planJourney(defaultParams);

      expect(routeCache.findCachedRoute).toHaveBeenCalled();
      expect(result.source).toBe("CACHE");
      expect(result.journey.summary.totalDurationMin).toBe(10);
    });

    it("deve chamar a API do provedor e salvar no cache se não existir", async () => {
      routeCache.findCachedRoute.mockResolvedValue(null);
      routesProvider.computeTransitRoute.mockResolvedValue({
        routes: [{ duration: "1000s" }]
      });
      journeyMapper.mapGoogleRouteToJourney.mockReturnValue({
        summary: { totalDurationMin: 16 }
      });

      const result = await planJourney(defaultParams);

      expect(routesProvider.computeTransitRoute).toHaveBeenCalled();
      expect(routeCache.createRouteCache).toHaveBeenCalled();
      expect(result.source).toBe("PROVIDER");
      expect(result.journey.summary.totalDurationMin).toBe(16);
    });

    it("deve salvar no cache repassando leaveHomeDateTime quando calculado pela rota", async () => {
      routeCache.findCachedRoute.mockResolvedValue(null);
      routesProvider.computeTransitRoute.mockResolvedValue({
        routes: [{ duration: "1000s" }]
      });
      const expectedLeaveTime = "2026-08-15T12:15:00Z";
      journeyMapper.mapGoogleRouteToJourney.mockReturnValue({
        summary: { totalDurationMin: 20, leaveHomeDateTime: expectedLeaveTime }
      });

      await planJourney(defaultParams);

      expect(routeCache.createRouteCache).toHaveBeenCalledWith(
        expect.objectContaining({
          leaveHomeDateTime: expectedLeaveTime,
        })
      );
    });

    it("deve fazer fallback para rota a pé se não houver rota de ônibus para distância curta", async () => {
      routeCache.findCachedRoute.mockResolvedValue(null);
      routesProvider.computeTransitRoute.mockResolvedValue({ routes: [] });
      routesProvider.computeWalkingRoute.mockResolvedValue({
        routes: [{ duration: "300s", distanceMeters: 800 }]
      });
      journeyMapper.mapWalkingOnlyRouteToJourney.mockReturnValue({
        summary: { totalDurationMin: 10, isWalkingOnly: true }
      });

      const result = await planJourney(defaultParams);

      expect(routesProvider.computeWalkingRoute).toHaveBeenCalled();
      expect(result.source).toBe("WALKING_FALLBACK");
      expect(result.journey.summary.isWalkingOnly).toBe(true);
    });

    it("deve enriquecer passos de caminhada inicial quando rota de ônibus possuir perna transit", async () => {
      routeCache.findCachedRoute.mockResolvedValue(null);
      const mockTransitRoute = {
        routes: [
          {
            legs: [
              {
                steps: [
                  {
                    travelMode: "TRANSIT",
                    transitDetails: {
                      stopDetails: {
                        departureStop: {
                          location: { latLng: { latitude: -19.74, longitude: -47.93 } }
                        }
                      }
                    }
                  }
                ]
              }
            ]
          }
        ]
      };
      routesProvider.computeTransitRoute.mockResolvedValue(mockTransitRoute);
      routesProvider.computeWalkingRoute.mockResolvedValue({
        routes: [
          {
            legs: [
              {
                steps: [
                  { travelMode: "WALK", navigationInstruction: { instructions: "Siga em frente" } }
                ]
              }
            ]
          }
        ]
      });
      journeyMapper.mapGoogleRouteToJourney.mockReturnValue({
        summary: { totalDurationMin: 20 }
      });

      const result = await planJourney(defaultParams);

      expect(routesProvider.computeWalkingRoute).toHaveBeenCalledWith({
        origin: defaultParams.origin,
        destination: { lat: -19.74, lng: -47.93 }
      });
      expect(result.source).toBe("PROVIDER");
    });
  });
});
