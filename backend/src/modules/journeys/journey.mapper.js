const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "America/Sao_Paulo";
const MAX_INITIAL_WALK_MINUTES = 25;

function getSecondsFromDuration(durationText) {
  if (!durationText) return 0;

  return parseInt(String(durationText).replace("s", ""), 10) || 0;
}

function getMinutesFromDuration(durationText) {
  const seconds = getSecondsFromDuration(durationText);
  return Math.ceil(seconds / 60);
}

function getShortStopName(stopName) {
  if (!stopName) return "ponto não identificado";

  return stopName.split(",")[0].trim();
}

function getPeriodOfDay(hour) {
  if (hour >= 5 && hour < 12) return "da manhã";
  if (hour >= 12 && hour < 18) return "da tarde";
  if (hour >= 18 && hour <= 23) return "da noite";
  return "da madrugada";
}

function formatTimeFromDateTime(dateTime) {
  if (!dateTime) return "";

  const date = new Date(dateTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getLocalDateKey(dateTime) {
  if (!dateTime) return "";

  const date = new Date(dateTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatTimeWithPeriod(dateTime) {
  if (!dateTime) return "";

  const date = new Date(dateTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

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

function buildDateTimeFromTimeText(timeText, referenceDateTime) {
  if (!timeText || !referenceDateTime) return "";

  const [hourText, minuteText] = timeText.split(":");

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return "";
  }

  const reference = new Date(referenceDateTime);

  if (Number.isNaN(reference.getTime())) {
    return "";
  }

  const localDateKey = getLocalDateKey(referenceDateTime);

  if (!localDateKey) {
    return "";
  }

  const hourFormatted = String(hour).padStart(2, "0");
  const minuteFormatted = String(minute).padStart(2, "0");

  const localDateTimeText = `${localDateKey}T${hourFormatted}:${minuteFormatted}:00-03:00`;

  let candidate = new Date(localDateTimeText);

  if (Number.isNaN(candidate.getTime())) {
    return "";
  }

  if (candidate.getTime() < reference.getTime()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }

  return candidate.toISOString();
}

function subtractMinutesFromDateTime(dateTime, minutesToSubtract) {
  if (!dateTime) return "";

  const date = new Date(dateTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() - minutesToSubtract * 60 * 1000).toISOString();
}

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

function calculateInitialWalkMinutes(mappedSteps) {
  let total = 0;

  for (const step of mappedSteps) {
    if (step.type === "walk") {
      total += step.durationMin || 0;
      continue;
    }

    if (step.type === "transit") {
      break;
    }
  }

  return total;
}

function calculateInitialWalkDistance(mappedSteps) {
  let total = 0;

  for (const step of mappedSteps) {
    if (step.type === "walk") {
      total += step.distanceMeters || 0;
      continue;
    }

    if (step.type === "transit") {
      break;
    }
  }

  return total;
}

function calculateFinalWalkMinutes(mappedSteps) {
  let total = 0;
  let foundLastTransit = false;

  for (let i = mappedSteps.length - 1; i >= 0; i--) {
    const step = mappedSteps[i];

    if (step.type === "transit") {
      foundLastTransit = true;
      break;
    }

    if (step.type === "walk") {
      total += step.durationMin || 0;
    }
  }

  return foundLastTransit ? total : 0;
}

function calculateTotalWalkMinutes(mappedSteps) {
  return mappedSteps
    .filter((step) => step.type === "walk")
    .reduce((total, step) => total + (step.durationMin || 0), 0);
}

function calculateTransitMinutes(mappedSteps) {
  return mappedSteps
    .filter((step) => step.type === "transit")
    .reduce((total, step) => {
      if (step.departureDateTime && step.arrivalDateTime) {
        return (
          total +
          calculateTimeDifferenceFromDateTimes(
            step.departureDateTime,
            step.arrivalDateTime,
          )
        );
      }

      if (!step.departureTime || !step.arrivalTime) return total;

      return (
        total +
        calculateTimeDifferenceInMinutes(step.departureTime, step.arrivalTime)
      );
    }, 0);
}

function subtractMinutes(timeText, minutesToSubtract, referenceDateTime) {
  if (!timeText) return "";

  const [hours, minutes] = timeText.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return "";
  }

  const date = referenceDateTime ? new Date(referenceDateTime) : new Date();
  date.setHours(hours);
  date.setMinutes(minutes - minutesToSubtract);
  date.setSeconds(0);
  date.setMilliseconds(0);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getStepDepartureText(step, referenceDateTime) {
  if (step.departureDateTime) {
    return formatRelativeDateTime(step.departureDateTime);
  }

  if (step.departureTime) {
    const inferredDateTime = buildDateTimeFromTimeText(
      step.departureTime,
      referenceDateTime,
    );

    if (inferredDateTime) {
      return formatRelativeDateTime(inferredDateTime);
    }

    return `às ${step.departureTime}`;
  }

  return "";
}

function getStepArrivalText(step, referenceDateTime) {
  if (step.arrivalDateTime) {
    return formatRelativeDateTime(step.arrivalDateTime);
  }

  if (step.arrivalTime) {
    const inferredDateTime = buildDateTimeFromTimeText(
      step.arrivalTime,
      referenceDateTime,
    );

    if (inferredDateTime) {
      return formatRelativeDateTime(inferredDateTime);
    }

    return `às ${step.arrivalTime}`;
  }

  return "";
}

function buildTransitInstruction(
  step,
  index,
  totalTransitSteps,
  referenceDateTime,
) {
  const line = step.line || "linha não identificada";
  const from = getShortStopName(step.from);
  const to = getShortStopName(step.to);
  const headsign = step.headsign ? `, sentido ${step.headsign}` : "";

  const departureText = getStepDepartureText(step, referenceDateTime);
  const arrivalText = getStepArrivalText(step, referenceDateTime);

  if (index === 0) {
    return `Pegue o ônibus ${line}${headsign} ${departureText} no ponto da ${from}. Desça no ponto da ${to} ${arrivalText}.`;
  }

  return `Depois, pegue o ônibus ${line}${headsign} ${departureText}. Desça no ponto da ${to} ${arrivalText}.`;
}

function buildFriendlyMessage(mappedSteps, summary) {
  const transitSteps = mappedSteps.filter((step) => step.type === "transit");

  if (transitSteps.length === 0) {
    return "Rota encontrada. Você pode ir caminhando até o destino.";
  }

  const firstTransit = transitSteps[0];
  const firstStop = getShortStopName(firstTransit.from);

  const intro =
    summary.timeType === "ARRIVAL"
      ? `Para chegar ${summary.arrivalAtDestinationText}, saia de onde você está ${summary.leaveHomeText}.`
      : `Saia de onde você está ${summary.leaveHomeText}.`;

  const walkToStop =
    summary.initialWalkTimeMin > 0
      ? ` Caminhe cerca de ${summary.initialWalkTimeMin} minuto${summary.initialWalkTimeMin > 1 ? "s" : ""} até o ponto da ${firstStop}.`
      : ` Vá até o ponto da ${firstStop}.`;

  const transitInstructions = transitSteps
    .map((step, index) =>
      buildTransitInstruction(
        step,
        index,
        transitSteps.length,
        summary.referenceDateTime,
      ),
    )
    .join(" ");

  const finalWalk =
    summary.finalWalkTimeMin > 0
      ? ` Depois, caminhe cerca de ${summary.finalWalkTimeMin} minuto${summary.finalWalkTimeMin > 1 ? "s" : ""} até o destino final.`
      : " Depois, siga até o destino final.";

  const arrival = summary.arrivalAtDestinationText
    ? ` Você deve chegar ${summary.arrivalAtDestinationText}.`
    : "";

  return `${intro}${walkToStop} ${transitInstructions}${finalWalk}${arrival}`;
}

function buildVoiceBlock(mappedSteps, summary, detailedMessage) {
  const transitSteps = mappedSteps.filter((step) => step.type === "transit");

  if (transitSteps.length === 0) {
    return {
      shortMessage: "Você pode ir caminhando até o destino.",
      detailedMessage: "Rota encontrada. Você pode ir caminhando até o destino.",
      firstStopQuestion: "",
      firstStopGuideMessage: "",
      followUpQuestion: "Quer que eu busque outro lugar ou posso ajudar com mais alguma coisa?",
    };
  }

  const firstTransit = transitSteps[0];
  const firstStop = getShortStopName(firstTransit.from);
  const line = firstTransit.line || "ônibus";

  const shortMessage = `Encontrei uma rota para você. Saia de onde você está por volta das ${summary.leaveHomeAt} e pegue o ônibus ${line} às ${summary.beAtStopAt}.`;

  const firstStopQuestion =
    summary.initialWalkTimeMin > 3
      ? `O ponto fica a cerca de ${summary.initialWalkTimeMin} minutos de caminhada. Você quer que eu te guie até ele?`
      : "";

  const firstStopGuideMessage =
    summary.initialWalkTimeMin > 0
      ? `Tudo bem. Caminhe cerca de ${summary.initialWalkDistanceMeters} metros até o ponto ${firstStop}.`
      : `O ponto ${firstStop} fica bem próximo de você.`;

  return {
    shortMessage,
    detailedMessage,
    firstStopQuestion,
    firstStopGuideMessage,
    followUpQuestion: "Deseja planejar outra rota ou precisa de mais alguma informação?",
  };
}

function buildScreenBlock(summary) {
  const line = summary.busLines.length > 0 ? summary.busLines[0] : "ônibus";

  return {
    title: "Rota recomendada",
    subtitle: `Saia às ${summary.leaveHomeAt} • Ônibus ${line} • Chegada ${summary.arrivalAtDestination}`,
    showFirstStopHelpButton: summary.initialWalkTimeMin > 3,
    firstStopHelpButtonText: "Me guiar até o ponto",
  };
}

function buildFirstStopGuideBlock(mappedSteps, summary) {
  const transitSteps = mappedSteps.filter((step) => step.type === "transit");

  if (transitSteps.length === 0) {
    return { available: false };
  }

  const firstTransit = transitSteps[0];
  const firstStopName = getShortStopName(firstTransit.from);
  const line = firstTransit.line || "ônibus";

  // Coletamos os passos detalhados de caminhada até o ponto
  const walkingSteps = buildDetailedWalkingStepsFromMappedSteps(mappedSteps);

  return {
    available: true,
    stopName: firstStopName,
    busLine: line,
    departureTime: summary.beAtStopAt,
    beAtStopDateTime: summary.beAtStopDateTime,
    walkDurationMin: summary.initialWalkTimeMin,
    walkDistanceMeters: summary.initialWalkDistanceMeters,
    instruction: `Caminhe cerca de ${summary.initialWalkDistanceMeters} metros até o ponto ${firstStopName}.`,
    voiceInstruction: `Saia de onde você está por volta das ${summary.leaveHomeAt} e caminhe cerca de ${summary.initialWalkDistanceMeters} metros até o ponto. O ônibus ${line} passa por volta das ${summary.beAtStopAt}.`,
    walkingSteps,
    hasValidWalkingSteps: walkingSteps.length > 0
  };
}

function buildDetailedWalkingStepsFromMappedSteps(mappedSteps) {
  const walkingSteps = [];
  let stepIndex = 0;

  for (const step of mappedSteps) {
    if (step.type === "walk") {
      // Se o mappedStep já for "walk", ele representa um trecho da Google
      walkingSteps.push({
        id: `walk-step-${stepIndex}`,
        instruction: step.instruction,
        humanInstruction: step.humanInstruction,
        maneuver: step.maneuver,
        distanceMeters: step.distanceMeters,
        durationSeconds: step.durationMin * 60,
        encodedPolyline: step.polyline,
        startLocation: step.startLocation 
          ? { latitude: step.startLocation.lat, longitude: step.startLocation.lng }
          : null,
        endLocation: step.endLocation
          ? { latitude: step.endLocation.lat, longitude: step.endLocation.lng }
          : null,
        stepIndex
      });
      stepIndex++;
    } else if (step.type === "transit") {
      break;
    }
  }

  return walkingSteps;
}

function humanizeWalkingInstruction(instruction, maneuver) {
  if (!instruction) return "Siga pelo caminho indicado";

  let text = instruction.trim();

  // Simplificação de Manobras
  if (maneuver) {
    const m = maneuver.toUpperCase();
    if (m.includes("TURN_RIGHT")) text = "Vire à direita";
    else if (m.includes("TURN_LEFT")) text = "Vire à esquerda";
    else if (m.includes("TURN_SLIGHT_RIGHT")) text = "Vire levemente à direita";
    else if (m.includes("TURN_SLIGHT_LEFT")) text = "Vire levemente à esquerda";
    else if (m.includes("TURN_SHARP_RIGHT")) text = "Vire acentuadamente à direita";
    else if (m.includes("TURN_SHARP_LEFT")) text = "Vire acentuadamente à esquerda";
    else if (m.includes("UTURN_RIGHT")) text = "Faça o retorno à direita";
    else if (m.includes("UTURN_LEFT")) text = "Faça o retorno à esquerda";
    else if (m.includes("STRAIGHT")) text = "Siga em frente";
    else if (m.includes("RAMP_RIGHT")) text = "Pegue a rampa à direita";
    else if (m.includes("RAMP_LEFT")) text = "Pegue a rampa à esquerda";
  }

  // Remoção de termos técnicos e direções cardeais
  text = text.replace(/Siga na direção (norte|sul|leste|oeste|nordeste|sudeste|noroeste|sudoeste)/gi, "Siga");
  text = text.replace(/na direção (norte|sul|leste|oeste|nordeste|sudeste|noroeste|sudoeste)/gi, "");
  text = text.replace(/ em direção a (.*)/gi, ""); 
  
  // Padronização de nomes de ruas
  text = text.replace(/Siga na R\. /gi, "Siga pela Rua ");
  text = text.replace(/Siga na /gi, "Siga pela ");
  text = text.replace(/Siga para /gi, "Siga pela ");
  text = text.replace(/ na R\. /gi, " na Rua ");
  text = text.replace(/ à R\. /gi, " à Rua ");

  // Garante primeira letra maiúscula
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildAlerts(transfers) {
  const alerts = [
    "Chegue ao ponto alguns minutos antes do horário indicado.",
    "Confira o número e o sentido do ônibus antes de embarcar.",
    "Os horários podem variar conforme o trânsito e a operação do transporte.",
  ];

  if (transfers > 0) {
    alerts.push(
      "Essa rota tem troca de ônibus. Preste atenção no ponto onde deve descer.",
    );
  }

  return alerts;
}

function stripHtmlTags(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '');
}

function mapGoogleStepToJourneyStep(step) {
  const startLocation = step.startLocation?.latLng 
    ? { lat: step.startLocation.latLng.latitude, lng: step.startLocation.latLng.longitude }
    : null;
  const endLocation = step.endLocation?.latLng
    ? { lat: step.endLocation.latLng.latitude, lng: step.endLocation.latLng.longitude }
    : null;

  if (step.travelMode === "WALK") {
    const rawInstruction = stripHtmlTags(step.navigationInstruction?.instructions) || "Caminhe";
    const maneuver = step.navigationInstruction?.maneuver || null;

    return {
      type: "walk",
      instruction: rawInstruction,
      humanInstruction: humanizeWalkingInstruction(rawInstruction, maneuver),
      maneuver,
      distanceMeters: step.distanceMeters || 0,
      durationMin: getMinutesFromDuration(step.staticDuration),
      polyline: step.polyline?.encodedPolyline || "",
      startLocation,
      endLocation,
    };
  }

  if (step.travelMode === "TRANSIT") {
    const departureDateTime =
      step.transitDetails?.stopDetails?.departureTime || "";

    const arrivalDateTime = step.transitDetails?.stopDetails?.arrivalTime || "";

    return {
      type: "transit",
      line:
        step.transitDetails?.transitLine?.nameShort ||
        step.transitDetails?.transitLine?.name ||
        "Linha não identificada",
      from:
        step.transitDetails?.stopDetails?.departureStop?.name ||
        "Ponto de partida não identificado",
      to:
        step.transitDetails?.stopDetails?.arrivalStop?.name ||
        "Ponto de chegada não identificado",
      departureTime:
        step.transitDetails?.localizedValues?.departureTime?.time?.text ||
        formatTimeFromDateTime(departureDateTime),
      arrivalTime:
        step.transitDetails?.localizedValues?.arrivalTime?.time?.text ||
        formatTimeFromDateTime(arrivalDateTime),
      departureDateTime,
      arrivalDateTime,
      stopCount: step.transitDetails?.stopCount || 0,
      headsign: step.transitDetails?.headsign || "",
      polyline: step.polyline?.encodedPolyline || "",
      startLocation,
      endLocation,
      departureLocation: {
        lat: step.transitDetails?.stopDetails?.departureStop?.location?.latLng?.latitude,
        lng: step.transitDetails?.stopDetails?.departureStop?.location?.latLng?.longitude,
      },
      arrivalLocation: {
        lat: step.transitDetails?.stopDetails?.arrivalStop?.location?.latLng?.latitude,
        lng: step.transitDetails?.stopDetails?.arrivalStop?.location?.latLng?.longitude,
      },
      departureStopLocation: {
        latitude: step.transitDetails?.stopDetails?.departureStop?.location?.latLng?.latitude,
        longitude: step.transitDetails?.stopDetails?.departureStop?.location?.latLng?.longitude,
      },
      arrivalStopLocation: {
        latitude: step.transitDetails?.stopDetails?.arrivalStop?.location?.latLng?.latitude,
        longitude: step.transitDetails?.stopDetails?.arrivalStop?.location?.latLng?.longitude,
      },
    };
  }

  return {
    type: "unknown",
    instruction: "Etapa não identificada.",
    startLocation,
    endLocation,
  };
}

function buildMapBlock(mappedSteps, origin) {
  const markers = [];
  const polylines = [];

  // 1. Marker de Origem (Ponto de partida da rota)
  markers.push({
    id: "route-origin",
    type: "origin",
    title: "Ponto de partida",
    lat: origin.lat,
    lng: origin.lng,
  });

  const transitSteps = mappedSteps.filter((s) => s.type === "transit");

  if (transitSteps.length > 0) {
    // 2. Marker de Embarque (Primeiro Ônibus)
    const firstTransit = transitSteps[0];
    if (firstTransit.departureLocation) {
      markers.push({
        id: "boarding-stop",
        type: "boarding_stop",
        title: "Embarque",
        description: firstTransit.from,
        lat: firstTransit.departureLocation.lat,
        lng: firstTransit.departureLocation.lng,
      });
    }

    // 3. Markers de Troca (Se houver mais de um ônibus)
    if (transitSteps.length > 1) {
      for (let i = 0; i < transitSteps.length - 1; i++) {
        const current = transitSteps[i];
        if (current.arrivalLocation) {
          markers.push({
            id: `transfer-${i}`,
            type: "transfer_stop",
            title: "Troca de ônibus",
            description: current.to,
            lat: current.arrivalLocation.lat,
            lng: current.arrivalLocation.lng,
          });
        }
      }
    }

    // 4. Marker de Descida (Último Ônibus)
    const lastTransit = transitSteps[transitSteps.length - 1];
    if (lastTransit.arrivalLocation) {
      markers.push({
        id: "dropoff-stop",
        type: "dropoff_stop",
        title: "Desça aqui",
        description: lastTransit.to,
        lat: lastTransit.arrivalLocation.lat,
        lng: lastTransit.arrivalLocation.lng,
      });
    }
  }

  // 5. Marker de Destino Final (Se o último step tiver endLocation)
  const lastStep = mappedSteps[mappedSteps.length - 1];
  if (lastStep?.endLocation) {
    markers.push({
      id: "destination",
      type: "destination",
      title: "Destino final",
      lat: lastStep.endLocation.lat,
      lng: lastStep.endLocation.lng,
    });
  }

  // 6. Polylines
  mappedSteps.forEach((step, index) => {
    if (step.polyline) {
      polylines.push({
        id: `polyline-${index}`,
        type: step.type === "transit" ? "bus" : "walk",
        encodedPolyline: step.polyline,
        line: step.line,
      });
    }
  });

  return {
    userLocation: origin,
    markers,
    polylines,
  };
}

function buildSummary({ route, mappedSteps, timePreference }) {
  const transitSteps = mappedSteps.filter((step) => step.type === "transit");

  const firstTransitStep = transitSteps[0];
  const lastTransitStep = transitSteps[transitSteps.length - 1];

  const initialWalkTimeMin = calculateInitialWalkMinutes(mappedSteps);
  const initialWalkDistanceMeters = calculateInitialWalkDistance(mappedSteps);
  const finalWalkTimeMin = calculateFinalWalkMinutes(mappedSteps);
  const totalWalkTimeMin = calculateTotalWalkMinutes(mappedSteps);
  const busTimeMin = calculateTransitMinutes(mappedSteps);

  const referenceDateTime =
    timePreference?.dateTime || new Date().toISOString();

  const firstDepartureDateTime =
    firstTransitStep?.departureDateTime ||
    buildDateTimeFromTimeText(
      firstTransitStep?.departureTime,
      referenceDateTime,
    );

  const lastArrivalDateTime =
    lastTransitStep?.arrivalDateTime ||
    buildDateTimeFromTimeText(lastTransitStep?.arrivalTime, referenceDateTime);

  const leaveHomeAt = firstTransitStep?.departureTime
    ? subtractMinutes(firstTransitStep.departureTime, initialWalkTimeMin, referenceDateTime)
    : "";

  const leaveHomeDateTime = firstDepartureDateTime
    ? subtractMinutesFromDateTime(firstDepartureDateTime, initialWalkTimeMin)
    : "";

  const beAtStopDateTime = firstDepartureDateTime || "";

  const arrivalAtDestinationDateTime = lastArrivalDateTime || "";

  const leaveHomeText = formatRelativeDateTime(leaveHomeDateTime);
  const beAtStopText = formatRelativeDateTime(beAtStopDateTime);
  const arrivalAtDestinationText = formatRelativeDateTime(
    arrivalAtDestinationDateTime,
  );

  const busLines = [
    ...new Set(
      transitSteps
        .map((step) => step.line)
        .filter((line) => line && line !== "Linha não identificada"),
    ),
  ];

  const transfers = transitSteps.length > 0 ? transitSteps.length - 1 : 0;

  return {
    timeType: timePreference?.type || "DEPARTURE",
    requestedTime: formatTimeFromDateTime(timePreference?.dateTime),
    referenceDateTime,

    leaveHomeAt,
    beAtStopAt: firstTransitStep?.departureTime || "",
    arrivalAtDestination: lastTransitStep?.arrivalTime || "",

    leaveHomeDateTime,
    beAtStopDateTime,
    arrivalAtDestinationDateTime,

    leaveHomeText,
    beAtStopText,
    arrivalAtDestinationText,

    totalDurationMin: getMinutesFromDuration(route.duration),
    busLines,
    transfers,
    initialWalkTimeMin,
    initialWalkDistanceMeters,
    finalWalkTimeMin,
    totalWalkTimeMin,
    busTimeMin,
    overviewPolyline: route.polyline?.encodedPolyline || "",
  };
}

function mapSingleRouteToJourney(route, origin, timePreference = null, routeIndex = 0) {
  const steps = route.legs?.[0]?.steps || [];

  if (steps.length === 0) {
    return null;
  }

  const mappedSteps = steps.map(mapGoogleStepToJourneyStep);

  const summary = buildSummary({
    route,
    mappedSteps,
    timePreference,
  });

  const detailedMessage = buildFriendlyMessage(mappedSteps, summary);
  const alerts = buildAlerts(summary.transfers);

  const voice = buildVoiceBlock(mappedSteps, summary, detailedMessage);
  const screen = buildScreenBlock(summary);
  const firstStopGuide = buildFirstStopGuideBlock(mappedSteps, summary);
  const mapData = buildMapBlock(mappedSteps, origin);

  return {
    routeIndex,
    summary,
    voice,
    screen,
    firstStopGuide,
    alerts,
    steps: mappedSteps,
    map: mapData,
  };
}

function chooseBestJourney(candidates, timePreference = null) {
  const validCandidates = candidates.filter(Boolean);

  if (validCandidates.length === 0) {
    const error = new Error(
      "Não consegui encontrar nenhuma opção de ônibus para este trajeto no momento. Tente mudar o horário de partida ou verificar se os nomes dos lugares estão corretos.",
    );
    error.statusCode = 404;
    throw error;
  }

  const isArrival = timePreference?.type === "ARRIVAL";
  const limit = isArrival ? 30 : MAX_INITIAL_WALK_MINUTES;

  // Filtra candidatos que estão dentro do limite de caminhada
  const accessibleCandidates = validCandidates.filter(
    (candidate) => candidate.summary.initialWalkTimeMin <= limit,
  );

  // Se nenhum for "acessível", usamos todos os válidos para não deixar o usuário sem resposta
  const pool =
    accessibleCandidates.length > 0 ? accessibleCandidates : validCandidates;

  return [...pool].sort((a, b) => {
    const aHasTransit = a.steps.some((s) => s.type === "transit");
    const bHasTransit = b.steps.some((s) => s.type === "transit");

    // 1. Prioridade absoluta: Se uma rota tem ônibus e a outra não, prefere a que tem ônibus
    if (aHasTransit && !bHasTransit) return -1;
    if (!aHasTransit && bHasTransit) return 1;

    // 2. Prioridade de Horário
    if (timePreference?.dateTime) {
      const targetTime = new Date(timePreference.dateTime).getTime();

      if (isArrival) {
        // Se for ARRIVAL, prioriza quem chega mais perto do horário solicitado
        const arrivalA = new Date(a.summary.arrivalAtDestinationDateTime).getTime();
        const arrivalB = new Date(b.summary.arrivalAtDestinationDateTime).getTime();
        const diffA = Math.abs(targetTime - arrivalA);
        const diffB = Math.abs(targetTime - arrivalB);
        if (diffA !== diffB) return diffA - diffB;
      } else {
        // Se for DEPARTURE, prioriza quem SAI mais perto do horário solicitado (a próxima a sair)
        const departureA = new Date(a.summary.leaveHomeDateTime).getTime();
        const departureB = new Date(b.summary.leaveHomeDateTime).getTime();
        
        // Queremos a que sai mais cedo/próximo do solicitado
        if (departureA !== departureB) return departureA - departureB;
      }
    }

    // 3. Critério de desempate: Menos caminhada inicial
    if (a.summary.initialWalkTimeMin !== b.summary.initialWalkTimeMin) {
      return a.summary.initialWalkTimeMin - b.summary.initialWalkTimeMin;
    }

    // 4. Menos trocas de ônibus
    if (a.summary.transfers !== b.summary.transfers) {
      return a.summary.transfers - b.summary.transfers;
    }

    // 5. Menor duração total
    return a.summary.totalDurationMin - b.summary.totalDurationMin;
  })[0];
}

function mapGoogleRouteToJourney(googleResponse, origin, timePreference = null) {
  const routes = googleResponse?.routes || [];

  if (routes.length === 0) {
    const error = new Error(
      "Ops! Não encontrei nenhuma rota de transporte público para este destino. Verifique se o local de destino existe em Uberaba ou tente um horário diferente.",
    );
    error.statusCode = 404;
    throw error;
  }

  const candidates = routes
    .map((route, index) =>
      mapSingleRouteToJourney(route, origin, timePreference, index),
    )
    .filter(Boolean);

  const bestJourney = chooseBestJourney(candidates, timePreference);

  // Filtra as alternativas removendo a que foi escolhida como melhor
  const alternatives = candidates.filter(
    (c) => c.routeIndex !== bestJourney.routeIndex,
  );

  return {
    summary: bestJourney.summary,
    voice: bestJourney.voice,
    screen: bestJourney.screen,
    firstStopGuide: bestJourney.firstStopGuide,
    alerts: bestJourney.alerts,
    steps: bestJourney.steps,
    map: bestJourney.map,
    alternatives: alternatives.map((alt) => ({
      summary: alt.summary,
      voice: alt.voice,
      screen: alt.screen,
      firstStopGuide: alt.firstStopGuide,
      alerts: alt.alerts,
      steps: alt.steps,
      map: alt.map,
      routeIndex: alt.routeIndex,
    })),
    metadata: {
      selectedRouteIndex: bestJourney.routeIndex,
      alternativesFound: routes.length,
    },
  };
}

module.exports = {
  mapGoogleRouteToJourney,
};
