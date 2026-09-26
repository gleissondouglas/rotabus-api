import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isBetween from "dayjs/plugin/isBetween";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

// Define o fuso horário padrão como Brasília para todo o sistema de datas
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
dayjs.tz.setDefault(DEFAULT_TIMEZONE);

/**
 * Retorna a data/hora atual já convertida para o fuso horário de Brasília
 * @param date Data opcional para conversão. Se vazio, usa o "agora".
 */
export function getNow(date?: Date | string | number) {
  return dayjs(date).tz(DEFAULT_TIMEZONE);
}

/**
 * Verifica se o horário está dentro do horário operacional.
 * Permitido: de 04:00 até 23:59.
 * Bloqueado: 00:00 até 03:59.
 */
export function isOperationalTime(hour: number, minute: number): boolean {
  if (hour >= 4 && hour <= 23) return true;
  return false;
}

/**
 * Converte e formata uma data/hora no fuso horário de Brasília para string ISO 8601 (UTC).
 * Exemplo: 2026-05-12T16:46:29.000Z
 */
export function formatLocalDateTimeWithOffset(date?: Date | string | number) {
  const d = getNow(date);
  const formatted = d.toISOString();
  
  console.log(`[DateTime] Formatando data para Brasília:`, formatted);
  
  return formatted;
}

export function getTodayDateText() {
  return getNow().format("YYYY-MM-DD");
}

export function getCurrentTimeText() {
  return getNow().format("HH:mm");
}

/**
 * Constrói uma string ISO 8601 (UTC) a partir de strings de data e hora locais,
 * interpretando os valores no fuso horário de Brasília.
 */
export function buildLocalDateTimeFromInputs(
  dateText: string,
  timeText: string,
) {
  const date = dateText.trim();
  const time = timeText.trim();

  if (!date || !time) {
    throw new Error("Informe a data e o horário.");
  }

  // Analisa a string "YYYY-MM-DD HH:mm" forçando o timezone de Brasília
  const parsed = dayjs.tz(`${date} ${time}`, "YYYY-MM-DD HH:mm", DEFAULT_TIMEZONE);

  if (!parsed.isValid()) {
    throw new Error("Data ou horário inválido.");
  }

  return parsed.toISOString();
}

export interface Next7DaysOption {
  dateText: string;
  label: string;
  dayNum: number;
}

export function getNext7Days(referenceDate?: Date | string | number): Next7DaysOption[] {
  const options: Next7DaysOption[] = [];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const start = getNow(referenceDate);

  for (let i = 0; i < 7; i++) {
    const d = start.add(i, "day");
    const dateText = d.format("YYYY-MM-DD");

    let label = "";
    if (i === 0) {
      label = "Hoje";
    } else if (i === 1) {
      label = "Amanhã";
    } else {
      label = weekDays[d.day()];
    }

    options.push({
      dateText,
      label,
      dayNum: d.date(),
    });
  }

  return options;
}

export function formatMinutesToFriendlyText(diffMin: number) {
  if (diffMin <= 0) return "Chegando";
  
  if (diffMin >= 24 * 60) {
    const totalHours = Math.floor(diffMin / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    
    let result = days === 1 ? "1 dia" : `${days} dias`;
    if (hours > 0) result += ` ${hours}h`;
    return result;
  }

  if (diffMin >= 60) {
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  
  return `${diffMin} min`;
}

/**
 * Formata o tempo de espera/chegada do ônibus em relação ao momento atual de forma amigável.
 */
export function formatBusWaitingTimeToFriendlyText(targetDateTimeStr: string, referenceDate?: Date | string | number): string {
  if (!targetDateTimeStr) return "Calculando...";
  
  const target = getNow(targetDateTimeStr);
  const now = getNow(referenceDate);
  
  if (!target.isValid()) return "Calculando...";

  const diffMin = target.diff(now, "minute");

  if (diffMin <= 0 && diffMin >= -2) {
    return "Chegando agora";
  }
  if (diffMin < -2) {
    return "Horário passou";
  }

  // menos de 60 minutos: “em X min”
  if (diffMin < 60) {
    return `em ${diffMin} min`;
  }

  // entre 60 minutos e 12 horas (algumas horas): “em XhY”
  if (diffMin < 12 * 60) {
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `em ${hours}h${mins}` : `em ${hours}h`;
  }

  // Se for mais de 12 horas, mostramos por dia relativo e horário
  const timeStr = target.format("HH:mm");

  const targetDate = target.startOf("day");
  const nowDate = now.startOf("day");
  const daysDiff = targetDate.diff(nowDate, "day");

  if (daysDiff === 0) {
    return `hoje às ${timeStr}`;
  }
  
  if (daysDiff === 1) {
    return `amanhã às ${timeStr}`;
  }
  
  if (daysDiff > 1 && daysDiff <= 7) {
    const weekDays = [
      "domingo",
      "segunda-feira",
      "terça-feira",
      "quarta-feira",
      "quinta-feira",
      "sexta-feira",
      "sábado"
    ];
    const dayOfWeekName = weekDays[target.day()];
    return `${dayOfWeekName} às ${timeStr}`;
  }

  return "Escolha outro horário";
}

export function formatBusWaitingTimeToFriendlyTextShort(targetDateTimeStr: string, referenceDate?: Date | string | number): string {
  if (!targetDateTimeStr) return "Calculando...";
  
  const target = getNow(targetDateTimeStr);
  const now = getNow(referenceDate);
  
  if (!target.isValid()) return "Calculando...";

  const diffMin = target.diff(now, "minute");

  if (diffMin <= 0 && diffMin >= -2) {
    return "Chegando agora";
  }
  if (diffMin < -2) {
    return "Horário passou";
  }

  // menos de 60 minutos: “em X min”
  if (diffMin < 60) {
    return `em ${diffMin} min`;
  }

  // entre 60 minutos e 12 horas (algumas horas): “em XhY”
  if (diffMin < 12 * 60) {
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `em ${hours}h${mins}` : `em ${hours}h`;
  }

  // Se for mais de 12 horas, mostramos por dia relativo e horário
  const timeStr = target.format("HH:mm");

  const targetDate = target.startOf("day");
  const nowDate = now.startOf("day");
  const daysDiff = targetDate.diff(nowDate, "day");

  if (daysDiff === 0) {
    return `hoje, ${timeStr}`;
  }
  
  if (daysDiff === 1) {
    return `amanhã, ${timeStr}`;
  }
  
  if (daysDiff > 1 && daysDiff <= 7) {
    const weekDaysShort = [
      "domingo",
      "segunda",
      "terça",
      "quarta",
      "quinta",
      "sexta",
      "sábado"
    ];
    const dayOfWeekName = weekDaysShort[target.day()];
    return `${dayOfWeekName}, ${timeStr}`;
  }

  return "Outro horário";
}
