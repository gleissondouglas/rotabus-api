const { Worker } = require("bullmq");
const { Expo } = require("expo-server-sdk");
const { connection } = require("./bullmq.config");
const { REMINDERS_QUEUE_NAME } = require("./reminders.queue");

let expo = new Expo();

// Instancia o Worker
const worker = new Worker(
  REMINDERS_QUEUE_NAME,
  async (job) => {
    const { pushToken, title, body, data } = job.data;

    if (!Expo.isExpoPushToken(pushToken)) {
      throw new Error(`Push token inválido: ${pushToken}`);
    }

    const message = {
      to: pushToken,
      sound: "default",
      title: title || "Lembrete de Ônibus",
      body: body,
      data: data || {},
      channelId: "route-reminders", // Para Android
    };

    console.log(`[RemindersWorker] Enviando push para ${pushToken}...`);
    try {
      const ticketChunks = await expo.sendPushNotificationsAsync([message]);
      console.log("[RemindersWorker] Sucesso:", ticketChunks);
    } catch (error) {
      console.error("[RemindersWorker] Falha ao enviar notificação Push:", error);
      throw error; // Repassa para o BullMQ fazer o retry
    }
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`[BullMQ] Job ${job.id} concluído com sucesso.`);
});

worker.on("failed", (job, err) => {
  console.error(`[BullMQ] Job ${job.id} falhou: ${err.message}`);
});

module.exports = worker;
