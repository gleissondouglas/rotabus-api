const Groq = require("groq-sdk");

/**
 * NLPProvider — usa Groq (llama-3.1-8b-instant) apenas para interpretar
 * intenções de HORÁRIO. A busca de destino vai direto ao Google Places,
 * sem passar por IA.
 */
class NLPProvider {
  constructor() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  /**
   * Interpreta APENAS a intenção de horário de uma frase falada.
   * Usar quando o destino já foi definido e o usuário está escolhendo QUANDO quer ir.
   *
   * @param {string} text - A frase falada pelo usuário
   * @param {string} serverTimestamp - Data/hora atual do servidor em ISO 8601
   * @returns {{ time_mode: string, target_datetime: string|null, confidence: string }}
   */
  async parseTimeIntent(text, serverTimestamp) {
    const prompt = `Você é um assistente de mobilidade urbana de ônibus.
O usuário JÁ definiu o destino. Agora ele está dizendo QUANDO quer partir ou chegar.

O usuário disse: "${text}".
Data e hora atual do servidor: ${serverTimestamp} (use isso como referência para calcular "hoje", "amanhã", dias da semana).

Regras de interpretação:
- "agora", "já", "próximo ônibus", "o mais rápido" → time_mode="NOW", target_datetime=null
- "quero sair às X", "partir às X", "ir às X" → time_mode="DEPART_AT"
- "chegar às X", "quero estar lá às X", "preciso chegar às X" → time_mode="ARRIVE_BY"
- "amanhã às X" → calcule o dia seguinte ao timestamp fornecido com o horário X
- "hoje às X" → use a data de hoje do timestamp com horário X
- "depois de amanhã às X" → dois dias após o timestamp
- "na segunda", "na terça", etc → próximo dia da semana em relação ao timestamp
- "meio-dia" = 12:00, "meia-noite" = 00:00, "uma da tarde" = 13:00, "três da tarde" = 15:00, "seis da tarde" = 18:00, "oito da noite" = 20:00
- "da manhã" significa AM, "da tarde/da noite" significa PM (some 12h se hora < 12)
- Se não conseguir identificar horário algum → time_mode="UNKNOWN", target_datetime=null

Retorne o target_datetime no formato ISO 8601 com o offset de fuso horário correto baseado no timestamp fornecido.
Não invente horários. Se não tiver horário claro, use time_mode="UNKNOWN".

Responda APENAS com JSON válido no formato:
{
  "time_mode": "NOW" | "DEPART_AT" | "ARRIVE_BY" | "UNKNOWN",
  "target_datetime": "ISO 8601 string ou null",
  "confidence": "high" | "medium" | "low"
}`;

    try {
      const response = await this.groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 150,
      });

      const result = JSON.parse(response.choices[0].message.content);

      if (process.env.NODE_ENV !== "production") {
        console.log(`[NLP/Groq] parseTimeIntent: "${text}" →`, JSON.stringify(result));
      }

      return result;
    } catch (error) {
      console.error("[NLP/Groq] Erro no parseTimeIntent:", error.message);
      return {
        time_mode: "UNKNOWN",
        target_datetime: null,
        confidence: "low",
      };
    }
  }
}

module.exports = new NLPProvider();
