/**
 * Utilitário de cálculo de pontualidade e expiração de rotas de transporte público.
 * Avalia em tempo real se o passageiro ainda tem tempo hábil para caminhar
 * até o ponto e embarcar no ônibus antes da partida prevista.
 */

export interface RouteTimingInfo {
  isExpired: boolean;
  canStillCatch: boolean;
  minutesUntilLeave: number;
  minutesUntilBus: number;
  reason?: "bus_already_left" | "walk_time_exceeded" | "leave_time_passed" | null;
  statusMessage: string;
}

export interface RouteItemLike {
  tag?: string;
  summary?: {
    isWalkingOnly?: boolean;
    leaveHomeDateTime?: string;
    beAtStopDateTime?: string;
    leaveHomeAt?: string;
    beAtStopAt?: string;
    initialWalkTimeMin?: number;
    arrivalAtDestination?: string;
    [key: string]: any;
  } | null;
  steps?: Array<{
    type: string;
    departureTime?: string;
    departureDateTime?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

/**
 * Calcula a pontualidade de uma rota em relação ao momento atual (nowMs).
 */
export function calculateRouteTiming(
  route: RouteItemLike | null | undefined,
  nowMs: number = Date.now()
): RouteTimingInfo {
  // Rotas inexistentes ou indefinidas
  if (!route || !route.summary) {
    return {
      isExpired: false,
      canStillCatch: true,
      minutesUntilLeave: 0,
      minutesUntilBus: 0,
      reason: null,
      statusMessage: "Horário não informado",
    };
  }

  // 1. Viagens puramente a pé não expiram por horário fixo de ônibus
  if (route.summary.isWalkingOnly) {
    return {
      isExpired: false,
      canStillCatch: true,
      minutesUntilLeave: 0,
      minutesUntilBus: 0,
      reason: null,
      statusMessage: "Caminhada a qualquer momento",
    };
  }

  const { leaveHomeDateTime, beAtStopDateTime, initialWalkTimeMin = 0 } = route.summary;

  // Se não temos a data completa estruturada de saída, fallback seguro
  if (!leaveHomeDateTime) {
    return {
      isExpired: false,
      canStillCatch: true,
      minutesUntilLeave: 0,
      minutesUntilBus: 0,
      reason: null,
      statusMessage: "Pronto para iniciar",
    };
  }

  const leaveTimeMs = new Date(leaveHomeDateTime).getTime();
  if (isNaN(leaveTimeMs)) {
    return {
      isExpired: false,
      canStillCatch: true,
      minutesUntilLeave: 0,
      minutesUntilBus: 0,
      reason: null,
      statusMessage: "Pronto para iniciar",
    };
  }

  // Horário previsto para o ônibus passar no ponto de embarque
  let busStopMs: number;
  if (beAtStopDateTime) {
    const parsedBusMs = new Date(beAtStopDateTime).getTime();
    busStopMs = isNaN(parsedBusMs) ? leaveTimeMs + initialWalkTimeMin * 60000 : parsedBusMs;
  } else {
    // Tenta obter do primeiro passo de transporte público
    const firstTransit = route.steps?.find((s) => s.type === "transit");
    if (firstTransit?.departureDateTime) {
      const parsedDep = new Date(firstTransit.departureDateTime).getTime();
      busStopMs = isNaN(parsedDep) ? leaveTimeMs + initialWalkTimeMin * 60000 : parsedDep;
    } else {
      busStopMs = leaveTimeMs + initialWalkTimeMin * 60000;
    }
  }

  const minutesUntilLeave = Math.round((leaveTimeMs - nowMs) / 60000);
  const minutesUntilBus = Math.round((busStopMs - nowMs) / 60000);
  const walkMs = initialWalkTimeMin * 60000;

  // Tolerância generosa de 1 minuto caso o usuário caminhe em passo rápido
  const CATCH_TOLERANCE_MS = 60 * 1000;

  // CONDIÇÃO A: O horário previsto do ônibus no ponto já passou
  if (nowMs > busStopMs) {
    return {
      isExpired: true,
      canStillCatch: false,
      minutesUntilLeave,
      minutesUntilBus,
      reason: "bus_already_left",
      statusMessage: "O ônibus já passou do ponto de embarque.",
    };
  }

  // CONDIÇÃO B: Tempo atual + caminhada necessária excede a partida do ônibus (sem tempo físico)
  if (nowMs + walkMs > busStopMs + CATCH_TOLERANCE_MS) {
    return {
      isExpired: true,
      canStillCatch: false,
      minutesUntilLeave,
      minutesUntilBus,
      reason: "walk_time_exceeded",
      statusMessage: "Não dá mais tempo de caminhar até o ponto a tempo.",
    };
  }

  // CONDIÇÃO C: Já se passaram mais de 5 minutos do horário que era para sair de casa
  if (nowMs - leaveTimeMs > 5 * 60 * 1000) {
    return {
      isExpired: true,
      canStillCatch: false,
      minutesUntilLeave,
      minutesUntilBus,
      reason: "leave_time_passed",
      statusMessage: "Horário de saída expirou há mais de 5 minutos.",
    };
  }

  // ROTA AINDA VÁLIDA
  let message = "";
  if (minutesUntilLeave < 0) {
    message = "Ainda dá tempo se sair agora!";
  } else if (minutesUntilLeave === 0) {
    message = "Saia agora para o ponto";
  } else if (minutesUntilLeave === 1) {
    message = "Falta 1 min para sair";
  } else {
    message = `Faltam ${minutesUntilLeave} min para sair`;
  }

  return {
    isExpired: false,
    canStillCatch: true,
    minutesUntilLeave,
    minutesUntilBus,
    reason: null,
    statusMessage: message,
  };
}

/**
 * Encontra o índice da próxima rota viável (não expirada).
 * Se currentIndex for inválido ou a própria rota atual for viável, pode retornar a próxima viável diferente.
 */
export function findNextViableRouteIndex(
  routes: RouteItemLike[],
  currentIndex: number,
  nowMs: number = Date.now()
): number | null {
  if (!routes || routes.length === 0) return null;

  // Primeiro procura pelas rotas seguintes (currentIndex + 1 em diante)
  for (let i = currentIndex + 1; i < routes.length; i++) {
    const timing = calculateRouteTiming(routes[i], nowMs);
    if (!timing.isExpired) {
      return i;
    }
  }

  // Depois procura antes do currentIndex (0 até currentIndex - 1)
  for (let i = 0; i < currentIndex; i++) {
    const timing = calculateRouteTiming(routes[i], nowMs);
    if (!timing.isExpired) {
      return i;
    }
  }

  return null;
}

/**
 * Retorna true se houver pelo menos uma rota viável (não expirada) na lista.
 */
export function hasAnyViableRoute(
  routes: RouteItemLike[],
  nowMs: number = Date.now()
): boolean {
  if (!routes || routes.length === 0) return false;
  return routes.some((r) => !calculateRouteTiming(r, nowMs).isExpired);
}
