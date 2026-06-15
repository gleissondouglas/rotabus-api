import { normalizeVoiceTranscript } from "./voiceIntentParser";

export type VoiceTimeIntent =
  | { type: "NOW" }
  | { type: "DEPARTURE_TIME"; date: string; time: string }
  | { type: "ARRIVAL_TIME"; date: string; time: string }
  | { type: "REPEAT" }
  | { type: "CANCEL" }
  | { type: "UNKNOWN" };

const NOW_PATTERNS = ["agora", "sair agora", "pode ser agora", "quero ir agora", "quero sair agora", "ir agora"];
const REPEAT_PATTERNS = ["repetir", "fala de novo", "nao entendi"];
const CANCEL_PATTERNS = ["cancelar", "voltar", "volta"];

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  meia: 30
};

const WEEKDAYS: Record<string, number> = {
  "domingo": 0,
  "segunda-feira": 1, "segunda feira": 1, "segunda": 1,
  "terca-feira": 2, "terca feira": 2, "terca": 2,
  "quarta-feira": 3, "quarta feira": 3, "quarta": 3,
  "quinta-feira": 4, "quinta feira": 4, "quinta": 4,
  "sexta-feira": 5, "sexta feira": 5, "sexta": 5,
  "sabado": 6
};

function pad(v: number | string) {
  return String(v).padStart(2, "0");
}

function parseNumber(word: string | undefined): number | undefined {
  if (!word) return undefined;
  if (/^\d+$/.test(word)) return parseInt(word, 10);
  return NUMBER_WORDS[word];
}

export function parseVoiceTimeIntent(transcript: string, referenceDate = new Date()): VoiceTimeIntent {
  const normalized = normalizeVoiceTranscript(transcript);
  if (!normalized) return { type: "UNKNOWN" };

  if (NOW_PATTERNS.includes(normalized) || (normalized.includes("agora") && !normalized.includes("ate agora"))) {
    return { type: "NOW" };
  }
  if (REPEAT_PATTERNS.includes(normalized)) return { type: "REPEAT" };
  if (CANCEL_PATTERNS.includes(normalized)) return { type: "CANCEL" };

  const isArrival = /\b(chegar|chegada|estar\s+la|estiver\s+la)\b/i.test(normalized);
  
  const targetDate = new Date(referenceDate);
  let timeAssigned = false;

  // 1. Check for "daqui X minutos/horas"
  const relativeMatch = normalized.match(/daqui\s+(?:a\s+)?(\d+|uma?|duas?|tres|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta|quarenta|cinquenta)\s+(minutos?|horas?|hrs?)/i);
  if (relativeMatch) {
    const amountStr = relativeMatch[1];
    let amount = parseNumber(amountStr);
    // Handles cases where "uma" or "um" comes before "hora"
    if (amount === undefined && (amountStr === "uma" || amountStr === "um")) amount = 1;
    if (amount === undefined) amount = parseInt(amountStr, 10);

    if (amount) {
        const unit = relativeMatch[2];
        if (unit.startsWith("hora") || unit.startsWith("hr")) {
        targetDate.setHours(targetDate.getHours() + amount);
        } else {
        targetDate.setMinutes(targetDate.getMinutes() + amount);
        }
        timeAssigned = true;
    }
  }

  // 2. Check for date (hoje, amanhã, dias da semana)
  if (!timeAssigned) {
    if (normalized.includes("amanha")) {
      targetDate.setDate(targetDate.getDate() + 1);
    } else {
      for (const [dayStr, dayNum] of Object.entries(WEEKDAYS)) {
        if (normalized.includes(dayStr)) {
          let diff = dayNum - targetDate.getDay();
          if (diff <= 0) diff += 7; // Next occurrence
          targetDate.setDate(targetDate.getDate() + diff);
          break;
        }
      }
    }

    // 3. Check for specific time
    if (normalized.includes("mesmo horario")) {
      timeAssigned = true;
    } else if (normalized.includes("de manha") && !normalized.match(/(?:as|:|\d)/i)) {
      targetDate.setHours(8, 0, 0, 0);
      timeAssigned = true;
    } else {
      const exactTimeMatch = normalized.match(/(?:as\s+)?\b(\d+|uma?|duas?|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta)\b(?:(?:\s*[:h]\s*|\s+e\s+|\s+horas?\s+e\s+|\s+hrs?\s+e\s+)(\d{1,2}|meia|uma?|duas?|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|vinte|trinta|quarenta|cinquenta)\b)?(?:\s*minutos?)?(?:\s+(da\s+manha|da\s+tarde|da\s+noite|horas|hrs))?/i);
      
      if (exactTimeMatch) {
        let hours = parseNumber(exactTimeMatch[1]);
        let minutes = parseNumber(exactTimeMatch[2]) || 0;
        const modifier = exactTimeMatch[3]; // "da manha", "da tarde", "da noite", "horas"
        
        if (hours !== undefined && hours < 24 && minutes < 60) {
          if (modifier) {
            if ((modifier.includes("tarde") || modifier.includes("noite")) && hours < 12) {
              hours += 12;
            } else if (modifier.includes("manha") && hours === 12) {
              hours = 0;
            }
          }
          
          targetDate.setHours(hours, minutes, 0, 0);
          timeAssigned = true;
        }
      }
    }
  }

  if (timeAssigned) {
    const dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
    const timeStr = `${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;

    if (isArrival) {
      return { type: "ARRIVAL_TIME", date: dateStr, time: timeStr };
    }
    return { type: "DEPARTURE_TIME", date: dateStr, time: timeStr };
  }

  return { type: "UNKNOWN" };
}