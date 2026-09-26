const { schedulePushReminder } = require("./reminders.service");
const usersRepository = require("../users/users.repository"); // Para buscar o pushToken atualizado do usuário

async function scheduleReminder(req, res, next) {
  try {
    const { title, body, data, triggerDate } = req.body;
    const userId = req.user.id; // Vem do authMiddleware

    // Busca o usuário no banco para pegar o pushToken
    const user = await usersRepository.getUserById(userId);

    if (!user || !user.pushToken) {
      return res.status(400).json({ error: "Usuário não possui push token registrado." });
    }

    const jobId = await schedulePushReminder({
      userId,
      pushToken: user.pushToken,
      title,
      body,
      data,
      triggerDateIso: triggerDate,
    });

    res.status(200).json({
      message: "Lembrete agendado com sucesso.",
      jobId,
    });
  } catch (error) {
    next(error);
  }
}

async function cancelReminder(req, res, next) {
  try {
    const { jobId } = req.params;
    const { cancelPushReminder } = require("./reminders.service");
    const success = await cancelPushReminder(jobId);
    
    if (success) {
      res.status(200).json({ message: "Lembrete cancelado com sucesso." });
    } else {
      res.status(404).json({ error: "Lembrete não encontrado ou já executado." });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  scheduleReminder,
  cancelReminder,
};
