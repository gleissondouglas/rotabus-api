const apiUsageRepository = require("../../../src/shared/repositories/apiUsage.repository");
const {
  dailyJourneyLimit,
  recordDailyJourneyUsage,
} = require("../../../src/shared/middlewares/dailyLimit.middleware");

jest.mock("../../../src/shared/repositories/apiUsage.repository", () => ({
  countUsage: jest.fn(),
  createUsage: jest.fn(),
}));

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("DailyLimitMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("verifica o limite sem registrar consumo antecipadamente", async () => {
    apiUsageRepository.countUsage.mockResolvedValue(0);
    const req = { ip: "127.0.0.1", user: { id: 1, role: "USER" } };
    const res = createResponse();
    const next = jest.fn();

    await dailyJourneyLimit(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(apiUsageRepository.createUsage).not.toHaveBeenCalled();
    expect(req.dailyJourneyUsage).toEqual({
      userId: 1,
      ipAddress: "127.0.0.1",
      endpoint: "/journeys",
    });
  });

  test("registra o consumo somente quando solicitado após sucesso do provider", async () => {
    apiUsageRepository.createUsage.mockResolvedValue({ id: 1 });
    const req = {
      dailyJourneyUsage: {
        userId: 1,
        ipAddress: "127.0.0.1",
        endpoint: "/journeys",
      },
    };

    await expect(recordDailyJourneyUsage(req)).resolves.toBe(true);
    expect(apiUsageRepository.createUsage).toHaveBeenCalledWith(req.dailyJourneyUsage);
  });

  test("não registra cache, falha ou usuário administrador sem contexto de uso", async () => {
    await expect(recordDailyJourneyUsage({})).resolves.toBe(false);
    expect(apiUsageRepository.createUsage).not.toHaveBeenCalled();

    const req = { ip: "127.0.0.1", user: { id: 1, role: "ADMIN" } };
    const next = jest.fn();
    await dailyJourneyLimit(req, createResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(apiUsageRepository.countUsage).not.toHaveBeenCalled();
    expect(req.dailyJourneyUsage).toBeUndefined();
  });

  test("bloqueia ao atingir dez chamadas externas no dia", async () => {
    apiUsageRepository.countUsage.mockResolvedValue(10);
    const req = { ip: "127.0.0.1", user: { id: 1, role: "USER" } };
    const res = createResponse();
    const next = jest.fn();

    await dailyJourneyLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: "DAILY_LIMIT_EXCEEDED",
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
