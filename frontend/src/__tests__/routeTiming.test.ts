import {
  calculateRouteTiming,
  findNextViableRouteIndex,
  hasAnyViableRoute,
  RouteItemLike,
} from "../utils/routeTiming";

describe("routeTiming utility", () => {
  const baseTime = new Date("2026-10-03T11:27:00.000Z").getTime();

  it("deve retornar não expirado para rotas a pé", () => {
    const walkRoute: RouteItemLike = {
      summary: {
        isWalkingOnly: true,
        leaveHomeDateTime: "2026-10-03T10:00:00.000Z",
      },
    };

    const timing = calculateRouteTiming(walkRoute, baseTime);
    expect(timing.isExpired).toBe(false);
    expect(timing.canStillCatch).toBe(true);
  });

  it("deve retornar não expirado para rotas sem horário de saída definido", () => {
    const route: RouteItemLike = {
      summary: {
        leaveHomeDateTime: undefined,
      },
    };

    const timing = calculateRouteTiming(route, baseTime);
    expect(timing.isExpired).toBe(false);
    expect(timing.canStillCatch).toBe(true);
  });

  it("deve manter rota ativa quando o usuário estiver adiantado (futuro)", () => {
    // Ônibus sai às 11:45, usuário deve sair às 11:40 (5 min a pé). Relógio está em 11:27.
    const route: RouteItemLike = {
      summary: {
        leaveHomeDateTime: "2026-10-03T11:40:00.000Z",
        beAtStopDateTime: "2026-10-03T11:45:00.000Z",
        initialWalkTimeMin: 5,
      },
    };

    const timing = calculateRouteTiming(route, baseTime);
    expect(timing.isExpired).toBe(false);
    expect(timing.canStillCatch).toBe(true);
    expect(timing.minutesUntilLeave).toBe(13); // 11:40 - 11:27
  });

  it("deve permitir pegar o ônibus se estiver exatamente no horário de saída (11:27)", () => {
    // Saída: 11:27, Ônibus: 11:30, Caminhada: 3 min. Relógio: 11:27.
    const route: RouteItemLike = {
      summary: {
        leaveHomeDateTime: "2026-10-03T11:27:00.000Z",
        beAtStopDateTime: "2026-10-03T11:30:00.000Z",
        initialWalkTimeMin: 3,
      },
    };

    const timing = calculateRouteTiming(route, baseTime);
    expect(timing.isExpired).toBe(false);
    expect(timing.canStillCatch).toBe(true);
    expect(timing.statusMessage).toBe("Saia agora para o ponto");
  });

  it("deve permitir com tolerância rápida se passou 1 minuto mas ainda dá para alcançar", () => {
    // Relógio: 11:28. Saída era 11:27, ônibus 11:30, caminhada 3 min.
    // 11:28 + 3 min = 11:31 (dentro de 11:30 + 1 min de tolerância de passo rápido)
    const now1128 = new Date("2026-10-03T11:28:00.000Z").getTime();
    const route: RouteItemLike = {
      summary: {
        leaveHomeDateTime: "2026-10-03T11:27:00.000Z",
        beAtStopDateTime: "2026-10-03T11:30:00.000Z",
        initialWalkTimeMin: 3,
      },
    };

    const timing = calculateRouteTiming(route, now1128);
    expect(timing.isExpired).toBe(false);
    expect(timing.canStillCatch).toBe(true);
  });

  it("deve expirar quando o tempo a pé exceder o horário de partida do ônibus (sem tempo físico)", () => {
    // Relógio: 11:29. Ônibus passa 11:30. Caminhada necessária: 3 min (chegaria 11:32).
    const now1129 = new Date("2026-10-03T11:29:30.000Z").getTime();
    const route: RouteItemLike = {
      summary: {
        leaveHomeDateTime: "2026-10-03T11:27:00.000Z",
        beAtStopDateTime: "2026-10-03T11:30:00.000Z",
        initialWalkTimeMin: 3,
      },
    };

    const timing = calculateRouteTiming(route, now1129);
    expect(timing.isExpired).toBe(true);
    expect(timing.canStillCatch).toBe(false);
    expect(timing.reason).toBe("walk_time_exceeded");
  });

  it("deve expirar quando o ônibus já tiver partido do ponto (horário passou)", () => {
    // Relógio: 11:31. Ônibus passou 11:30.
    const now1131 = new Date("2026-10-03T11:31:00.000Z").getTime();
    const route: RouteItemLike = {
      summary: {
        leaveHomeDateTime: "2026-10-03T11:27:00.000Z",
        beAtStopDateTime: "2026-10-03T11:30:00.000Z",
        initialWalkTimeMin: 3,
      },
    };

    const timing = calculateRouteTiming(route, now1131);
    expect(timing.isExpired).toBe(true);
    expect(timing.canStillCatch).toBe(false);
    expect(timing.reason).toBe("bus_already_left");
  });

  it("deve expirar se já passaram mais de 5 minutos do horário que era para sair", () => {
    // Saída era 11:20. Relógio: 11:26.
    const now1126 = new Date("2026-10-03T11:26:00.000Z").getTime();
    const route: RouteItemLike = {
      summary: {
        leaveHomeDateTime: "2026-10-03T11:20:00.000Z",
        beAtStopDateTime: "2026-10-03T11:35:00.000Z",
        initialWalkTimeMin: 2,
      },
    };

    const timing = calculateRouteTiming(route, now1126);
    expect(timing.isExpired).toBe(true);
    expect(timing.reason).toBe("leave_time_passed");
  });

  describe("findNextViableRouteIndex", () => {
    it("deve encontrar a próxima rota válida quando a rota 0 expirou", () => {
      const now = new Date("2026-10-03T11:31:00.000Z").getTime();
      const routes: RouteItemLike[] = [
        {
          tag: "Recomendada",
          summary: {
            leaveHomeDateTime: "2026-10-03T11:27:00.000Z",
            beAtStopDateTime: "2026-10-03T11:30:00.000Z",
            initialWalkTimeMin: 3,
          },
        },
        {
          tag: "Mais rápida",
          summary: {
            leaveHomeDateTime: "2026-10-03T11:40:00.000Z",
            beAtStopDateTime: "2026-10-03T11:45:00.000Z",
            initialWalkTimeMin: 5,
          },
        },
      ];

      const nextIdx = findNextViableRouteIndex(routes, 0, now);
      expect(nextIdx).toBe(1);
    });

    it("deve retornar null se todas as opções estiverem expiradas", () => {
      const now = new Date("2026-10-03T12:00:00.000Z").getTime();
      const routes: RouteItemLike[] = [
        {
          summary: {
            leaveHomeDateTime: "2026-10-03T11:27:00.000Z",
            beAtStopDateTime: "2026-10-03T11:30:00.000Z",
          },
        },
        {
          summary: {
            leaveHomeDateTime: "2026-10-03T11:40:00.000Z",
            beAtStopDateTime: "2026-10-03T11:45:00.000Z",
          },
        },
      ];

      const nextIdx = findNextViableRouteIndex(routes, 0, now);
      expect(nextIdx).toBeNull();
      expect(hasAnyViableRoute(routes, now)).toBe(false);
    });
  });
});
