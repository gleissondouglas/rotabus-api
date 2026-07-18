const journeysService = require("./journeys.service");
const conversationalMapper = require("./conversational.mapper");
const sessionManager = require("./dialog/session.manager");
const dialogManager = require("./dialog/dialog.manager");
const conversationCommandHandler = require("./dialog/conversation-command.handler");
const { recordDailyJourneyUsage } = require("../../shared/middlewares/dailyLimit.middleware");

async function planJourney(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || null;

    let session = await sessionManager.getSession({ userId, sessionId });
    if (!session) {
      session = await sessionManager.createSession({ userId });
    }

    // req.body já vem validado e normalizado pelo validateMiddleware
    const planResult = await journeysService.planJourney(req.body);
    const result = planResult.journey;

    if (planResult.source === "PROVIDER") {
      await recordDailyJourneyUsage(req);
    }

    // Transição de estado FSM
    let event = dialogManager.EVENTS.DESTINATION_RESOLVED;
    if (session.currentState === dialogManager.STATES.WAITING_CONFIRMATION) {
      event = dialogManager.EVENTS.CONFIRM;
    } else if (session.currentState === dialogManager.STATES.WAITING_DESTINATION_SELECTION) {
      event = dialogManager.EVENTS.OPTION_SELECTED;
    }

    const nextState = dialogManager.transition(session.currentState, event);
    session = await sessionManager.updateSession({
      userId,
      sessionId: session.sessionId,
      patch: { currentState: nextState },
    });

    const enrichedResult = conversationalMapper.toConversationalPlan(result, session);

    return res.status(200).json(enrichedResult);
  } catch (error) {
    next(error);
  }
}

async function reverseGeocode(req, res, next) {
  try {
    const { lat, lng } = req.query;

    const result = await journeysService.reverseGeocodeService({
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function transcribeAudio(req, res, next) {
  try {
    const { audioBase64, mimeType } = req.body || {};
    const userId = req.user?.id || "Deslogado";

    if (process.env.NODE_ENV !== "production") {
      console.log(`[JourneysController] POST /transcribe solicitado pelo userId: ${userId}`);
      console.log(
        `[JourneysController] MimeType: ${mimeType}, Base64 Length: ${audioBase64?.length || 0}`,
      );
    }

    const result = await journeysService.transcribeAudioService({
      audioBase64,
      mimeType,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[JourneysController] Resposta enviada com sucesso para o usuário ${userId}`);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error(`[JourneysController] Erro no processamento de voz:`, error.message);
    next(error);
  }
}

async function resolveDestination(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || null;

    let session = await sessionManager.getSession({ userId, sessionId });
    if (!session) {
      session = await sessionManager.createSession({ userId });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[JourneysController] POST /resolve-destination solicitado pelo userId: ${userId || "Deslogado"} | Session ID: ${session.sessionId}`,
      );
    }

    // req.body já vem validado e normalizado pelo validateMiddleware
    const result = await journeysService.resolveDestinationService(req.body, session);

    // Transição de estado FSM
    let event = dialogManager.EVENTS.START;
    if (result.mode === "suggestions") {
      event = dialogManager.EVENTS.DESTINATION_AMBIGUOUS;
    } else if (result.mode === "resolved") {
      if (
        result.scheduling &&
        result.scheduling.target_datetime === null &&
        result.scheduling.time_mode !== "NOW"
      ) {
        event = dialogManager.EVENTS.TIME_NEEDED;
      } else {
        if (session.currentState === dialogManager.STATES.WAITING_TIME_SELECTION) {
          event = dialogManager.EVENTS.TIME_SELECTED;
        } else {
          event = dialogManager.EVENTS.DESTINATION_NEEDS_CONFIRMATION;
        }
      }
    } else if (result.mode === "not_found") {
      event = dialogManager.EVENTS.ERROR;
    }

    const nextState = dialogManager.transition(session.currentState, event);
    session = await sessionManager.updateSession({
      userId,
      sessionId: session.sessionId,
      patch: { currentState: nextState },
    });

    const enrichedResult = conversationalMapper.toConversationalResolve(result, session);

    return res.status(200).json(enrichedResult);
  } catch (error) {
    console.error(`[JourneysController] Erro na resolução de destino:`, error.message);
    next(error);
  }
}

async function handleConversationCommand(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const { sessionId, command, payload } = req.body;

    const result = await conversationCommandHandler.handleCommand({
      userId,
      sessionId,
      command,
      payload,
    });

    const enrichedResult = conversationalMapper.toConversationalCommand(result, req.body);

    return res.status(200).json(enrichedResult);
  } catch (error) {
    error.statusCode = error.statusCode || 400;
    next(error);
  }
}

async function parseTimeIntent(req, res, next) {
  try {
    const { text } = req.body;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[JourneysController] POST /parse-time | texto: "${text}"`);
    }

    const result = await journeysService.parseTimeIntentService({ text });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[JourneysController] Erro no parse-time:", error.message);
    next(error);
  }
}

module.exports = {
  planJourney,
  reverseGeocode,
  transcribeAudio,
  resolveDestination,
  handleConversationCommand,
  parseTimeIntent,
};
