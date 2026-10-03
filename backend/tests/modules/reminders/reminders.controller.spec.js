jest.mock("../../../src/modules/reminders/reminders.queue", () => ({
  remindersQueue: {
    add: jest.fn(),
    getJob: jest.fn(),
  },
  REMINDERS_QUEUE_NAME: "push-reminders",
}));

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    getJob: jest.fn(),
    close: jest.fn().mockResolvedValue(),
  })),
}));

jest.mock("../../../src/modules/reminders/reminders.service");
jest.mock("../../../src/modules/users/users.repository");

const remindersController = require("../../../src/modules/reminders/reminders.controller");
const remindersService = require("../../../src/modules/reminders/reminders.service");
const usersRepository = require("../../../src/modules/users/users.repository");

describe("Reminders Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { id: "user-uuid-1" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("scheduleReminder", () => {
    it("deve retornar 400 se o usuário não for encontrado", async () => {
      req.body = {
        title: "Ponto de Ônibus",
        body: "Seu ônibus está chegando.",
        triggerDate: "2026-10-03T15:00:00.000Z",
      };
      usersRepository.findUserById.mockResolvedValue(null);

      await remindersController.scheduleReminder(req, res, next);

      expect(usersRepository.findUserById).toHaveBeenCalledWith("user-uuid-1");
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Usuário não possui push token registrado.",
      });
      expect(remindersService.schedulePushReminder).not.toHaveBeenCalled();
    });

    it("deve retornar 400 se o usuário não possuir pushToken", async () => {
      req.body = {
        title: "Ponto de Ônibus",
        body: "Seu ônibus está chegando.",
        triggerDate: "2026-10-03T15:00:00.000Z",
      };
      usersRepository.findUserById.mockResolvedValue({
        id: "user-uuid-1",
        pushToken: null,
      });

      await remindersController.scheduleReminder(req, res, next);

      expect(usersRepository.findUserById).toHaveBeenCalledWith("user-uuid-1");
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Usuário não possui push token registrado.",
      });
      expect(remindersService.schedulePushReminder).not.toHaveBeenCalled();
    });

    it("deve agendar lembrete com sucesso e retornar 200 com jobId", async () => {
      req.body = {
        title: "Ponto de Ônibus",
        body: "Seu ônibus está chegando.",
        data: { stopId: 10 },
        triggerDate: "2026-10-03T15:00:00.000Z",
      };
      usersRepository.findUserById.mockResolvedValue({
        id: "user-uuid-1",
        pushToken: "ExponentPushToken[mock-token]",
      });
      remindersService.schedulePushReminder.mockResolvedValue("job-12345");

      await remindersController.scheduleReminder(req, res, next);

      expect(usersRepository.findUserById).toHaveBeenCalledWith("user-uuid-1");
      expect(remindersService.schedulePushReminder).toHaveBeenCalledWith({
        userId: "user-uuid-1",
        pushToken: "ExponentPushToken[mock-token]",
        title: "Ponto de Ônibus",
        body: "Seu ônibus está chegando.",
        data: { stopId: 10 },
        triggerDateIso: "2026-10-03T15:00:00.000Z",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Lembrete agendado com sucesso.",
        jobId: "job-12345",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("deve chamar next com o erro se o repositório ou serviço falhar", async () => {
      req.body = {
        title: "Aviso",
        body: "Mensagem",
        triggerDate: "2026-10-03T15:00:00.000Z",
      };
      const dbError = new Error("Erro de banco de dados");
      usersRepository.findUserById.mockRejectedValue(dbError);

      await remindersController.scheduleReminder(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe("cancelReminder", () => {
    it("deve retornar 200 quando o lembrete for cancelado com sucesso", async () => {
      req.params = { jobId: "job-999" };
      remindersService.cancelPushReminder.mockResolvedValue(true);

      await remindersController.cancelReminder(req, res, next);

      expect(remindersService.cancelPushReminder).toHaveBeenCalledWith("job-999");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Lembrete cancelado com sucesso.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("deve retornar 404 quando o lembrete não for encontrado ou já executado", async () => {
      req.params = { jobId: "job-inexistente" };
      remindersService.cancelPushReminder.mockResolvedValue(false);

      await remindersController.cancelReminder(req, res, next);

      expect(remindersService.cancelPushReminder).toHaveBeenCalledWith("job-inexistente");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Lembrete não encontrado ou já executado.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("deve chamar next se o cancelamento lançar uma exceção", async () => {
      req.params = { jobId: "job-erro" };
      const serviceError = new Error("Erro ao conectar à fila");
      remindersService.cancelPushReminder.mockRejectedValue(serviceError);

      await remindersController.cancelReminder(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });
});
