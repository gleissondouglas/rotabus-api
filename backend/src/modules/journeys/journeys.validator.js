const { z } = require("zod");

function createValidationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.name = "ValidationError";
  return error;
}

// Helper para validar data/hora
const dateTimeSchema = z
  .string()
  .refine(
    (val) => {
      const date = new Date(val);
      return !Number.isNaN(date.getTime());
    },
    {
      message: "A data/hora informada deve ser uma data válida.",
    },
  )
  .refine(
    (val) => {
      const date = new Date(val);
      const now = new Date();

      // Limite passado: permite hoje inteiro (início do dia atual menos 2 horas de tolerância)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const minAllowedTime = startOfToday.getTime() - 2 * 60 * 60 * 1000;

      // Limite futuro: 7 dias a partir do início de hoje
      const maxAllowedTime = startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000;

      const time = date.getTime();
      return time >= minAllowedTime && time <= maxAllowedTime;
    },
    {
      message: "Só consigo buscar ônibus para os próximos 7 dias. Escolha uma data mais próxima.",
    },
  );

const coordinateSchema = z.object({
  lat: z
    .number({
      invalid_type_error: "Latitude deve ser um número.",
      required_error: "Latitude é obrigatória.",
    })
    .min(-90, "A latitude deve estar entre -90 e 90.")
    .max(90, "A latitude deve estar entre -90 e 90."),
  lng: z
    .number({
      invalid_type_error: "Longitude deve ser um número.",
      required_error: "Longitude é obrigatória.",
    })
    .min(-180, "A longitude deve estar entre -180 e 180.")
    .max(180, "A longitude deve estar entre -180 e 180."),
});

const destinationSchema = z.object({
  text: z
    .string({
      required_error: "O destino deve conter um texto válido.",
      invalid_type_error: "O destino deve conter um texto válido.",
    })
    .trim()
    .transform((t) => t.replace(/\s+/g, " "))
    .refine((t) => t.length >= 2, "O texto do destino deve ter pelo menos 2 caracteres.")
    .refine((t) => t.length <= 200, "O texto do destino é muito longo."),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const timePreferenceSchema = z.object({
  type: z.enum(["DEPARTURE", "ARRIVAL"], {
    error_map: () => ({ message: "O tipo de horário deve ser DEPARTURE ou ARRIVAL." }),
  }),
  dateTime: dateTimeSchema,
});

/**
 * Schema para validar a criação de jornadas (Plan Journey)
 */
const planJourneySchema = z.preprocess(
  (data) => {
    if (!data || typeof data !== "object") return data;
    if (!data.origin || !data.destination) {
      throw createValidationError("Origem e destino são obrigatórios.");
    }
    return data;
  },
  z
    .object({
      sessionId: z.string().optional(),
      origin: z.preprocess(
        (val) => {
          if (val && typeof val === "object" && !Array.isArray(val)) return val;
          throw createValidationError("A origem deve ser um objeto válido.");
        },
        z.object({
          lat: z
            .number({
              invalid_type_error: "Latitude e longitude da origem devem ser números.",
              required_error: "Latitude e longitude da origem devem ser números.",
            })
            .min(-90, "A latitude da origem deve estar entre -90 e 90.")
            .max(90, "A latitude da origem deve estar entre -90 e 90."),
          lng: z
            .number({
              invalid_type_error: "Latitude e longitude da origem devem ser números.",
              required_error: "Latitude e longitude da origem devem ser números.",
            })
            .min(-180, "A longitude da origem deve estar entre -180 e 180.")
            .max(180, "A longitude da origem deve estar entre -180 e 180."),
        }),
      ),
      destination: z.preprocess(
        (val) => {
          if (val && typeof val === "object" && !Array.isArray(val)) return val;
          throw createValidationError("O destino deve ser um objeto válido.");
        },
        z.object({
          text: z
            .string({
              required_error: "O destino deve conter um texto válido.",
              invalid_type_error: "O destino deve conter um texto válido.",
            })
            .trim()
            .transform((t) => t.replace(/\s+/g, " "))
            .refine((t) => t.length >= 2, "O texto do destino deve ter pelo menos 2 caracteres.")
            .refine((t) => t.length <= 200, "O texto do destino é muito longo."),
          lat: z
            .number()
            .min(-90, "A latitude do destino é inválida.")
            .max(90, "A latitude do destino é inválida.")
            .optional(),
          lng: z
            .number()
            .min(-180, "A longitude do destino é inválida.")
            .max(180, "A longitude do destino é inválida.")
            .optional(),
        }),
      ),
      timePreference: z
        .preprocess((val) => {
          if (val === undefined || val === null) return undefined;
          if (typeof val !== "object" || Array.isArray(val)) {
            throw createValidationError("A preferência de horário deve ser um objeto.");
          }
          if (!val.type || typeof val.type !== "string") {
            throw createValidationError(
              "O tipo de horário é obrigatório. Use DEPARTURE ou ARRIVAL.",
            );
          }
          return {
            ...val,
            type: val.type.trim().toUpperCase(),
          };
        }, timePreferenceSchema)
        .optional(),
      departureTime: z
        .string()
        .refine((val) => !Number.isNaN(new Date(val).getTime()), {
          message: "O horário de partida deve ser uma data válida.",
        })
        .optional(),
      routingPreference: z.preprocess(
        (val) => {
          const validRoutingPreferences = ["ANY_ROUTE", "LESS_WALKING", "FEWER_TRANSFERS"];
          if (
            val &&
            typeof val === "string" &&
            validRoutingPreferences.includes(val.toUpperCase())
          ) {
            return val.toUpperCase();
          }
          return "ANY_ROUTE";
        },
        z.enum(["ANY_ROUTE", "LESS_WALKING", "FEWER_TRANSFERS"]),
      ),
    })
    .transform((data) => {
      let normalizedTimePreference;
      if (data.timePreference) {
        normalizedTimePreference = data.timePreference;
      } else if (data.departureTime) {
        normalizedTimePreference = {
          type: "DEPARTURE",
          dateTime: data.departureTime,
        };
      } else {
        normalizedTimePreference = {
          type: "DEPARTURE",
          dateTime: new Date().toISOString(),
        };
      }

      return {
        origin: data.origin,
        destination: data.destination,
        timePreference: normalizedTimePreference,
        routingPreference: data.routingPreference,
      };
    }),
);

/**
 * Schema para validar a resolução de destino (Resolve Destination)
 */
const resolveDestinationSchema = z.preprocess(
  (data) => {
    if (!data || typeof data !== "object") return data;
    if (!data.text || typeof data.text !== "string") {
      throw createValidationError("O texto do destino é obrigatório.");
    }
    if (!data.origin || typeof data.origin !== "object" || Array.isArray(data.origin)) {
      throw createValidationError("A origem é obrigatória para priorizar resultados próximos.");
    }
    return data;
  },
  z.object({
    sessionId: z.string().optional(),
    text: z
      .string()
      .trim()
      .transform((t) => t.replace(/\s+/g, " "))
      .refine((t) => t.length >= 2, "Digite pelo menos 2 caracteres para o destino.")
      .refine((t) => t.length <= 200, "O texto de busca é muito longo."),
    origin: z.object({
      lat: z
        .number({
          invalid_type_error: "Latitude e longitude da origem devem ser números.",
          required_error: "Latitude e longitude da origem devem ser números.",
        })
        .min(-90, "A latitude deve estar entre -90 e 90.")
        .max(90, "A latitude deve estar entre -90 e 90."),
      lng: z
        .number({
          invalid_type_error: "Latitude e longitude da origem devem ser números.",
          required_error: "Latitude e longitude da origem devem ser números.",
        })
        .min(-180, "A longitude deve estar entre -180 e 180.")
        .max(180, "A longitude deve estar entre -180 e 180."),
    }),
  }),
);

/**
 * Funções legadas mantidas para compatibilidade com o service e testes.
 */
function validatePlanJourneyInput(data) {
  return planJourneySchema.parse(data);
}

function validateResolveDestinationInput(data) {
  return resolveDestinationSchema.parse(data);
}

/**
 * Schema para validar os comandos conversacionais
 */
const conversationCommandSchema = z.preprocess(
  (data) => {
    if (!data || typeof data !== "object") return data;
    if (!data.command || typeof data.command !== "string") {
      throw createValidationError("O comando é obrigatório.");
    }
    if (!data.sessionId || typeof data.sessionId !== "string") {
      throw createValidationError("O ID da sessão é obrigatório.");
    }
    return data;
  },
  z.object({
    sessionId: z
      .string({
        required_error: "O ID da sessão é obrigatório.",
        invalid_type_error: "O ID da sessão deve ser um texto válido.",
      })
      .uuid("O ID da sessão deve ser um UUID válido."),
    command: z.enum(["CONFIRM", "CANCEL", "REPEAT", "SELECT_OPTION"], {
      error_map: () => ({
        message: "Comando inválido. Escolha entre CONFIRM, CANCEL, REPEAT ou SELECT_OPTION.",
      }),
    }),
    payload: z
      .object({
        optionIndex: z.number().int().nonnegative().optional(),
        optionName: z.string().trim().optional(),
      })
      .optional(),
  }),
);

module.exports = {
  validatePlanJourneyInput,
  validateResolveDestinationInput,
  planJourneySchema,
  resolveDestinationSchema,
  conversationCommandSchema,
};
