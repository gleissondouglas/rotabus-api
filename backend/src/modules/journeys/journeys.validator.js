const { z } = require("zod");

function createValidationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Helper para validar data/hora
const dateTimeSchema = z.string().refine((val) => {
  const date = new Date(val);
  return !Number.isNaN(date.getTime());
}, {
  message: "A data/hora informada deve ser uma data válida."
});

const coordinateSchema = z.object({
  lat: z.number({
    invalid_type_error: "Latitude deve ser um número.",
    required_error: "Latitude é obrigatória."
  }).min(-90, "A latitude deve estar entre -90 e 90.").max(90, "A latitude deve estar entre -90 e 90."),
  lng: z.number({
    invalid_type_error: "Longitude deve ser um número.",
    required_error: "Longitude é obrigatória."
  }).min(-180, "A longitude deve estar entre -180 e 180.").max(180, "A longitude deve estar entre -180 e 180.")
});

const destinationSchema = z.object({
  text: z.string({
    required_error: "O destino deve conter um texto válido.",
    invalid_type_error: "O destino deve conter um texto válido."
  })
    .trim()
    .transform(t => t.replace(/\s+/g, ' '))
    .refine(t => t.length >= 2, "O texto do destino deve ter pelo menos 2 caracteres.")
    .refine(t => t.length <= 200, "O texto do destino é muito longo."),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional()
});

const timePreferenceSchema = z.object({
  type: z.enum(["DEPARTURE", "ARRIVAL"], {
    error_map: () => ({ message: "O tipo de horário deve ser DEPARTURE ou ARRIVAL." })
  }),
  dateTime: dateTimeSchema
});

function validatePlanJourneyInput(data) {
  // 1. Verificação de presença básica (Contrato Original)
  if (!data.origin || !data.destination) {
    throw createValidationError("Origem e destino são obrigatórios.");
  }

  // 2. Validação da Origem
  if (typeof data.origin !== "object") {
    throw createValidationError("A origem deve ser um objeto válido.");
  }
  
  const originResult = coordinateSchema.safeParse(data.origin);
  if (!originResult.success) {
    // Mantém mensagens de erro específicas do contrato original
    const issue = originResult.error.issues[0];
    let message = issue.message;
    if (issue.code === 'invalid_type') {
      message = "Latitude e longitude da origem devem ser números.";
    } else if (issue.path.includes('lat')) {
      message = "A latitude da origem deve estar entre -90 e 90.";
    } else if (issue.path.includes('lng')) {
      message = "A longitude da origem deve estar entre -180 e 180.";
    }
    throw createValidationError(message);
  }

  // 3. Validação do Destino
  if (typeof data.destination !== "object") {
    throw createValidationError("O destino deve ser um objeto válido.");
  }

  const destinationResult = destinationSchema.safeParse(data.destination);
  if (!destinationResult.success) {
    const issue = destinationResult.error.issues[0];
    let message = issue.message;
    if (issue.path.includes('lat')) message = "A latitude do destino é inválida.";
    if (issue.path.includes('lng')) message = "A longitude do destino é inválida.";
    throw createValidationError(message);
  }

  // 4. Normalização de TimePreference
  let normalizedTimePreference;
  if (data.timePreference) {
    if (typeof data.timePreference !== "object") {
      throw createValidationError("A preferência de horário deve ser um objeto.");
    }
    
    const tp = data.timePreference;
    if (!tp.type || typeof tp.type !== "string") {
      throw createValidationError("O tipo de horário é obrigatório. Use DEPARTURE ou ARRIVAL.");
    }

    const tpResult = timePreferenceSchema.safeParse({
      type: tp.type.trim().toUpperCase(),
      dateTime: tp.dateTime
    });

    if (!tpResult.success) {
      throw createValidationError(tpResult.error.issues[0].message);
    }
    normalizedTimePreference = tpResult.data;
  } else if (data.departureTime) {
    const dtResult = dateTimeSchema.safeParse(data.departureTime);
    if (!dtResult.success) {
      throw createValidationError("O horário de partida deve ser uma data válida.");
    }
    normalizedTimePreference = {
      type: "DEPARTURE",
      dateTime: data.departureTime
    };
  } else {
    normalizedTimePreference = {
      type: "DEPARTURE",
      dateTime: new Date().toISOString()
    };
  }

  // 5. Preferência de Roteamento
  const validRoutingPreferences = ["ANY_ROUTE", "LESS_WALKING", "FEWER_TRANSFERS"];
  const normalizedRoutingPreference = data.routingPreference && 
    typeof data.routingPreference === "string" && 
    validRoutingPreferences.includes(data.routingPreference.toUpperCase()) 
    ? data.routingPreference.toUpperCase() 
    : "ANY_ROUTE";

  return {
    origin: originResult.data,
    destination: destinationResult.data,
    timePreference: normalizedTimePreference,
    routingPreference: normalizedRoutingPreference,
  };
}

function validateResolveDestinationInput(data) {
  if (!data.text || typeof data.text !== "string") {
    throw createValidationError("O texto do destino é obrigatório.");
  }
  
  const cleanText = data.text.trim().replace(/\s+/g, ' ');
  
  if (!cleanText || cleanText.length < 2) {
    throw createValidationError("Digite pelo menos 2 caracteres para o destino.");
  }
  
  if (cleanText.length > 200) {
    throw createValidationError("O texto de busca é muito longo.");
  }

  if (!data.origin || typeof data.origin !== "object") {
    throw createValidationError("A origem é obrigatória para priorizar resultados próximos.");
  }

  const originResult = coordinateSchema.safeParse(data.origin);
  if (!originResult.success) {
    const issue = originResult.error.issues[0];
    let message = issue.message;
    if (issue.code === 'invalid_type') {
      message = "Latitude e longitude da origem devem ser números.";
    } else if (issue.path.includes('lat')) {
      message = "A latitude deve estar entre -90 e 90.";
    } else if (issue.path.includes('lng')) {
      message = "A longitude deve estar entre -180 e 180.";
    }
    throw createValidationError(message);
  }

  return {
    text: cleanText,
    origin: originResult.data,
  };
}

module.exports = {
  validatePlanJourneyInput,
  validateResolveDestinationInput,
};
