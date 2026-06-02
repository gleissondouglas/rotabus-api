function createValidationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isValidDateTime(dateTime) {
  if (!dateTime || typeof dateTime !== "string") {
    return false;
  }

  const date = new Date(dateTime);

  return !Number.isNaN(date.getTime());
}

function normalizeTimePreference({ departureTime, timePreference }) {
  if (timePreference) {
    if (typeof timePreference !== "object") {
      throw createValidationError(
        "A preferência de horário deve ser um objeto.",
      );
    }

    const { type, dateTime } = timePreference;

    if (!type || typeof type !== "string") {
      throw createValidationError(
        "O tipo de horário é obrigatório. Use DEPARTURE ou ARRIVAL.",
      );
    }

    const normalizedType = type.trim().toUpperCase();

    if (!["DEPARTURE", "ARRIVAL"].includes(normalizedType)) {
      throw createValidationError(
        "O tipo de horário deve ser DEPARTURE ou ARRIVAL.",
      );
    }

    if (!isValidDateTime(dateTime)) {
      throw createValidationError(
        "A data/hora informada deve ser uma data válida.",
      );
    }

    return {
      type: normalizedType,
      dateTime,
    };
  }

  if (departureTime) {
    if (!isValidDateTime(departureTime)) {
      throw createValidationError(
        "O horário de partida deve ser uma data válida.",
      );
    }

    return {
      type: "DEPARTURE",
      dateTime: departureTime,
    };
  }

  return {
    type: "DEPARTURE",
    dateTime: new Date().toISOString(),
  };
}

function validatePlanJourneyInput({
  origin,
  destination,
  departureTime,
  timePreference,
  routingPreference,
}) {
  if (!origin || !destination) {
    throw createValidationError("Origem e destino são obrigatórios.");
  }

  if (typeof origin !== "object") {
    throw createValidationError("A origem deve ser um objeto válido.");
  }

  if (typeof origin.lat !== "number" || typeof origin.lng !== "number") {
    throw createValidationError(
      "Latitude e longitude da origem devem ser números.",
    );
  }

  if (origin.lat < -90 || origin.lat > 90) {
    throw createValidationError("A latitude da origem deve estar entre -90 e 90.");
  }

  if (origin.lng < -180 || origin.lng > 180) {
    throw createValidationError("A longitude da origem deve estar entre -180 e 180.");
  }

  if (typeof destination !== "object") {
    throw createValidationError("O destino deve ser um objeto válido.");
  }

  if (!destination.text || typeof destination.text !== "string") {
    throw createValidationError("O destino deve conter um texto válido.");
  }

  const normalizedDestinationText = destination.text.trim().replace(/\s+/g, ' ');

  if (!normalizedDestinationText || normalizedDestinationText.length < 2) {
    throw createValidationError("O texto do destino deve ter pelo menos 2 caracteres.");
  }
  
  if (normalizedDestinationText.length > 200) {
    throw createValidationError("O texto do destino é muito longo.");
  }

  const validatedDestination = {
    text: normalizedDestinationText,
    lat: typeof destination.lat === "number" ? destination.lat : undefined,
    lng: typeof destination.lng === "number" ? destination.lng : undefined,
  };
  
  if (validatedDestination.lat !== undefined && (validatedDestination.lat < -90 || validatedDestination.lat > 90)) {
    throw createValidationError("A latitude do destino é inválida.");
  }
  
  if (validatedDestination.lng !== undefined && (validatedDestination.lng < -180 || validatedDestination.lng > 180)) {
    throw createValidationError("A longitude do destino é inválida.");
  }

  const normalizedTimePreference = normalizeTimePreference({
    departureTime,
    timePreference,
  });

  // Validação opcional da preferência de roteamento
  const validRoutingPreferences = ["ANY_ROUTE", "LESS_WALKING", "FEWER_TRANSFERS"];
  const normalizedRoutingPreference = routingPreference && typeof routingPreference === "string" && validRoutingPreferences.includes(routingPreference.toUpperCase()) 
    ? routingPreference.toUpperCase() 
    : "ANY_ROUTE";

  return {
    origin: {
      lat: origin.lat,
      lng: origin.lng,
    },
    destination: validatedDestination,
    timePreference: normalizedTimePreference,
    routingPreference: normalizedRoutingPreference,
  };
}

function validateResolveDestinationInput({ text, origin }) {
  if (!text || typeof text !== "string") {
    throw createValidationError("O texto do destino é obrigatório.");
  }
  
  const cleanText = text.trim().replace(/\s+/g, ' ');
  
  if (!cleanText || cleanText.length < 2) {
    throw createValidationError("Digite pelo menos 2 caracteres para o destino.");
  }
  
  if (cleanText.length > 200) {
    throw createValidationError("O texto de busca é muito longo.");
  }

  if (!origin || typeof origin !== "object") {
    throw createValidationError("A origem é obrigatória para priorizar resultados próximos.");
  }

  if (typeof origin.lat !== "number" || typeof origin.lng !== "number") {
    throw createValidationError("Latitude e longitude da origem devem ser números.");
  }

  if (origin.lat < -90 || origin.lat > 90) {
    throw createValidationError("A latitude deve estar entre -90 e 90.");
  }

  if (origin.lng < -180 || origin.lng > 180) {
    throw createValidationError("A longitude deve estar entre -180 e 180.");
  }

  return {
    text: cleanText,
    origin: {
      lat: origin.lat,
      lng: origin.lng,
    },
  };
}

module.exports = {
  validatePlanJourneyInput,
  validateResolveDestinationInput,
};
