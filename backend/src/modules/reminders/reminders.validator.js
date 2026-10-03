const { z } = require("zod");

const scheduleReminderSchema = z.object({
  title: z.string().trim().max(100).optional().nullable(),
  body: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? "A mensagem do lembrete é obrigatória."
          : "A mensagem deve ser um texto.",
    })
    .trim()
    .min(1, "A mensagem do lembrete não pode estar vazia.")
    .max(250, "A mensagem do lembrete deve ter no máximo 250 caracteres."),
  data: z.record(z.any()).optional().nullable(),
  triggerDate: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? "A data de disparo é obrigatória."
          : "A data de disparo deve ser uma string no formato ISO.",
    })
    .refine((val) => {
      const parsed = Date.parse(val);
      return !isNaN(parsed) && parsed > Date.now();
    }, {
      message: "O horário do lembrete deve ser uma data válida no futuro.",
    }),
});

module.exports = {
  scheduleReminderSchema,
};
