const googleRoutesProvider = require("../../../../src/modules/journeys/providers/googleRoutes.provider");
const { computeTransitRoute, computeWalkingRoute } = require("../../../../src/modules/journeys/providers/routes.provider");

jest.mock("../../../../src/modules/journeys/providers/googleRoutes.provider", () => ({
  computeTransitRoute: jest.fn(),
  computeWalkingRoute: jest.fn(),
}));

describe("routes.provider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve repassar a chamada computeTransitRoute para o googleRoutesProvider", async () => {
    const params = { origin: {}, destination: {}, timePreference: {} };
    googleRoutesProvider.computeTransitRoute.mockResolvedValue({ status: "OK" });

    const result = await computeTransitRoute(params);

    expect(result).toEqual({ status: "OK" });
    expect(googleRoutesProvider.computeTransitRoute).toHaveBeenCalledWith(params);
  });

  test("deve repassar a chamada computeWalkingRoute para o googleRoutesProvider", async () => {
    const params = { origin: {}, destination: {} };
    googleRoutesProvider.computeWalkingRoute.mockResolvedValue({ status: "OK" });

    const result = await computeWalkingRoute(params);

    expect(result).toEqual({ status: "OK" });
    expect(googleRoutesProvider.computeWalkingRoute).toHaveBeenCalledWith(params);
  });
});
