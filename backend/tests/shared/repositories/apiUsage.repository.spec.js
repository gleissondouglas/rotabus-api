const prisma = require("../../../src/config/prisma");
const { countUsage, createUsage, anonymizeUsageByUserId } = require("../../../src/shared/repositories/apiUsage.repository");

jest.mock("../../../src/config/prisma", () => ({
  apiUsage: {
    count: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
}));

describe("ApiUsageRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("countUsage", () => {
    test("deve chamar prisma.apiUsage.count com os filtros corretos", async () => {
      prisma.apiUsage.count.mockResolvedValue(5);
      const params = {
        ipAddress: "127.0.0.1",
        userId: 1,
        since: new Date(),
        endpoint: "/journeys",
      };

      const result = await countUsage(params);

      expect(result).toBe(5);
      expect(prisma.apiUsage.count).toHaveBeenCalledWith({
        where: {
          endpoint: params.endpoint,
          createdAt: { gte: params.since },
          OR: [
            { ipAddress: params.ipAddress },
            { userId: params.userId },
          ],
        },
      });
    });

    test("deve chamar prisma.apiUsage.count sem userId se não fornecido", async () => {
      prisma.apiUsage.count.mockResolvedValue(2);
      const params = {
        ipAddress: "127.0.0.1",
        userId: null,
        since: new Date(),
        endpoint: "/journeys",
      };

      const result = await countUsage(params);

      expect(result).toBe(2);
      expect(prisma.apiUsage.count).toHaveBeenCalledWith({
        where: {
          endpoint: params.endpoint,
          createdAt: { gte: params.since },
          OR: [
            { ipAddress: params.ipAddress },
          ],
        },
      });
    });
  });

  describe("createUsage", () => {
    test("deve chamar prisma.apiUsage.create com os dados corretos", async () => {
      const mockUsage = { id: 1, userId: 1, ipAddress: "127.0.0.1", endpoint: "/journeys" };
      prisma.apiUsage.create.mockResolvedValue(mockUsage);

      const result = await createUsage({
        userId: 1,
        ipAddress: "127.0.0.1",
        endpoint: "/journeys",
      });

      expect(result).toEqual(mockUsage);
      expect(prisma.apiUsage.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          ipAddress: "127.0.0.1",
          endpoint: "/journeys",
        },
      });
    });
  });

  describe("anonymizeUsageByUserId", () => {
    test("deve chamar prisma.apiUsage.updateMany com ipAddress zerado", async () => {
      prisma.apiUsage.updateMany.mockResolvedValue({ count: 10 });

      const result = await anonymizeUsageByUserId(1);

      expect(result).toEqual({ count: 10 });
      expect(prisma.apiUsage.updateMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        data: { ipAddress: "0.0.0.0" },
      });
    });
  });
});
