const request = require("supertest");

// Mocks devem ser definidos antes de importar o app
jest.mock("../../../src/modules/reminders/reminders.queue", () => ({
  remindersQueue: {
    add: jest.fn().mockResolvedValue({ id: "mock-job-id" }),
    getJob: jest.fn().mockResolvedValue(null),
  },
  REMINDERS_QUEUE_NAME: "push-reminders",
}));

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: "mock-job-id" }),
    getJob: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(),
  })),
}));

jest.mock("../../../src/modules/auth/auth.middleware", () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 1, email: "test@test.com", role: "USER" };
    next();
  },
}));

jest.mock("../../../src/shared/middlewares/rateLimiter.middleware", () => ({
  globalLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
}));

jest.mock("../../../src/modules/reminders/reminders.service", () => ({
  schedulePushReminder: jest.fn(),
  cancelPushReminder: jest.fn(),
}));

jest.mock("../../../src/modules/users/users.repository", () => ({
  findUserById: jest.fn(),
}));

const app = require("../../../src/app");
const { schedulePushReminder, cancelPushReminder } = require("../../../src/modules/reminders/reminders.service");
const { findUserById } = require("../../../src/modules/users/users.repository");

describe("Reminders Routes (Integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getFutureIsoDate = (minutesAhead = 15) => {
    return new Date(Date.now() + minutesAhead * 60 * 1000).toISOString();
  };

  describe("POST /reminders", () => {
    it("deve retornar 400 se a validação do body falhar (mensagem ausente)", async () => {
      const response = await request(app)
        .post("/reminders")
        .send({
          triggerDate: getFutureIsoDate(10),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain("A mensagem do lembrete é obrigatória.");
      expect(schedulePushReminder).not.toHaveBeenCalled();
    });

    it("deve retornar 400 se a data de disparo for no passado", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const response = await request(app)
        .post("/reminders")
        .send({
          body: "Ônibus chegando!",
          triggerDate: pastDate,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toContain("O horário do lembrete deve ser uma data válida no futuro.");
      expect(schedulePushReminder).not.toHaveBeenCalled();
    });

    it("deve retornar 400 se o usuário autenticado não tiver pushToken cadastrado", async () => {
      findUserById.mockResolvedValue({
        id: 1,
        pushToken: null,
      });

      const response = await request(app)
        .post("/reminders")
        .send({
          title: "Lembrete",
          body: "Ônibus chegando!",
          triggerDate: getFutureIsoDate(20),
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Usuário não possui push token registrado.",
      });
      expect(schedulePushReminder).not.toHaveBeenCalled();
    });

    it("deve agendar lembrete com sucesso e retornar 200 com jobId", async () => {
      findUserById.mockResolvedValue({
        id: 1,
        pushToken: "ExponentPushToken[xyz-123]",
      });
      schedulePushReminder.mockResolvedValue("job-abc-456");

      const triggerDate = getFutureIsoDate(30);
      const response = await request(app)
        .post("/reminders")
        .send({
          title: "Aviso de Embarque",
          body: "Seu ônibus Linha 100 chega em 10 minutos.",
          triggerDate,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: "Lembrete agendado com sucesso.",
        jobId: "job-abc-456",
      });
      expect(schedulePushReminder).toHaveBeenCalledWith({
        userId: 1,
        pushToken: "ExponentPushToken[xyz-123]",
        title: "Aviso de Embarque",
        body: "Seu ônibus Linha 100 chega em 10 minutos.",
        data: undefined,
        triggerDateIso: triggerDate,
      });
    });
  });

  describe("DELETE /reminders/:jobId", () => {
    it("deve retornar 200 quando o lembrete for cancelado com sucesso", async () => {
      cancelPushReminder.mockResolvedValue(true);

      const response = await request(app).delete("/reminders/job-abc-456");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: "Lembrete cancelado com sucesso.",
      });
      expect(cancelPushReminder).toHaveBeenCalledWith("job-abc-456");
    });

    it("deve retornar 404 quando o lembrete não for encontrado", async () => {
      cancelPushReminder.mockResolvedValue(false);

      const response = await request(app).delete("/reminders/job-inexistente");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: "Lembrete não encontrado ou já executado.",
      });
      expect(cancelPushReminder).toHaveBeenCalledWith("job-inexistente");
    });
  });
});
