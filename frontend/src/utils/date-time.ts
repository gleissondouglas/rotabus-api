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
export interface Next7DaysOption {
  dateText: string;
  label: string;
  dayNum: number;
}

export function getNext7Days(referenceDate = new Date()): Next7DaysOption[] {
  const options: Next7DaysOption[] = [];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() + i
    );
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const dateText = `${year}-${month}-${day}`;

    let label = "";
    if (i === 0) {
      label = "Hoje";
    } else if (i === 1) {
      label = "Amanhã";
    } else {
      label = weekDays[d.getDay()];
    }

    options.push({
      dateText,
      label,
      dayNum: d.getDate(),
    });
  }

  return options;
}

export function formatMinutesToFriendlyText(diffMin: number) {
  if (diffMin <= 0) return "Chegando";
  if (diffMin >= 60) {
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
  }
  return `${diffMin} min`;
}

/**
 * Formata o tempo de espera/chegada do ônibus em relação ao momento atual de forma amigável.
 */
export function formatBusWaitingTimeToFriendlyText(targetDateTimeStr: string, referenceDate = new Date()): string {
  if (!targetDateTimeStr) return "Calculando...";
  const target = new Date(targetDateTimeStr);
  const now = referenceDate;
  if (Number.isNaN(target.getTime())) return "Calculando...";

  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.ceil(diffMs / 60000);

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
  const pad = (v: number) => String(v).padStart(2, "0");
  const timeStr = `${pad(target.getHours())}:${pad(target.getMinutes())}`;

  // Compara as datas (removendo a hora) para saber o dia relativo
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneDayMs = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round((targetDate.getTime() - nowDate.getTime()) / oneDayMs);

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
    const dayOfWeekName = weekDays[target.getDay()];
    return `${dayOfWeekName} às ${timeStr}`;
  }

  return "Escolha outro horário";
}

export function formatBusWaitingTimeToFriendlyTextShort(targetDateTimeStr: string, referenceDate = new Date()): string {
  if (!targetDateTimeStr) return "Calculando...";
  const target = new Date(targetDateTimeStr);
  const now = referenceDate;
  if (Number.isNaN(target.getTime())) return "Calculando...";

  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.ceil(diffMs / 60000);

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
  const pad = (v: number) => String(v).padStart(2, "0");
  const timeStr = `${pad(target.getHours())}:${pad(target.getMinutes())}`;

  // Compara as datas (removendo a hora) para saber o dia relativo
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneDayMs = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round((targetDate.getTime() - nowDate.getTime()) / oneDayMs);

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
    const dayOfWeekName = weekDaysShort[target.getDay()];
    return `${dayOfWeekName}, ${timeStr}`;
  }

  return "Outro horário";
}

