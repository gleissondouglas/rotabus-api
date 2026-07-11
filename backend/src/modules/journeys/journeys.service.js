const {
  validatePlanJourneyInput,
  validateResolveDestinationInput,
} = require("./journeys.validator");
const {
  computeTransitRoute,
  computeWalkingRoute,
} = require("./providers/routes.provider");
const { mapGoogleRouteToJourney } = require("./journey.mapper");
const { findCachedRoute, createRouteCache } = require("./route-cache");
const {
  getAddressFromCoordinates,
  geocodeAddress,
} = require("./providers/geocoding.provider");
const speechProvider = require("./providers/speech.provider");
const destinationProvider = require("./providers/destination.provider");

const localIntelligenceService = require("./local-intelligence/local-intelligence.service");

async function resolveDestinationService({ text, origin }) {
  const validatedData = validateResolveDestinationInput({ text, origin });

  const interpretedDestination = localIntelligenceService.cleanDestinationText(validatedData.text);
  const aliasedDestination = localIntelligenceService.applyLocalAliases(interpretedDestination);
  const queryType = localIntelligenceService.guessQueryType(aliasedDestination);

  let candidates = [];

  const contextStr = ", Uberaba, MG, Brasil";
  const searchStr = aliasedDestination.includes("Uberaba")
    ? aliasedDestination
    : `${aliasedDestination}${contextStr}`;

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[ResolveDestination] Tipo inferido: ${queryType} | Texto original: ${aliasedDestination}`,
    );
  }

  // ESTRATÉGIA PRIORITÁRIA: Google Places para POIs, Categorias Genéricas ou se o tipo for desconhecido
  if (
    queryType === "specific_place" ||
    queryType === "generic_category" ||
    queryType === "unknown"
  ) {
    const placeResults = await destinationProvider.searchPlaces(
      aliasedDestination,
      validatedData.origin,
    );
    candidates = placeResults
      .map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        type: "place",
        primaryType: p.types && p.types.length > 0 ? p.types[0] : "unknown",
        source: "GOOGLE_PLACES",
        distanceMeters: p.distanceMeters || 0,
        isUberaba: p.address ? p.address.includes("Uberaba") : true,
        isGenericCityResult: localIntelligenceService.checkIfGenericCity(p.name, p.address),
      }))
      .filter((p) => p.isUberaba);
  }

  // FALLBACK OU COMPLEMENTO: Geocoding para endereços puros ou se Places não achou nada
  if (
    queryType === "address" ||
    (candidates.length === 0 &&
      queryType !== "specific_place" &&
      queryType !== "generic_category")
  ) {
    const geocodeResults = await geocodeAddress(searchStr);
    const geocodeCandidates = geocodeResults
      .filter((r) => r.isUberaba)
      .map((r) => ({
        ...r,
        isGenericCityResult: localIntelligenceService.checkIfGenericCity(r.name, r.address),
      }));

    if (queryType === "address") {
      candidates = geocodeCandidates;
    } else {
      if (candidates.length === 0) {
        candidates = geocodeCandidates;
      }
    }
  }

  if (candidates.length === 0) {
    return {
      mode: "not_found",
      queryType,
      message: "Não encontrei esse lugar.",
      resolvedDestination: null,
      candidates: [],
      voice: {
        confirmationQuestion:
          "Não encontrei esse lugar. Tente falar de forma diferente.",
      },
    };
  }

  // 4. Pós-processamento de Confiança
  candidates = candidates.map((c) => ({
    ...c,
    confidence: localIntelligenceService.evaluateConfidence(aliasedDestination, c, queryType),
  }));

  // Ordena por confiança
  candidates.sort((a, b) => {
    const score = { high: 3, medium: 2, low: 1 };
    return score[b.confidence] - score[a.confidence];
  });

  const bestOption = candidates[0];
  const isGeneric = bestOption.isGenericCityResult;
  const confidence = bestOption.confidence;

  // Decide o Mode
  const shouldAskForKnownTerm = localIntelligenceService.shouldShowOptionsForKnownTerm(
    interpretedDestination,
    candidates,
  );

  const showSuggestions =
    shouldAskForKnownTerm ||
    (isGeneric && candidates.length > 1) ||
    confidence === "low" ||
    queryType === "generic_category";
  const mode = showSuggestions ? "suggestions" : "resolved";

  let message = "Destino encontrado.";
  let confirmationQuestion = `Encontrei ${bestOption.name}. É esse o lugar?`;

  if (mode === "suggestions") {
    if (queryType === "generic_category") {
      message = `Encontrei opções de ${aliasedDestination.toLowerCase()} próximos.`;
      confirmationQuestion = `Encontrei algumas opções de ${aliasedDestination.toLowerCase()}. Qual delas é o seu destino correto?`;
    } else {
      message = "Encontrei algumas opções. Escolha o destino correto.";
      confirmationQuestion = `Encontrei algumas opções. Qual delas é o seu destino correto?`;
    }
  } else if (confidence === "medium") {
    confirmationQuestion = `Não tenho certeza absoluta. Encontrei ${bestOption.name}. É esse mesmo?`;
  }

  return {
    mode,
    queryType,
    message,
    resolvedDestination: mode === "resolved" ? bestOption : null,
    candidates: mode === "suggestions" ? candidates.slice(0, 5) : [],
    // Mantendo compatibilidade com o frontend atual que usa 'options'
    interpretedDestination,
    options: candidates,
    voice: {
      confirmationQuestion,
    },
  };
}

async function planJourney({
  origin,
  destination,
  departureTime,
  timePreference,
}) {
  const validatedData = validatePlanJourneyInput({
    origin,
    destination,
    departureTime,
    timePreference,
  });

  // Criar uma chave única para o cache baseada na origem, destino, tipo de preferência de horário e a própria data/hora
  const cacheKey = `${validatedData.origin.lat},${validatedData.origin.lng}-${validatedData.destination.text}-${validatedData.timePreference.type}-${validatedData.timePreference.dateTime}`;

  // Tentar buscar do cache primeiro para economizar chamadas à API do Google
  const cachedResult = findCachedRoute(cacheKey);

  if (cachedResult) {
    if (process.env.NODE_ENV !== "production") {
      console.log("Retornando rota do cache para a chave:", cacheKey);
    }
    return {
      journey: mapGoogleRouteToJourney(
        cachedResult.googleResponse,
        validatedData.origin,
        cachedResult.timePreference,
      ),
      source: "CACHE",
    };
  }

  // Se não estiver no cache, chama a API do Google
  const googleResponse = await computeTransitRoute({
    origin: validatedData.origin,
    destination: validatedData.destination,
    timePreference: validatedData.timePreference,
  });

  // ENRIQUECIMENTO: Garantir rota a pé detalhada até o primeiro ponto
  try {
    if (
      googleResponse &&
      googleResponse.routes &&
      googleResponse.routes.length > 0
    ) {
      for (const route of googleResponse.routes) {
        if (!route.legs || route.legs.length === 0) continue;

        const firstLeg = route.legs[0];
        const firstTransitStep = firstLeg.steps?.find(
          (s) => s.travelMode === "TRANSIT",
        );

        if (
          firstTransitStep &&
          firstTransitStep.transitDetails?.stopDetails?.departureStop?.location
            ?.latLng
        ) {
          const stopLoc =
            firstTransitStep.transitDetails.stopDetails.departureStop.location
              .latLng;

          // Busca rota a pé dedicada do usuário até este ponto
          const walkingResponse = await computeWalkingRoute({
            origin: validatedData.origin,
            destination: { lat: stopLoc.latitude, lng: stopLoc.longitude },
          });

          if (
            walkingResponse &&
            walkingResponse.routes &&
            walkingResponse.routes.length > 0
          ) {
            const walkingRoute = walkingResponse.routes[0];
            const walkingSteps = walkingRoute.legs?.[0]?.steps || [];

            if (walkingSteps.length > 0) {
              // Remove passos de caminhada iniciais do Google Transit (se houver) para evitar duplicidade
              const originalSteps = firstLeg.steps || [];
              const firstTransitIndex = originalSteps.findIndex(
                (s) => s.travelMode === "TRANSIT",
              );

              const transitAndBeyond =
                firstTransitIndex !== -1
                  ? originalSteps.slice(firstTransitIndex)
                  : originalSteps;

              // Injeta os passos detalhados da rota WALK dedicada
              firstLeg.steps = [...walkingSteps, ...transitAndBeyond];

              if (process.env.NODE_ENV !== "production") {
                console.log(
                  `[Journeys] Rota enriquecida com ${walkingSteps.length} passos de caminhada detalhados.`,
                );
              }
            }
          }
        }
      }
    }
  } catch (enrichError) {
    console.error(
      "[Journeys] Erro ao enriquecer rota com caminhada:",
      enrichError.message,
    );
    // Continua com a rota original se o enriquecimento falhar
  }

  // Mantém a resposta por dois minutos na memória do processo.
  createRouteCache({
    cacheKey,
    googleResponse,
    timePreference: validatedData.timePreference,
  });

  return {
    journey: mapGoogleRouteToJourney(
      googleResponse,
      validatedData.origin,
      validatedData.timePreference,
    ),
    source: "PROVIDER",
  };
}

async function reverseGeocodeService({ lat, lng }) {
  if (lat === undefined || lng === undefined) {
    const error = new Error("Latitude e longitude são obrigatórias.");
    error.statusCode = 400;
    throw error;
  }

  const address = await getAddressFromCoordinates(lat, lng);

  return {
    address,
  };
}

async function transcribeAudioService({ audioBase64, mimeType }) {
  if (!audioBase64) {
    const error = new Error("Áudio em base64 é obrigatório.");
    error.statusCode = 400;
    throw error;
  }

  const transcript = await speechProvider.transcribe(
    audioBase64,
    mimeType,
  );

  return {
    text: transcript,
  };
}

module.exports = {
  planJourney,
  reverseGeocodeService,
  transcribeAudioService,
  resolveDestinationService,
};
