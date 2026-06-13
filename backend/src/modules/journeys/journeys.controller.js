const journeysService = require("./journeys.service");
const conversationalMapper = require("./conversational.mapper");

async function planJourney(req, res, next) {
  try {
    // req.body já vem validado e normalizado pelo validateMiddleware
    const result = await journeysService.planJourney(req.body);
    const enrichedResult = conversationalMapper.toConversationalPlan(result);

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
      console.log(`[JourneysController] MimeType: ${mimeType}, Base64 Length: ${audioBase64?.length || 0}`);
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
    const userId = req.user?.id || "Deslogado";

    if (process.env.NODE_ENV !== "production") {
      console.log(`[JourneysController] POST /resolve-destination solicitado pelo userId: ${userId}`);
    }

    // req.body já vem validado e normalizado pelo validateMiddleware
    const result = await journeysService.resolveDestinationService(req.body);
    const enrichedResult = conversationalMapper.toConversationalResolve(result);

    return res.status(200).json(enrichedResult);
  } catch (error) {
    console.error(`[JourneysController] Erro na resolução de destino:`, error.message);
    next(error);
  }
}

module.exports = {
  planJourney,
  reverseGeocode,
  transcribeAudio,
  resolveDestination,
};
