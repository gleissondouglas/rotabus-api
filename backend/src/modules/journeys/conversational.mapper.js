/**
 * Mapeador para enriquecer as respostas dos endpoints de jornada com campos conversacionais (voice-first).
 * Mantém total compatibilidade com o formato legado da API.
 */

function toConversationalPlan(planResult) {
  if (!planResult) return planResult;

  const speechText = planResult.voice?.shortMessage || "Rota calculada com sucesso.";

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
    conversationState: "JOURNEY_DISPLAYED",
    actions: ["REPEAT", "CANCEL"],
    metadata: {
      selectedRouteIndex: planResult.metadata?.selectedRouteIndex || 0,
      alternativesFound: planResult.metadata?.alternativesFound || 1,
    },
  };
}

function toConversationalResolve(resolveResult) {
  if (!resolveResult) return resolveResult;

  const mode = resolveResult.mode;
  let speechText = resolveResult.voice?.confirmationQuestion || resolveResult.message || "Destino processado.";
  let expectedInput = "VOICE_OR_TOUCH";
  let conversationState = "IDLE";
  let actions = ["CANCEL"];
  let screen = "DESTINATION_RESOLVE";

  if (mode === "suggestions") {
    expectedInput = "VOICE_OR_TOUCH";
    conversationState = "WAITING_DESTINATION_SELECTION";
    actions = ["SELECT_OPTION", "CANCEL"];
    screen = "SUGGESTIONS_LIST";
  } else if (mode === "resolved") {
    expectedInput = "VOICE_OR_TOUCH";
    conversationState = "WAITING_CONFIRMATION";
    actions = ["CONFIRM", "CANCEL", "REPEAT"];
    screen = "DESTINATION_CONFIRMATION";
  }

  const options = resolveResult.options
    ? resolveResult.options.map((opt) => opt.name)
    : (resolveResult.candidates ? resolveResult.candidates.map((c) => c.name) : []);

  return {
    ...resolveResult,
    speechText,
    screen,
    displayData: {
      title: mode === "suggestions" ? "Selecione uma opção" : "Confirmar destino",
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
      mode,
      queryType: resolveResult.queryType,
    },
  };
}

module.exports = {
  toConversationalPlan,
  toConversationalResolve,
};
