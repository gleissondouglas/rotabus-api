import { scheduledTripService, ScheduledTripData } from "../scheduledTrip.service";
import { appStorage } from "../storage.service";
import { routeReminderService } from "../routeReminder.service";
import { STORAGE_KEYS } from "../../constants/storage";

jest.mock("../storage.service", () => ({
  appStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    deleteItem: jest.fn(),
  },
}));

jest.mock("../routeReminder.service", () => ({
  routeReminderService: {
    cancelReminder: jest.fn(),
  },
}));

describe("scheduledTripService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockTrip: ScheduledTripData = {
    id: "dest_100_opt0",
    destination: "Hospital Escola",
    busLine: "100",
    leaveHomeDateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    leaveHomeAt: "14:30",
    beAtStopAt: "14:40",
    scheduledTime: "14:20",
    notificationId: "notif-abc-123",
    params: { destination: "Hospital Escola" },
    createdAt: Date.now(),
  };

  describe("saveScheduledTrip", () => {
    it("deve salvar a viagem e atualizar STORAGE_KEYS.SCHEDULED_TRIP e ACTIVE_REMINDER", async () => {
      (appStorage.getItem as jest.Mock).mockResolvedValue(null);
      (appStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const success = await scheduledTripService.saveScheduledTrip(mockTrip);

      expect(success).toBe(true);
      expect(appStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.SCHEDULED_TRIP,
        JSON.stringify(mockTrip)
      );
      expect(appStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ACTIVE_REMINDER,
        expect.stringContaining(mockTrip.notificationId)
      );
    });

    it("deve cancelar a notificação órfã anterior caso o notificationId seja diferente", async () => {
      const oldTrip: ScheduledTripData = {
        ...mockTrip,
        id: "dest_old",
        notificationId: "old-notif-777",
      };

      (appStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(oldTrip));
      (appStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      (routeReminderService.cancelReminder as jest.Mock).mockResolvedValue(true);

      const success = await scheduledTripService.saveScheduledTrip(mockTrip);

      expect(success).toBe(true);
      expect(routeReminderService.cancelReminder).toHaveBeenCalledWith("old-notif-777");
    });
  });

  describe("getScheduledTrip", () => {
    it("deve retornar null se nada estiver salvo", async () => {
      (appStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await scheduledTripService.getScheduledTrip();
      expect(result).toBeNull();
    });

    it("deve retornar o objeto parseado se houver dados", async () => {
      (appStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockTrip));

      const result = await scheduledTripService.getScheduledTrip();
      expect(result).toEqual(mockTrip);
    });
  });

  describe("clearScheduledTrip", () => {
    it("deve cancelar a notificação no sistema e deletar chaves do storage", async () => {
      (appStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockTrip));
      (routeReminderService.cancelReminder as jest.Mock).mockResolvedValue(true);
      (appStorage.deleteItem as jest.Mock).mockResolvedValue(undefined);

      const result = await scheduledTripService.clearScheduledTrip(true);

      expect(result).toBe(true);
      expect(routeReminderService.cancelReminder).toHaveBeenCalledWith("notif-abc-123");
      expect(appStorage.deleteItem).toHaveBeenCalledWith(STORAGE_KEYS.SCHEDULED_TRIP);
      expect(appStorage.deleteItem).toHaveBeenCalledWith(STORAGE_KEYS.ACTIVE_REMINDER);
    });
  });

  describe("getTripTimingStatus", () => {
    it("deve classificar como 'expired' quando a saída já passou há mais de 15 minutos", () => {
      const pastTrip: ScheduledTripData = {
        ...mockTrip,
        leaveHomeDateTime: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      };

      const timing = scheduledTripService.getTripTimingStatus(pastTrip);
      expect(timing.status).toBe("expired");
      expect(timing.message).toContain("já passou");
    });

    it("deve classificar como 'time_to_go' quando faltam até 15 minutos", () => {
      const soonTrip: ScheduledTripData = {
        ...mockTrip,
        leaveHomeDateTime: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
      };

      const timing = scheduledTripService.getTripTimingStatus(soonTrip);
      expect(timing.status).toBe("time_to_go");
      expect(timing.message).toContain("minutos para você sair");
    });

    it("deve classificar como 'upcoming' quando faltam mais de 15 minutos", () => {
      const futureTrip: ScheduledTripData = {
        ...mockTrip,
        leaveHomeDateTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      };

      const timing = scheduledTripService.getTripTimingStatus(futureTrip);
      expect(timing.status).toBe("upcoming");
      expect(timing.message).toContain("Lembrete ativo");
    });

    it("deve retornar expired para datas inválidas ou corrompidas", () => {
      const corruptTrip: ScheduledTripData = {
        ...mockTrip,
        leaveHomeDateTime: "invalid-date",
      };

      const timing = scheduledTripService.getTripTimingStatus(corruptTrip);
      expect(timing.status).toBe("expired");
      expect(timing.diffMinutes).toBe(-999);
    });

    it("deve adaptar a frase de voz corretamente para rotas a pé", () => {
      const walkTrip: ScheduledTripData = {
        ...mockTrip,
        busLine: "a pé",
        leaveHomeDateTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };

      const timing = scheduledTripService.getTripTimingStatus(walkTrip);
      expect(timing.status).toBe("time_to_go");
      expect(timing.message).toContain("iniciar sua caminhada");
      expect(timing.message).not.toContain("ponto do ônibus");
    });
  });
});
