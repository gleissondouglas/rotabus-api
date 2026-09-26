const { remindersQueue } = require("./reminders.queue");

/**
 * Adiciona um novo lembrete à fila de Push Notifications.
 */
async function schedulePushReminder({ userId, pushToken, title, body, data, triggerDateIso }) {
  if (!pushToken) {
    throw new Error("Usuário não possui pushToken configurado.");
  }

  const triggerDate = new Date(triggerDateIso);
  const delay = triggerDate.getTime() - Date.now();

  if (delay <= 0) {
    throw new Error("O horário de disparo deve ser no futuro.");
  }

  // Adiciona na fila com o 'delay' calculado em milissegundos
  const job = await remindersQueue.add(
    "sendPush",
    {
      userId,
      pushToken,
      title,
      body,
      data,
    },
    {
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000, // 5s, 10s, 20s
      },
      removeOnComplete: true, // Mantém o Redis limpo
    }
  );

  return job.id;
}

module.exports = {
  schedulePushReminder,
};
