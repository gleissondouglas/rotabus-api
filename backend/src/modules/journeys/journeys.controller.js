const journeysService = require("./journeys.service");
const { 
  validatePlanJourneyInput, 
  validateResolveDestinationInput 
} = require("./journeys.validator");

async function planJourney(req, res, next) {
  try {
    // Valida os dados de entrada antes de passar para o serviço
    const validatedData = validatePlanJourneyInput(req.body);

    const result = await journeysService.planJourney(validatedData);

    return res.status(200).json(result);
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
    const { text, origin } = req.body || {};
    const userId = req.user?.id || "Deslogado";

    if (process.env.NODE_ENV !== "production") {
      console.log(`[JourneysController] POST /resolve-destination solicitado pelo userId: ${userId}`);
    }

    // Valida os dados de entrada (texto e origem)
    const validatedData = validateResolveDestinationInput({ text, origin });

    const result = await journeysService.resolveDestinationService(validatedData);

    return res.status(200).json(result);
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
