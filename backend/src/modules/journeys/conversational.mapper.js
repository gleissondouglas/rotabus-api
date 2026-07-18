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
      subtitle: planResult.summary
        ? `${planResult.summary.totalDurationMin} min • ${planResult.summary.busLines.join(", ")}`
        : "",
      items: planResult.summary
        ? [
            { label: "Saída de casa", value: planResult.summary.leaveHomeAt },
            { label: "Embarque no ponto", value: planResult.summary.beAtStopAt },
            { label: "Chegada ao destino", value: planResult.summary.arrivalAtDestination },
          ]
        : [],
    },
    options: planResult.alternatives
      ? planResult.alternatives.map((alt, idx) => `Opção ${idx + 2}`)
      : [],
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
  let speechText =
    resolveResult.voice?.confirmationQuestion || resolveResult.message || "Destino processado.";
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
  } else if (conversationState === "WAITING_TIME_SELECTION") {
    expectedInput = "VOICE_OR_TOUCH";
    actions = ["SELECT_TIME", "CANCEL"];
    screen = "TIME_SELECTION";
  }

  const options = resolveResult.options
    ? resolveResult.options.map((opt) => opt.name)
    : resolveResult.candidates
      ? resolveResult.candidates.map((c) => c.name)
      : [];

  return {
    ...resolveResult,
    speechText,
    screen,
    displayData: {
      title:
        conversationState === "WAITING_DESTINATION_SELECTION"
          ? "Selecione uma opção"
          : conversationState === "WAITING_CONFIRMATION"
            ? "Confirmar destino"
            : conversationState === "WAITING_TIME_SELECTION"
              ? "Confirmar horário"
              : "Pesquisar destino",
      subtitle: resolveResult.interpretedDestination || "",
      items: resolveResult.options
        ? resolveResult.options.slice(0, 5).map((opt) => ({ name: opt.name, address: opt.address }))
        : resolveResult.candidates
          ? resolveResult.candidates.slice(0, 5).map((c) => ({ name: c.name, address: c.address }))
          : [],
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

function toConversationalCommand(result, requestBody = {}) {
  if (!result) return null;

  const sessionId = requestBody.sessionId || "";
  const command = result.command;
  const currentState = result.currentState;

  let speechText = "Comando processado.";
  let screen = "DESTINATION_RESOLVE";
  let displayData = { title: "Pesquisar destino", subtitle: "", items: [] };
  let options = [];
  let expectedInput = "VOICE_OR_TOUCH";
  let actions = ["CANCEL"];

  if (command === "CANCEL") {
    speechText = "Interação cancelada.";
    screen = "DESTINATION_RESOLVE";
    displayData = { title: "Pesquisar destino", subtitle: "", items: [] };
    options = [];
    expectedInput = "VOICE_OR_TOUCH";
    actions = ["CANCEL"];
  } else if (command === "REPEAT") {
    if (currentState === "WAITING_CONFIRMATION") {
      speechText = "Repetindo: é esse o destino que você deseja?";
      screen = "DESTINATION_CONFIRMATION";
      displayData = { title: "Confirmar destino", subtitle: "", items: [] };
      options = [];
      expectedInput = "VOICE_OR_TOUCH";
      actions = ["CONFIRM", "CANCEL", "REPEAT"];
    } else if (currentState === "WAITING_DESTINATION_SELECTION") {
      speechText = "Repetindo as opções: qual delas você prefere?";
      screen = "SUGGESTIONS_LIST";
      displayData = { title: "Selecione uma opção", subtitle: "", items: [] };
      options = [];
      expectedInput = "VOICE_OR_TOUCH";
      actions = ["SELECT_OPTION", "CANCEL"];
    } else {
      speechText = "Repetindo o último passo.";
      screen = "DESTINATION_RESOLVE";
      displayData = { title: "Pesquisar destino", subtitle: "", items: [] };
      options = [];
      expectedInput = "VOICE_OR_TOUCH";
      actions = ["CANCEL"];
    }
  } else if (command === "CONFIRM") {
    speechText = "Destino confirmado. Exibindo a melhor rota.";
    screen = "JOURNEY_DISPLAY";
    displayData = { title: "Rota de Ônibus Encontrada", subtitle: "", items: [] };
    options = [];
    expectedInput = "NONE";
    actions = ["REPEAT", "CANCEL"];
  } else if (command === "SELECT_OPTION") {
    speechText = "Opção selecionada. Exibindo a melhor rota.";
    screen = "JOURNEY_DISPLAY";
    displayData = { title: "Rota de Ônibus Encontrada", subtitle: "", items: [] };
    options = [];
    expectedInput = "NONE";
    actions = ["REPEAT", "CANCEL"];
  } else if (command === "SELECT_TIME") {
    speechText = "Horário confirmado. Exibindo a melhor rota.";
    screen = "JOURNEY_DISPLAY";
    displayData = { title: "Rota de Ônibus Encontrada", subtitle: "", items: [] };
    options = [];
    expectedInput = "NONE";
    actions = ["REPEAT", "CANCEL"];
  }

  return {
    speechText,
    screen,
    displayData,
    options,
    expectedInput,
    conversationState: currentState,
    actions,
    metadata: {
      sessionId: result.sessionDeleted ? "" : sessionId,
      command,
      previousState: result.previousState,
      currentState,
    },
  };
}

module.exports = {
  toConversationalPlan,
  toConversationalResolve,
  toConversationalCommand,
};
