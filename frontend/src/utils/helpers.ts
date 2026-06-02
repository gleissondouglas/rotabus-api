/**
 * Helpers reutilizáveis em todo o projeto.
 */

/**
 * Faz o parse de uma string JSON com segurança, retornando um valor de fallback em caso de erro.
 */
export function parseJsonParam<T>(value: unknown, fallback: T): T {
  try {
    if (!value || typeof value !== "string") {
      return fallback;
    }
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Calcula a distância em metros entre duas coordenadas geográficas usando a fórmula de Haversine.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Limpa expressões comuns de preenchimento da transcrição de voz para isolar o destino.
 */
export function cleanVoiceTranscript(text: string): string {
  if (!text) return "";

  let cleaned = text.toLowerCase().trim();

  // Lista de prefixos comuns para remover
  const prefixesToRemove = [
    "eu quero ir para",
    "eu quero ir pro",
    "eu quero ir pra",
    "quero ir para",
    "quero ir pro",
    "quero ir pra",
    "me leve até o",
    "me leve até a",
    "me leve até",
    "como chego no",
    "como chego na",
    "como chego em",
    "ir para",
    "ir pro",
    "ir pra",
    "me leva no",
    "me leva na",
    "me leva para",
  ];

  for (const prefix of prefixesToRemove) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length).trim();
      break; // Remove apenas o primeiro prefixo encontrado
    }
  }

  // Remove pontuação final comum
  cleaned = cleaned.replace(/[.!?,]$/, "");

  return cleaned.trim();
}
