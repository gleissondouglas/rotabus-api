import { appStorage } from "./storage.service";
import { STORAGE_KEYS } from "../constants/storage";
import { routeReminderService } from "./routeReminder.service";

export interface ScheduledTripData {
  id: string; // Identificador único da opção de rota
  destination: string;
  busLine: string;
  leaveHomeDateTime: string; // ISO string
  leaveHomeAt?: string; // HH:mm
  beAtStopAt?: string; // HH:mm
  scheduledTime: string; // HH:mm em que o lembrete tocará
  notificationId: string;
  params: Record<string, any>; // Parâmetros completos serializados para reabrir a rota
  createdAt: number;
}

export interface TripTimingStatus {
  status: "upcoming" | "time_to_go" | "expired";
  diffMinutes: number;
  message: string;
}

export const scheduledTripService = {
  /**
   * Salva a viagem agendada no storage seguro.
   * Cancela automaticamente qualquer notificação órfã anterior para evitar alarmes duplicados.
   */
  async saveScheduledTrip(data: ScheduledTripData): Promise<boolean> {
    try {
      // 1. Verifica se havia uma notificação anterior diferente e cancela
      const existing = await this.getScheduledTrip();
      if (existing && existing.notificationId && existing.notificationId !== data.notificationId) {
        await routeReminderService.cancelReminder(existing.notificationId);
      }

      // 2. Salva o pacote completo da viagem
      await appStorage.setItem(STORAGE_KEYS.SCHEDULED_TRIP, JSON.stringify(data));

      // 3. Atualiza também a chave de compatibilidade
      await appStorage.setItem(
        STORAGE_KEYS.ACTIVE_REMINDER,
        JSON.stringify({
          time: data.scheduledTime,
          jobId: data.notificationId,
          leaveHomeDateTime: data.leaveHomeDateTime,
          routeId: data.id,
        })
      );

      return true;
    } catch (error) {
      console.error("[ScheduledTripService] Erro ao salvar viagem agendada:", error);
      return false;
    }
  },

  /**
   * Obtém a viagem agendada atual salva no dispositivo.
   */
  async getScheduledTrip(): Promise<ScheduledTripData | null> {
    try {
      const raw = await appStorage.getItem(STORAGE_KEYS.SCHEDULED_TRIP);
      if (!raw) return null;
      return JSON.parse(raw) as ScheduledTripData;
    } catch (error) {
      console.warn("[ScheduledTripService] Falha ao recuperar viagem agendada:", error);
      return null;
    }
  },

  /**
   * Cancela e limpa a viagem agendada do storage e do sistema de notificações.
   */
  async clearScheduledTrip(cancelSystemNotification: boolean = true): Promise<boolean> {
    try {
      const existing = await this.getScheduledTrip();
      if (existing && cancelSystemNotification && existing.notificationId) {
        await routeReminderService.cancelReminder(existing.notificationId);
      }

      await appStorage.deleteItem(STORAGE_KEYS.SCHEDULED_TRIP);
      await appStorage.deleteItem(STORAGE_KEYS.ACTIVE_REMINDER);
      return true;
    } catch (error) {
      console.error("[ScheduledTripService] Erro ao limpar viagem agendada:", error);
      return false;
    }
  },

  /**
   * Avalia a pontualidade da viagem agendada em relação ao relógio atual.
   */
  getTripTimingStatus(trip: ScheduledTripData): TripTimingStatus {
    const leaveDate = new Date(trip.leaveHomeDateTime).getTime();
    if (isNaN(leaveDate)) {
      return {
        status: "expired",
        diffMinutes: -999,
        message: `O horário da viagem para ${trip.destination} não pôde ser verificado.`,
      };
    }

    const now = Date.now();
    const diffMinutes = Math.round((leaveDate - now) / 60000);
    const isWalking = trip.busLine === "a pé" || !trip.busLine;

    // Se o horário de saída já passou há mais de 15 minutos, consideramos que o ônibus/horário foi perdido
    if (diffMinutes < -15) {
      const modeText = isWalking ? "Sua saída a pé" : `O ônibus para ${trip.destination}`;
      return {
        status: "expired",
        diffMinutes,
        message: `${modeText} agendado para as ${trip.leaveHomeAt || "horário previsto"} já passou.`,
      };
    }

    // Se faltam 15 minutos ou menos para sair (ou passou até 15 min), é hora de ir para o ponto ou sair
    if (diffMinutes <= 15) {
      let phrase = "";
      if (diffMinutes <= 0) {
        phrase = isWalking
          ? "Está no horário de sair! Inicie sua caminhada agora."
          : "Seu ônibus está no horário de saída! Inicie o trajeto para o ponto agora.";
      } else {
        phrase = isWalking
          ? `Faltam cerca de ${diffMinutes} minutos para você iniciar sua caminhada para ${trip.destination}.`
          : `Faltam cerca de ${diffMinutes} minutos para você sair para o ponto do ônibus ${trip.busLine}.`;
      }

      return {
        status: "time_to_go",
        diffMinutes,
        message: phrase,
      };
    }

    // Ainda é uma viagem futura distante
    const upcomingPhrase = isWalking
      ? `Lembrete ativo para saída a pé às ${trip.leaveHomeAt || trip.scheduledTime}.`
      : `Lembrete ativo para o ônibus ${trip.busLine} às ${trip.leaveHomeAt || trip.scheduledTime}.`;

    return {
      status: "upcoming",
      diffMinutes,
      message: upcomingPhrase,
    };
  },
};
