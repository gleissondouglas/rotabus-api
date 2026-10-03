const mockAdd = jest.fn();
const mockGetJob = jest.fn();

jest.mock("../../../src/modules/reminders/reminders.queue", () => ({
  remindersQueue: {
    add: mockAdd,
    getJob: mockGetJob,
  },
  REMINDERS_QUEUE_NAME: "push-reminders",
}));

const { schedulePushReminder, cancelPushReminder } = require("../../../src/modules/reminders/reminders.service");

describe("Reminders Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("schedulePushReminder", () => {
    it("deve lançar erro se pushToken não for fornecido", async () => {
      await expect(
        schedulePushReminder({
          userId: "user-1",
          pushToken: null,
          title: "Aviso",
          body: "Mensagem",
          triggerDateIso: new Date(Date.now() + 60000).toISOString(),
        })
      ).rejects.toThrow("Usuário não possui pushToken configurado.");
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("deve lançar erro se a data de disparo for no passado ou agora", async () => {
      await expect(
        schedulePushReminder({
          userId: "user-1",
          pushToken: "ExponentPushToken[abc]",
          title: "Aviso",
          body: "Mensagem",
          triggerDateIso: new Date(Date.now() - 5000).toISOString(),
        })
      ).rejects.toThrow("O horário de disparo deve ser no futuro.");
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("deve agendar o lembrete na fila com o delay correto e opções", async () => {
      const futureDate = new Date(Date.now() + 10000); // 10 segundos no futuro
      mockAdd.mockResolvedValue({ id: "job-101" });

      const jobId = await schedulePushReminder({
        userId: "user-1",
        pushToken: "ExponentPushToken[abc]",
        title: "Aviso",
        body: "Mensagem do ônibus",
        data: { stopId: 1 },
        triggerDateIso: futureDate.toISOString(),
      });

      expect(jobId).toBe("job-101");
      expect(mockAdd).toHaveBeenCalledWith(
        "sendPush",
        {
          userId: "user-1",
          pushToken: "ExponentPushToken[abc]",
          title: "Aviso",
          body: "Mensagem do ônibus",
          data: { stopId: 1 },
        },
        expect.objectContaining({
          attempts: 3,
          removeOnComplete: true,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        })
      );
      // O delay deve ser positivo e próximo de 10000ms
      const passedOptions = mockAdd.mock.calls[0][2];
      expect(passedOptions.delay).toBeGreaterThan(0);
      expect(passedOptions.delay).toBeLessThanOrEqual(10000);
    });
  });

  describe("cancelPushReminder", () => {
    it("deve retornar false se jobId for nulo ou indefinido", async () => {
      const resNull = await cancelPushReminder(null);
      const resEmpty = await cancelPushReminder("");
      expect(resNull).toBe(false);
      expect(resEmpty).toBe(false);
      expect(mockGetJob).not.toHaveBeenCalled();
    });

    it("deve remover o job e retornar true se o job for encontrado na fila", async () => {
      const mockRemove = jest.fn().mockResolvedValue();
      mockGetJob.mockResolvedValue({ id: "job-101", remove: mockRemove });

      const res = await cancelPushReminder("job-101");

      expect(mockGetJob).toHaveBeenCalledWith("job-101");
      expect(mockRemove).toHaveBeenCalled();
      expect(res).toBe(true);
    });

    it("deve retornar false se o job não for encontrado na fila", async () => {
      mockGetJob.mockResolvedValue(null);

      const res = await cancelPushReminder("job-inexistente");

      expect(mockGetJob).toHaveBeenCalledWith("job-inexistente");
      expect(res).toBe(false);
    });
  });
});
