import { normalizeVoiceTranscript } from "./voiceIntentParser";

export type VoiceTimeIntent =
  | { type: "NOW" }
  | { type: "DEPARTURE_TIME"; date: string; time: string }
  | { type: "ARRIVAL_TIME"; date: string; time: string }
  | { type: "REPEAT" }
  | { type: "CANCEL" }
  | { type: "UNKNOWN" };

const NOW_PATTERNS = ["agora", "sair agora", "pode ser agora"];
const REPEAT_PATTERNS = ["repetir", "fala de novo", "nao entendi"];
const CANCEL_PATTERNS = ["cancelar", "voltar", "volta"];

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", uma: "1", um: "1", duas: "2", dois: "2", tres: "3", quatro: "4", cinco: "5",
  seis: "6", sete: "7", oito: "8", nove: "9", dez: "10", onze: "11", doze: "12",
  treze: "13", quatorze: "14", quinze: "15", dezesseis: "16", dezessete: "17", dezoito: "18", dezenove: "19",
  vinte: "20", trinta: "30", quarenta: "40", cinquenta: "50"
};

function pad(v: number | string) {
  return String(v).padStart(2, "0");
}

function wordToNumber(word: string): string {
  return NUMBER_WORDS[word] || word;
}

export function parseVoiceTimeIntent(transcript: string, referenceDate = new Date()): VoiceTimeIntent {
  const normalized = normalizeVoiceTranscript(transcript);

  if (!normalized) return { type: "UNKNOWN" };

  if (NOW_PATTERNS.includes(normalized)) {
    return { type: "NOW" };
  }

  if (REPEAT_PATTERNS.includes(normalized)) {
    return { type: "REPEAT" };
  }

  if (CANCEL_PATTERNS.includes(normalized)) {
    return { type: "CANCEL" };
  }

  // Regex para capturar data relativa e hora
  // Exemplos: 
  // "hoje as oito"
  // "hoje as 08:30"
  // "amanha as 9"
  // "chegar as 10"
  
  const timeRegex = /(hoje|amanha|chegar)?\s*(?:as|as\s+horas|as)?\s*(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|vinte|trinta|quarenta|cinquenta)(?:\s+|:|\s+e\s+)?(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|vinte|trinta|quarenta|cinquenta)?/i;
  const match = normalized.match(timeRegex);

  if (match) {
    const relativeDay = match[1]; // hoje, amanha, chegar ou undefined
    const hoursPart = wordToNumber(match[2]);
    const minutesPart = wordToNumber(match[3] || "0");

    const hours = parseInt(hoursPart, 10);
    const minutes = parseInt(minutesPart, 10);

    if (isNaN(hours) || hours < 0 || hours > 23 || isNaN(minutes) || minutes < 0 || minutes > 59) {
      return { type: "UNKNOWN" };
    }

    const targetDate = new Date(referenceDate);
    if (relativeDay === "amanha") {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
    const timeStr = `${pad(hours)}:${pad(minutes)}`;

    if (relativeDay === "chegar") {
      return { type: "ARRIVAL_TIME", date: dateStr, time: timeStr };
    }

    return { type: "DEPARTURE_TIME", date: dateStr, time: timeStr };
  }

  return { type: "UNKNOWN" };
}
