function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Formata uma data para o formato ISO 8601 com o offset do fuso horário local.
 * Exemplo: 2026-05-12T13:46:29-03:00
 */
export function formatLocalDateTimeWithOffset(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const timezoneOffsetMinutes = -date.getTimezoneOffset();
  const sign = timezoneOffsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(timezoneOffsetMinutes);
  const offsetHours = pad(Math.floor(absoluteOffset / 60));
  const offsetMinutes = pad(absoluteOffset % 60);

  const formatted = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
  
  console.log(`[DateTime] Formatando data local: ${date.toLocaleString()}`);
  console.log(`[DateTime] Resultado com offset: ${formatted}`);
  
  return formatted;
}

export function getTodayDateText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeText() {
  const now = new Date();
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${hours}:${minutes}`;
}

/**
 * Constrói uma string ISO com offset a partir de strings de data e hora.
 * Garante que o horário informado seja interpretado como horário local do aparelho.
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

  const [yearText, monthText, dayText] = date.split("-");
  const [hourText, minuteText] = time.split(":");

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    throw new Error("Data ou horário inválido.");
  }

  // Cria a data usando o horário LOCAL do aparelho
  const localDate = new Date(year, month - 1, day, hour, minute, 0);

  if (Number.isNaN(localDate.getTime())) {
    throw new Error("Data ou horário inválido.");
  }

  return formatLocalDateTimeWithOffset(localDate);
}

/**
 * Formata minutos em uma string amigável.
 * Exemplo: 288 -> "4h48min"
 * Exemplo: 45 -> "45 min"
 */
export function formatMinutesToFriendlyText(diffMin: number) {
  if (diffMin <= 0) return "Chegando";
  if (diffMin >= 60) {
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
  }
  return `${diffMin} min`;
}
