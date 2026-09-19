const { z } = require("zod");

/**
 * Schema de validação para o endpoint POST /tracking/ping.
 * Garante que os dados de GPS sejam tipos corretos e dentro de ranges válidos,
 * prevenindo input malicioso que poderia estourar o Redis ou causar comportamento inesperado.
 */
const pingLocationSchema = z.object({
  lineId: z
    .string({
      required_error: "O ID da linha é obrigatório.",
      invalid_type_error: "O ID da linha deve ser um texto.",
    })
    .trim()
    .min(1, "O ID da linha não pode estar vazio.")
    .max(50, "O ID da linha é inválido."),

  lat: z
    .number({
      required_error: "A latitude é obrigatória.",
      invalid_type_error: "A latitude deve ser um número.",
    })
    .min(-90, "Latitude inválida.")
    .max(90, "Latitude inválida."),

  lng: z
    .number({
      required_error: "A longitude é obrigatória.",
      invalid_type_error: "A longitude deve ser um número.",
    })
    .min(-180, "Longitude inválida.")
    .max(180, "Longitude inválida."),

  direction: z.string().trim().max(100).optional().nullable(),

  speed: z
    .number()
    .min(0, "Velocidade não pode ser negativa.")
    .max(200, "Velocidade inválida.")
    .optional()
    .nullable(),

  bearing: z
    .number()
    .min(0, "Direção inválida.")
    .max(360, "Direção inválida.")
    .optional()
    .nullable(),
});

module.exports = { pingLocationSchema };
