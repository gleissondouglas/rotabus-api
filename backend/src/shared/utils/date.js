const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "America/Sao_Paulo";

/**
 * Converte um texto de duração (ex: "1200s") em minutos arredondados para cima.
 */
function getMinutesFromDuration(durationText) {
  if (!durationText) return 0;
  const seconds = parseInt(String(durationText).replace("s", ""), 10) || 0;
  return Math.ceil(seconds / 60);
}

/**
 * Formata um objeto Date ou string ISO em HH:mm no fuso horário da aplicação.
 */
function formatTimeFromDateTime(dateTime) {
  if (!dateTime) return "";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Retorna a chave de data local (YYYY-MM-DD) no fuso horário da aplicação.
 */
function getLocalDateKey(dateTime) {
  if (!dateTime) return "";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Retorna o período do dia (manhã, tarde, noite, madrugada) baseada na hora.
 */
function getPeriodOfDay(hour) {
  if (hour >= 5 && hour < 12) return "da manhã";
  if (hour >= 12 && hour < 18) return "da tarde";
  if (hour >= 18 && hour <= 23) return "da noite";
  return "da madrugada";
}

/**
 * Formata um horário com o período do dia (ex: 14:30 da tarde).
 */
function formatTimeWithPeriod(dateTime) {
  if (!dateTime) return "";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);

  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${time} ${getPeriodOfDay(hour)}`;
}

/**
 * Formata uma data de forma amigável e relativa (hoje às..., amanhã às...).
 */
function formatRelativeDateTime(dateTime) {
  if (!dateTime) return "";

  const targetDateKey = getLocalDateKey(dateTime);
  const now = new Date();
  const todayDateKey = getLocalDateKey(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDateKey = getLocalDateKey(tomorrow);

  const time = formatTimeWithPeriod(dateTime);

  if (targetDateKey === todayDateKey) {
    return `hoje às ${time}`;
  }

  if (targetDateKey === tomorrowDateKey) {
    return `amanhã às ${time}`;
  }

  const date = new Date(dateTime);
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  return `${formattedDate} às ${time}`;
}

/**
 * Reconstrói uma data ISO completa a partir de um texto de hora (HH:mm)
 * e uma data de referência, garantindo o fuso horário correto.
 */
function buildDateTimeFromTimeText(timeText, referenceDateTime) {
  if (!timeText || !referenceDateTime) return "";

  const [hourText, minuteText] = timeText.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";

  const reference = new Date(referenceDateTime);
  if (Number.isNaN(reference.getTime())) return "";

  const localDateKey = getLocalDateKey(referenceDateTime);
  if (!localDateKey) return "";

  const hourFormatted = String(hour).padStart(2, "0");
  const minuteFormatted = String(minute).padStart(2, "0");

  // TODO: Tornar o offset dinâmico baseado no APP_TIME_ZONE se necessário no futuro.
  const localDateTimeText = `${localDateKey}T${hourFormatted}:${minuteFormatted}:00-03:00`;

  let candidate = new Date(localDateTimeText);

  if (Number.isNaN(candidate.getTime())) return "";

  // Se a hora resultante for anterior à referência (ex: meia-noite), assume que é o dia seguinte.
  if (candidate.getTime() < reference.getTime()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }

  return candidate.toISOString();
}

/**
 * Subtrai minutos de uma data ISO.
 */
function subtractMinutesFromDateTime(dateTime, minutesToSubtract) {
  if (!dateTime) return "";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "";

  return new Date(date.getTime() - minutesToSubtract * 60 * 1000).toISOString();
}

/**
 * Calcula a diferença em minutos entre dois horários HH:mm.
 */
function calculateTimeDifferenceInMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return 0;
  }

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  if (endTotal >= startTotal) {
    return endTotal - startTotal;
  }

  return 1440 - startTotal + endTotal;
}

/**
 * Calcula a diferença em minutos entre duas datas ISO.
 */
function calculateTimeDifferenceFromDateTimes(startDateTime, endDateTime) {
  if (!startDateTime || !endDateTime) return 0;

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;

  return Math.ceil(diffMs / 1000 / 60);
}

/**
 * Subtrai minutos de um texto de hora (HH:mm) e retorna no mesmo formato,
 * respeitando o fuso horário da aplicação.
 */
function subtractMinutes(timeText, minutesToSubtract, referenceDateTime) {
  if (!timeText) return "";

  const inferredDateTime = buildDateTimeFromTimeText(timeText, referenceDateTime);
  if (!inferredDateTime) return "";

  const date = new Date(inferredDateTime);
  date.setMinutes(date.getMinutes() - minutesToSubtract);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

module.exports = {
  APP_TIME_ZONE,
  getMinutesFromDuration,
  formatTimeFromDateTime,
  getLocalDateKey,
  getPeriodOfDay,
  formatTimeWithPeriod,
  formatRelativeDateTime,
  buildDateTimeFromTimeText,
  subtractMinutes,
  subtractMinutesFromDateTime,
  calculateTimeDifferenceInMinutes,
  calculateTimeDifferenceFromDateTimes,
};
