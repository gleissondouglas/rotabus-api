const sessionManager = require("./session.manager");
const dialogManager = require("./dialog.manager");

/**
 * Handler responsável por interpretar e processar comandos conversacionais recebidos do frontend.
 * 
 * @param {Object} params
 * @param {string|number} params.userId - Identificador do usuário.
 * @param {string} params.sessionId - Identificador da sessão conversacional.
 * @param {string} params.command - O comando a ser executado (CANCEL, REPEAT, CONFIRM, SELECT_OPTION).
 * @param {Object} [params.payload] - Dados adicionais úteis para o processamento do comando.
 * @returns {Object} O resultado do processamento contendo a sessão atualizada e status.
 */
function handleCommand({ userId, sessionId, command, payload = {} }) {
  if (!sessionId) {
    throw new Error("O sessionId é obrigatório para processar comandos conversacionais.");
  }

  if (!command) {
    throw new Error("O comando é obrigatório para processar comandos conversacionais.");
  }

  // Busca a sessão conversacional ativa
  const session = sessionManager.getSession({ userId, sessionId });
  if (!session) {
    throw new Error("Sessão conversacional não encontrada ou expirada.");
  }

  const previousState = session.currentState;
  let nextState = previousState;
  let responsePayload = {
    success: true,
    command,
    previousState,
    currentState: previousState,
    repeatTriggered: false,
    sessionDeleted: false,
  };

  switch (command.toUpperCase()) {
    case "CANCEL":
      // Transiciona o estado lógico para IDLE
      nextState = dialogManager.transition(previousState, dialogManager.EVENTS.CANCEL);
      
      // Deleta a sessão ou a atualiza. Optamos por remover a sessão para limpar o contexto
      sessionManager.deleteSession({ userId, sessionId });
      
      responsePayload.currentState = nextState;
      responsePayload.sessionDeleted = true;
      break;

    case "REPEAT":
      // Mantém o estado atual da conversa
      // O getSession chamado acima já atualizou o timestamp deslizante (sliding TTL)
      responsePayload.repeatTriggered = true;
      break;

    case "CONFIRM":
      if (previousState !== dialogManager.STATES.WAITING_CONFIRMATION) {
        throw new Error(`Comando CONFIRM inválido para o estado atual: ${previousState}`);
      }

      // Transiciona a FSM de WAITING_CONFIRMATION para JOURNEY_DISPLAYED
      nextState = dialogManager.transition(previousState, dialogManager.EVENTS.CONFIRM);
      
      sessionManager.updateSession({
        userId,
        sessionId,
        patch: { 
          currentState: nextState,
          metadata: { ...session.metadata, confirmedAt: Date.now() }
        }
      });
      
      responsePayload.currentState = nextState;
      break;

    case "SELECT_OPTION":
      if (previousState !== dialogManager.STATES.WAITING_DESTINATION_SELECTION) {
        throw new Error(`Comando SELECT_OPTION inválido para o estado atual: ${previousState}`);
      }

      // Transiciona a FSM de WAITING_DESTINATION_SELECTION para JOURNEY_DISPLAYED
      nextState = dialogManager.transition(previousState, dialogManager.EVENTS.OPTION_SELECTED);
      
      sessionManager.updateSession({
        userId,
        sessionId,
        patch: { 
          currentState: nextState,
          metadata: { 
            ...session.metadata, 
            selectedOptionIndex: payload.optionIndex !== undefined ? payload.optionIndex : null,
            selectedOptionName: payload.optionName || null,
            selectedAt: Date.now()
          }
        }
      });
      
      responsePayload.currentState = nextState;
      break;

    default:
      throw new Error(`Comando conversacional desconhecido ou não suportado: ${command}`);
  }

  return responsePayload;
}

module.exports = {
  handleCommand,
};
