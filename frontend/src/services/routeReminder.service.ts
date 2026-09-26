import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export interface ScheduleReminderParams {
  destination: string;
  busLine?: string;
  leaveHomeDateTime: string; // ISO string
  beAtStopAt?: string;
  minutesBefore?: number; // padrão 10
}

export interface ReminderResult {
  success: boolean;
  notificationId?: string;
  scheduledTime?: string; // HH:mm
  error?: string;
}

export const routeReminderService = {
  /**
   * Agenda um lembrete local para alertar o usuário antes da hora de sair para o ponto.
   */
  async scheduleReminder({
    destination,
    busLine = "ônibus",
    leaveHomeDateTime,
    beAtStopAt,
    minutesBefore = 10,
  }: ScheduleReminderParams): Promise<ReminderResult> {
    try {
      if (!leaveHomeDateTime) {
        return { success: false, error: "Horário de saída não informado." };
      }

      const leaveDate = new Date(leaveHomeDateTime);
      if (Number.isNaN(leaveDate.getTime())) {
        return { success: false, error: "Data de saída inválida." };
      }

      // Calcula o momento exato do disparo (ex: 10 minutos antes de sair)
      const triggerDate = new Date(leaveDate.getTime() - minutesBefore * 60 * 1000);
      const now = new Date();

      if (triggerDate.getTime() <= now.getTime()) {
        return {
          success: false,
          error: "O horário para este lembrete já passou ou está muito próximo.",
        };
      }

      // Garante permissão de notificação
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        return {
          success: false,
          error: "Permissão de notificação necessária para agendar lembretes.",
        };
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("route-reminders", {
          name: "Lembretes de Rotas",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 300, 200, 300],
          lightColor: "#2563EB",
          sound: "default",
        });
      }

      const stopInfo = beAtStopAt ? ` às ${beAtStopAt}` : "";
      const notificationTitle = "🚌 Hora de se preparar para sair!";
      const notificationBody = `Seu ônibus (${busLine}) passa${stopInfo}. Saia em ${minutesBefore} minutos para caminhar com calma até o ponto.`;

      const scheduledTime = triggerDate.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      try {
        // Tenta enviar para o servidor (BullMQ Queue)
        // Precisamos importar o api helper aqui, mas para garantir, fazemos require inline ou usamos fetch se preferir.
        const { api } = require("../utils/api");
        const response = await api.post("/reminders", {
          title: notificationTitle,
          body: notificationBody,
          triggerDate: triggerDate.toISOString(),
          data: { destination, busLine, leaveHomeDateTime }
        });
        
        return {
          success: true,
          notificationId: response.data.jobId || "backend-job",
          scheduledTime,
        };
      } catch (backendError) {
        console.warn("[RouteReminderService] Falha ao agendar no backend (BullMQ). Caindo para agendamento local:", backendError);
        
        // Fallback: Agenda no dispositivo nativo
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: notificationTitle,
            body: notificationBody,
            sound: true,
            data: {
              destination,
              busLine,
              leaveHomeDateTime,
            },
            ...(Platform.OS === "android" ? { channelId: "route-reminders" } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });

        return {
          success: true,
          notificationId,
          scheduledTime,
        };
      }
    } catch (err: any) {
      console.error("[RouteReminderService] Erro ao agendar notificação:", err);
      return {
        success: false,
        error: err?.message || "Falha ao agendar lembrete no dispositivo.",
      };
    }
  },

  /**
   * Cancela um lembrete de rota previamente agendado.
   */
  async cancelReminder(notificationId: string): Promise<boolean> {
    try {
      try {
        const { api } = require("../utils/api");
        await api.delete(`/reminders/${notificationId}`);
      } catch (backendError: any) {
        console.warn("[RouteReminderService] Falha ou ID não é do backend, prosseguindo para cancelamento local.", backendError?.message);
      }
      
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      return true;
    } catch {
      return false;
    }
  },
};
