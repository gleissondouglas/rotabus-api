const {
  ROUTE_CACHE_TTL_MS,
  findCachedRoute,
  createRouteCache,
  clearRouteCache,
} = require("../../../src/modules/journeys/route-cache");

describe("RouteCache (In-Memory)", () => {
  beforeEach(() => {
    clearRouteCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    clearRouteCache();
    jest.useRealTimers();
  });

  test("deve retornar uma rota armazenada dentro do TTL", () => {
    const cachedRoute = {
      cacheKey: "origem-destino-horario",
      googleResponse: { routes: [{ duration: "600s" }] },
      timePreference: { type: "DEPARTURE", dateTime: "2026-07-11T12:00:00.000Z" },
    };

    createRouteCache(cachedRoute);
    jest.advanceTimersByTime(ROUTE_CACHE_TTL_MS - 1);

    expect(findCachedRoute(cachedRoute.cacheKey)).toEqual({
      googleResponse: cachedRoute.googleResponse,
      timePreference: cachedRoute.timePreference,
    });
  });

  test("deve remover e ignorar uma rota expirada", () => {
    createRouteCache({
      cacheKey: "rota-expirada",
      googleResponse: { routes: [] },
      timePreference: null,
    });
    jest.advanceTimersByTime(ROUTE_CACHE_TTL_MS);

    expect(findCachedRoute("rota-expirada")).toBeNull();
    expect(findCachedRoute("rota-expirada")).toBeNull();
  });

  test("deve manter rotas diferentes isoladas por chave", () => {
    createRouteCache({ cacheKey: "rota-a", googleResponse: { id: "a" } });
    createRouteCache({ cacheKey: "rota-b", googleResponse: { id: "b" } });

    expect(findCachedRoute("rota-a").googleResponse).toEqual({ id: "a" });
    expect(findCachedRoute("rota-b").googleResponse).toEqual({ id: "b" });
  });
});
