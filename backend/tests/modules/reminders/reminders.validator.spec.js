const { scheduleReminderSchema } = require("../../../src/modules/reminders/reminders.validator");

describe("Reminders Validator - scheduleReminderSchema", () => {
  const getFutureIsoDate = (minutesAhead = 10) => {
    return new Date(Date.now() + minutesAhead * 60 * 1000).toISOString();
  };

  const getPastIsoDate = (minutesAgo = 10) => {
    return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  };

  describe("Caminho Feliz (Casos de Sucesso)", () => {
    it("deve validar com sucesso um payload completo no futuro", () => {
      const payload = {
        title: "Lembrete de Ônibus",
        body: "A linha 100 está chegando ao ponto!",
        data: { routeId: "linha-100", stopId: 42 },
        triggerDate: getFutureIsoDate(30),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe("Lembrete de Ônibus");
      expect(result.data.body).toBe("A linha 100 está chegando ao ponto!");
      expect(result.data.data).toEqual({ routeId: "linha-100", stopId: 42 });
      expect(result.data.triggerDate).toBe(payload.triggerDate);
    });

    it("deve validar com sucesso payload sem title e sem data (campos opcionais)", () => {
      const payload = {
        body: "Seu ônibus chega em 5 minutos.",
        triggerDate: getFutureIsoDate(5),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(true);
      expect(result.data.title).toBeUndefined();
      expect(result.data.data).toBeUndefined();
      expect(result.data.body).toBe("Seu ônibus chega em 5 minutos.");
    });

    it("deve aceitar title e data nulos", () => {
      const payload = {
        title: null,
        body: "Aviso importante de rota",
        data: null,
        triggerDate: getFutureIsoDate(15),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(true);
      expect(result.data.title).toBeNull();
      expect(result.data.data).toBeNull();
    });

    it("deve aplicar trim no title e no body", () => {
      const payload = {
        title: "   Aviso RotaBus   ",
        body: "   Desembarque no próximo ponto.   ",
        triggerDate: getFutureIsoDate(10),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe("Aviso RotaBus");
      expect(result.data.body).toBe("Desembarque no próximo ponto.");
    });

    it("deve aceitar body com exatamente 250 caracteres e title com 100 caracteres", () => {
      const payload = {
        title: "A".repeat(100),
        body: "B".repeat(250),
        triggerDate: getFutureIsoDate(10),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(true);
      expect(result.data.title.length).toBe(100);
      expect(result.data.body.length).toBe(250);
    });
  });

  describe("Casos de Erro e Validação de Borda", () => {
    it("deve rejeitar quando body estiver ausente", () => {
      const payload = {
        title: "Aviso",
        triggerDate: getFutureIsoDate(10),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("A mensagem do lembrete é obrigatória.");
    });

    it("deve rejeitar quando body for string vazia", () => {
      const payload = {
        body: "",
        triggerDate: getFutureIsoDate(10),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("A mensagem do lembrete não pode estar vazia.");
    });

    it("deve rejeitar quando body contiver apenas espaços em branco", () => {
      const payload = {
        body: "     ",
        triggerDate: getFutureIsoDate(10),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("A mensagem do lembrete não pode estar vazia.");
    });

    it("deve rejeitar quando body tiver mais de 250 caracteres", () => {
      const payload = {
        body: "C".repeat(251),
        triggerDate: getFutureIsoDate(10),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("A mensagem do lembrete deve ter no máximo 250 caracteres.");
    });

    it("deve rejeitar quando body for de tipo diferente de string", () => {
      const payload = {
        body: 12345,
        triggerDate: getFutureIsoDate(10),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("A mensagem deve ser um texto.");
    });

    it("deve rejeitar quando title exceder 100 caracteres", () => {
      const payload = {
        title: "T".repeat(101),
        body: "Mensagem válida",
        triggerDate: getFutureIsoDate(10),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
    });

    it("deve rejeitar quando triggerDate estiver ausente", () => {
      const payload = {
        body: "Mensagem válida",
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("A data de disparo é obrigatória.");
    });

    it("deve rejeitar quando triggerDate não for string", () => {
      const payload = {
        body: "Mensagem válida",
        triggerDate: 1735689600000,
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("A data de disparo deve ser uma string no formato ISO.");
    });

    it("deve rejeitar quando triggerDate for string inválida (não formato de data)", () => {
      const payload = {
        body: "Mensagem válida",
        triggerDate: "data-totalmente-invalida",
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("O horário do lembrete deve ser uma data válida no futuro.");
    });

    it("deve rejeitar quando triggerDate for no passado", () => {
      const payload = {
        body: "Mensagem válida",
        triggerDate: getPastIsoDate(30),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("O horário do lembrete deve ser uma data válida no futuro.");
    });

    it("deve rejeitar quando triggerDate for o momento atual imediato ou anterior", () => {
      const payload = {
        body: "Mensagem válida",
        triggerDate: new Date(Date.now() - 100).toISOString(),
      };

      const result = scheduleReminderSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe("O horário do lembrete deve ser uma data válida no futuro.");
    });
  });
});
