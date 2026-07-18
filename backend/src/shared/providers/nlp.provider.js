const { GoogleGenAI, Type } = require("@google/genai");

class NLPProvider {
  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async parseUserIntent(text, coords, serverTimestamp, session = null) {
    let contextMsg = "";
    if (session && session.currentState === "WAITING_TIME_SELECTION" && session.metadata?.interpretedDestination) {
      contextMsg = `
      ATENÇÃO: O usuário JÁ definiu o destino anteriormente como "${session.metadata.interpretedDestination}". 
      Ele está apenas respondendo à pergunta sobre QUE HORAS deseja ir.
      Sua tarefa é extrair o agendamento (scheduling). 
      Devolva intent="SEARCH_DESTINATION" e o search_term="${session.metadata.interpretedDestination}".
      `;
    }

    const prompt = `
      Você é um assistente de mobilidade urbana.
      O usuário disse: "${text}".
      Localização atual do usuário: Lat ${coords.lat}, Lng ${coords.lng}.
      Data e hora atual do servidor: ${serverTimestamp}.
      ${contextMsg}
      
      Extraia a intenção, o local de destino (limpo) e as informações de agendamento.
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              enum: ["SEARCH_DESTINATION", "UNKNOWN"],
            },
            search_term: {
              type: Type.STRING,
              description: "O nome do local limpo para busca no Google Places",
            },
            scheduling: {
              type: Type.OBJECT,
              properties: {
                time_mode: {
                  type: Type.STRING,
                  enum: ["DEPART_AT", "ARRIVE_BY", "NOW"],
                },
                target_datetime: {
                  type: Type.STRING,
                  description:
                    "Data e hora no formato ISO 8601, se mencionado. Caso contrário, null.",
                },
              },
              required: ["time_mode"],
            },
          },
          required: ["intent", "search_term", "scheduling"],
        },
      },
    });

    return JSON.parse(response.text);
  }
}

module.exports = new NLPProvider();
