/**
 * Mapeador para enriquecer as respostas dos endpoints de jornada com campos conversacionais (voice-first).
 * Mantém total compatibilidade com o formato legado da API.
 */

function toConversationalPlan(planResult, session = null) {
  if (!planResult) return planResult;

  const speechText = planResult.voice?.shortMessage || "Rota calculada com sucesso.";
  const sessionId = session ? session.sessionId : "";
  const conversationState = session ? session.currentState : "JOURNEY_DISPLAYED";

  return {
    ...planResult,
    speechText,
    screen: "JOURNEY_DISPLAY",
    displayData: {
      title: "Rota de Ônibus Encontrada",
      subtitle: planResult.summary ? `${planResult.summary.totalDurationMin} min • ${planResult.summary.busLines.join(", ")}` : "",
      items: planResult.summary ? [
        { label: "Saída de casa", value: planResult.summary.leaveHomeAt },
        { label: "Embarque no ponto", value: planResult.summary.beAtStopAt },
        { label: "Chegada ao destino", value: planResult.summary.arrivalAtDestination },
      ] : [],
    },
    options: planResult.alternatives ? planResult.alternatives.map((alt, idx) => `Opção ${idx + 2}`) : [],
    expectedInput: "NONE",
    conversationState,
    actions: ["REPEAT", "CANCEL"],
    metadata: {
      ...planResult.metadata,
      sessionId,
      selectedRouteIndex: planResult.metadata?.selectedRouteIndex || 0,
      alternativesFound: planResult.metadata?.alternativesFound || 1,
    },
  };
}

function toConversationalResolve(resolveResult, session = null) {
  if (!resolveResult) return resolveResult;

  const mode = resolveResult.mode;
  let speechText = resolveResult.voice?.confirmationQuestion || resolveResult.message || "Destino processado.";
  let expectedInput = "VOICE_OR_TOUCH";
  let conversationState = session ? session.currentState : "IDLE";
  let sessionId = session ? session.sessionId : "";
  let actions = ["CANCEL"];
  let screen = "DESTINATION_RESOLVE";

  if (!session) {
    if (mode === "suggestions") {
      conversationState = "WAITING_DESTINATION_SELECTION";
    } else if (mode === "resolved") {
      conversationState = "WAITING_CONFIRMATION";
    } else if (mode === "not_found") {
      conversationState = "WAITING_DESTINATION";
    }
  }

  if (conversationState === "WAITING_DESTINATION_SELECTION") {
    expectedInput = "VOICE_OR_TOUCH";
    actions = ["SELECT_OPTION", "CANCEL"];
    screen = "SUGGESTIONS_LIST";
  } else if (conversationState === "WAITING_CONFIRMATION") {
    expectedInput = "VOICE_OR_TOUCH";
    actions = ["CONFIRM", "CANCEL", "REPEAT"];
    screen = "DESTINATION_CONFIRMATION";
  } else if (conversationState === "WAITING_DESTINATION") {
    expectedInput = "VOICE_OR_TOUCH";
    actions = ["CANCEL"];
    screen = "DESTINATION_RESOLVE";
  }

  const options = resolveResult.options
    ? resolveResult.options.map((opt) => opt.name)
    : (resolveResult.candidates ? resolveResult.candidates.map((c) => c.name) : []);

  return {
    ...resolveResult,
    speechText,
    screen,
    displayData: {
      title: conversationState === "WAITING_DESTINATION_SELECTION" ? "Selecione uma opção" : (conversationState === "WAITING_CONFIRMATION" ? "Confirmar destino" : "Pesquisar destino"),
      subtitle: resolveResult.interpretedDestination || "",
      items: resolveResult.options
        ? resolveResult.options.slice(0, 5).map((opt) => ({ name: opt.name, address: opt.address }))
        : (resolveResult.candidates ? resolveResult.candidates.slice(0, 5).map((c) => ({ name: c.name, address: c.address })) : []),
    },
    options,
    expectedInput,
    conversationState,
    actions,
    metadata: {
      ...resolveResult.metadata,
      sessionId,
      mode,
      queryType: resolveResult.queryType,
    },
  };
}

module.exports = {
  toConversationalPlan,
  toConversationalResolve,
};
