const {
  validatePlanJourneyInput,
  validateResolveDestinationInput,
} = require("./journeys.validator");
const {
  computeTransitRoute,
  computeWalkingRoute,
} = require("./providers/routes.provider");
const { mapGoogleRouteToJourney } = require("./journey.mapper");
const { findCachedRoute, createRouteCache } = require("./journeys.repository");
const {
  getAddressFromCoordinates,
  geocodeAddress,
} = require("./providers/geocoding.provider");
const speechProvider = require("./providers/speech.provider");
const destinationProvider = require("./providers/destination.provider");

/**
 * Limpa frases naturais para extrair apenas o destino.
 */
function cleanDestinationText(text) {
  if (!text) return "";

  let cleaned = text.toLowerCase().trim();

  // Remover prefixos comuns de fala
  const prefixes = [
    "me leva para o",
    "me leva para a",
    "me leva para",
    "me leve para o",
    "me leva para a",
    "me leva para",
    "me leve até o",
    "me leve até a",
    "me leve até",
    "quero ir para o",
    "quero ir para a",
    "quero ir para",
    "quero ir até o",
    "quero ir até a",
    "quero ir até",
    "preciso ir para o",
    "preciso ir para a",
    "preciso ir para",
    "ir para",
    "ir até",
    "levar para",
    "levar até",
    "vambora para",
    "bora para",
    "me leva pro",
    "me leva pra",
    "me leve pro",
    "me leve pra",
  ];

  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.replace(prefix, "").trim();
      break;
    }
  }

  // Remover pontuação final
  cleaned = cleaned.replace(/[.!?]$/, "").trim();

  return cleaned;
}

/**
 * Aplica aliases locais para termos comuns em Uberaba.
 */
function applyLocalAliases(text) {
  const aliases = {
    centro: "Praça Rui Barbosa, Uberaba - MG",
    "centro da cidade": "Praça Rui Barbosa, Uberaba - MG",
    uniube: "UNIUBE - Universidade de Uberaba, Uberaba - MG",
    "mario palmerio": "Hospital Mário Palmério Universitário, Uberaba - MG",
    "hospital mario palmerio":
      "Hospital Mário Palmério Universitário, Uberaba - MG",
    "praça shopping": "Praça Shopping Uberaba, Uberaba - MG",
    "shopping uberaba": "Shopping Uberaba, Uberaba - MG",
    "terminal oeste": "Terminal Oeste - BRT Vetor, Uberaba - MG",
    "terminal leste": "Terminal Leste - BRT Vetor, Uberaba - MG",
    "terminal sudeste": "Terminal Sudeste - BRT Vetor, Uberaba - MG",
    "terminal sudoeste": "Terminal Sudoeste - BRT Vetor, Uberaba - MG",
    "terminal central": "Terminal Central - BRT Vetor, Uberaba - MG",
    "upa são benedito": "UPA São Benedito, Uberaba - MG",
    "upa sao benedito": "UPA São Benedito, Uberaba - MG",
    "upa do mirante": "UPA Dr. José Marcus Cherém (UPA Mirante), Uberaba - MG",
    "upa mirante": "UPA Dr. José Marcus Cherém (UPA Mirante), Uberaba - MG",
    "postinho do beija-flor 3": "Unidade de Saúde Beija Flor III, Uberaba - MG",
    "postinho do beija flor 3": "Unidade de Saúde Beija Flor III, Uberaba - MG",
    "postinho do beija flor": "Unidade de Saúde Beija Flor III, Uberaba - MG",
  };

  return aliases[text.toLowerCase()] || text;
}

const GENERIC_PLACE_TYPES = {
  hospital: ["hospital"],
  hospitais: ["hospital"],
  supermercado: ["supermarket"],
  supermercados: ["supermarket"],
  mercado: ["supermarket"],
  mercados: ["supermarket"],
  farmacia: ["pharmacy"],
  farmácia: ["pharmacy"],
  farmacias: ["pharmacy"],
  farmácias: ["pharmacy"],
  padaria: ["bakery"],
  padarias: ["bakery"],
  posto: ["gas_station"],
  "posto de gasolina": ["gas_station"],
  shopping: ["shopping_mall"],
  shoppings: ["shopping_mall"],
  forum: ["courthouse"],
  fórum: ["courthouse"],
  escola: ["school"],
  escolas: ["school"],
  faculdade: ["university"],
  faculdades: ["university"],
  universidade: ["university"],
  universidades: ["university"],
  terminal: ["bus_station", "transit_station"],
  praça: ["park", "tourist_attraction"],
  praca: ["park", "tourist_attraction"],
};

const TERMS_THAT_SHOULD_SHOW_OPTIONS = [
  "uniube",
  "universidade",
  "faculdade",
  "hospital",
  "supermercado",
  "mercado",
  "farmacia",
  "farmácia",
  "restaurante",
  "terminal",
  "forum",
  "fórum",
  "clinica",
  "clínica",
  "posto de saúde",
];

/**
 * Remove acentos de uma string.
 */
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function shouldShowOptionsForKnownTerm(text, candidates) {
  const normalizedText = removeAccents(String(text || "").toLowerCase());

  const hasKnownTerm = TERMS_THAT_SHOULD_SHOW_OPTIONS.some((term) =>
    normalizedText.includes(removeAccents(term.toLowerCase())),
  );

  return hasKnownTerm && candidates.length > 1;
}

/**
 * Avalia se o texto possui heurísticas de endereço físico ou locais genéricos/específicos.
 */
function guessQueryType(text) {
  const lower = text.toLowerCase().trim();
  const lowerNoAccents = removeAccents(lower);

  if (GENERIC_PLACE_TYPES[lower] || GENERIC_PLACE_TYPES[lowerNoAccents]) {
    return "generic_category";
  }

  const addressKeywords = [
    "rua",
    "avenida",
    "av",
    "av.",
    "travessa",
    "número",
    "nº",
    "n ",
    "numero",
    "bairro",
    "parque dos",
    "vila",
    "alameda",
    "estrada",
    "rodovia",
  ];
  const placeKeywords = [
    "hospital",
    "upa",
    "supermercado",
    "shopping",
    "terminal",
    "escola",
    "faculdade",
    "igreja",
    "uniube",
    "uftm",
    "prefeitura",
    "forum",
    "fórum",
    "estádio",
    "estadio",
    "praça",
    "parque",
    "universidade",
    "museu",
    "teatro",
    "rodoviária",
    "aeroporto",
  ];

  const hasAddress = addressKeywords.some((kw) => lower.includes(kw));
  const hasPlace = placeKeywords.some((kw) => lower.includes(kw));

  if (hasAddress && !hasPlace) return "address";
  if (hasPlace) return "specific_place";

  if (/\d+/.test(lower)) return "address";

  return "unknown";
}

/**
 * Verifica se um resultado é apenas a cidade de forma genérica.
 */
function checkIfGenericCity(name, address) {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  const genericTerms = [
    "uberaba",
    "uberaba, mg",
    "uberaba - mg",
    "uberaba, minas gerais",
  ];

  const isNameGeneric = genericTerms.some((term) => lowerName === term);

  return isNameGeneric;
}

/**
 * Avalia a confiança do resultado baseado na query original e no tipo da query.
 */
function evaluateConfidence(query, result, queryType) {
  if (queryType === "generic_category") {
    return "low"; // Categorias genéricas SEMPRE exigem sugestões.
  }

  const lowerQuery = query.toLowerCase();
  const lowerResultName = result.name.toLowerCase();

  const isGeneric = checkIfGenericCity(result.name, result.address);

  // Se o usuário buscou um POI específico mas o resultado é a cidade
  if (queryType === "specific_place" && isGeneric) {
    return "low";
  }

  // Se o nome do resultado contém palavras-chave da busca, confiança alta
  const queryWords = lowerQuery.split(" ").filter((w) => w.length > 3);
  const matchesAnyWord = queryWords.some((word) =>
    lowerResultName.includes(word),
  );

  if (matchesAnyWord && !isGeneric) return "high";

  return result.confidence || "medium";
}

async function resolveDestinationService({ text, origin }) {
  const validatedData = validateResolveDestinationInput({ text, origin });

  const interpretedDestination = cleanDestinationText(validatedData.text);
  const aliasedDestination = applyLocalAliases(interpretedDestination);
  const queryType = guessQueryType(aliasedDestination);

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
        isGenericCityResult: checkIfGenericCity(p.name, p.address),
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
        isGenericCityResult: checkIfGenericCity(r.name, r.address),
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
    confidence: evaluateConfidence(aliasedDestination, c, queryType),
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
  const shouldAskForKnownTerm = shouldShowOptionsForKnownTerm(
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
  const cachedResult = await findCachedRoute(cacheKey);

  if (cachedResult) {
    if (process.env.NODE_ENV !== "production") {
      console.log("Retornando rota do cache para a chave:", cacheKey);
    }
    return mapGoogleRouteToJourney(
      cachedResult.googleResponse,
      validatedData.origin,
      cachedResult.timePreference,
    );
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

  // Salva no banco de dados para consultas futuras
  await createRouteCache({
    cacheKey,
    googleResponse,
    timePreference: validatedData.timePreference,
  });

  return mapGoogleRouteToJourney(
    googleResponse,
    validatedData.origin,
    validatedData.timePreference,
  );
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
