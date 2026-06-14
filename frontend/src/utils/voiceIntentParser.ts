export type VoiceIntent =
  | { type: "CONFIRM"; transcript: string }
  | { type: "CANCEL_THEN_ASK_DESTINATION"; transcript: string }
  | { type: "REPEAT"; transcript: string }
  | { type: "CANCEL"; transcript: string }
  | { type: "SELECT_OPTION"; optionIndex: number; transcript: string }
  | { type: "DESTINATION_TEXT"; text: string; transcript: string }
  | { type: "EMPTY"; transcript: string };

const CONFIRM_PATTERNS = [
  "sim",
  "isso",
  "correto",
  "pode ser",
  "e esse",
  "esse mesmo",
];

const CANCEL_THEN_ASK_PATTERNS = [
  "nao",
  "errado",
  "outro destino",
  "mudar",
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

  for (const [optionIndex, patterns] of Object.entries(OPTION_PATTERNS)) {
    if (matchesPattern(normalized, patterns)) {
      return {
        type: "SELECT_OPTION",
        optionIndex: Number(optionIndex),
        transcript: normalized,
      };
    }
  }

  return {
    type: "DESTINATION_TEXT",
    text: normalized,
    transcript: normalized,
  };
}
