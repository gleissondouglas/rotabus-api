const googlePlacesProvider = require("../../../../src/modules/journeys/providers/googlePlaces.provider");
const { searchPlaces } = require("../../../../src/modules/journeys/providers/destination.provider");

jest.mock("../../../../src/modules/journeys/providers/googlePlaces.provider", () => ({
  searchPlaces: jest.fn(),
}));

describe("destination.provider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve repassar a chamada searchPlaces para o googlePlacesProvider", async () => {
    const query = "test query";
    const origin = {};
    googlePlacesProvider.searchPlaces.mockResolvedValue([{ id: 1 }]);

    const result = await searchPlaces(query, origin);

    expect(result).toEqual([{ id: 1 }]);
    expect(googlePlacesProvider.searchPlaces).toHaveBeenCalledWith(query, origin);
  });
});
