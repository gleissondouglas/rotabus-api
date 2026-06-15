export type VoiceIntent =
  | { type: "CONFIRM"; transcript: string }
  | { type: "CANCEL_THEN_ASK_DESTINATION"; transcript: string }
  | { type: "REPEAT"; transcript: string }
  | { type: "CANCEL"; transcript: string }
  | { type: "SELECT_OPTION"; optionIndex: number; transcript: string }
  | { type: "START_NAVIGATION"; transcript: string }
  | { type: "SHOW_DETAILS"; transcript: string }
  | { type: "HIDE_DETAILS"; transcript: string }
  | { type: "DESTINATION_TEXT"; text: string; transcript: string }
  | { type: "UNCLEAR"; transcript: string }
  | { type: "EMPTY"; transcript: string };

const CONFIRM_PATTERNS = [
  "sim",
  "isso",
  "correto",
  "pode ser",
  "e esse",
  "esse mesmo",
  "vamos",
  "bora",
];

const START_NAVIGATION_PATTERNS = [
  "iniciar",
  "iniciar navegacao",
  "comecar",
  "ir",
];

const SHOW_DETAILS_PATTERNS = [
  "ver detalhes",
  "mostrar detalhes",
  "detalhes da rota",
  "abrir detalhes",
];

const HIDE_DETAILS_PATTERNS = [
  "ocultar detalhes",
  "fechar detalhes",
  "esconder detalhes",
];

const CANCEL_THEN_ASK_PATTERNS = [
  "nao",
  "errado",
  "outro destino",
  "mudar",
  "nenhuma",
  "nenhum",
];

const REPEAT_PATTERNS = [
  "repetir",
  "fala de novo",
  "nao entendi",
];

const CANCEL_PATTERNS = [
  "cancelar",
  "voltar ao inicio",
  "volta ao inicio",
];

const OPTION_PATTERNS: Record<number, string[]> = {
  0: ["primeira", "opcao um", "numero um"],
  1: ["segunda", "opcao dois", "numero dois"],
  2: ["terceira", "opcao tres", "numero tres"],
};

const NOISE_WORDS = new Set([
  "a",
  "ah",
  "ai",
  "e",
  "eh",
  "ei",
  "ha",
  "hm",
  "hum",
  "o",
  "oh",
  "oi",
  "ta",
  "uh",
  "um",
]);

export function normalizeVoiceTranscript(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesPattern(normalized: string, patterns: string[]) {
  return patterns.some((pattern) => normalized === pattern);
}

export function isLikelyNoiseTranscript(normalizedTranscript: string) {
  const normalized = normalizeVoiceTranscript(normalizedTranscript);

  if (!normalized) {
    return false;
  }

  const tokens = normalized.split(" ").filter(Boolean);

  if (tokens.length === 1) {
    const [word] = tokens;
    return word.length < 3 || NOISE_WORDS.has(word) || /^\d+$/.test(word);
  }

  const meaningfulTokens = tokens.filter((token) => !NOISE_WORDS.has(token));
  return meaningfulTokens.length === 0;
}

export function parseVoiceIntent(transcript: string): VoiceIntent {
  const normalized = normalizeVoiceTranscript(transcript);

  if (!normalized) {
    return { type: "EMPTY", transcript: normalized };
  }

  if (matchesPattern(normalized, CONFIRM_PATTERNS)) {
    return { type: "CONFIRM", transcript: normalized };
  }

  if (matchesPattern(normalized, CANCEL_THEN_ASK_PATTERNS)) {
    return { type: "CANCEL_THEN_ASK_DESTINATION", transcript: normalized };
  }

  if (matchesPattern(normalized, REPEAT_PATTERNS)) {
    return { type: "REPEAT", transcript: normalized };
  }

  if (matchesPattern(normalized, CANCEL_PATTERNS)) {
    return { type: "CANCEL", transcript: normalized };
  }

  if (matchesPattern(normalized, START_NAVIGATION_PATTERNS)) {
    return { type: "START_NAVIGATION", transcript: normalized };
  }

  if (matchesPattern(normalized, SHOW_DETAILS_PATTERNS)) {
    return { type: "SHOW_DETAILS", transcript: normalized };
  }

  if (matchesPattern(normalized, HIDE_DETAILS_PATTERNS)) {
    return { type: "HIDE_DETAILS", transcript: normalized };
  }

  for (const [optionIndex, patterns] of Object.entries(OPTION_PATTERNS)) {
    if (matchesPattern(normalized, patterns)) {
      return {
        type: "SELECT_OPTION",
        optionIndex: Number(optionIndex),
        transcript: normalized,
      };
    }
  }

  if (isLikelyNoiseTranscript(normalized)) {
    return { type: "UNCLEAR", transcript: normalized };
  }

  return {
    type: "DESTINATION_TEXT",
    text: normalized,
    transcript: normalized,
  };
}
