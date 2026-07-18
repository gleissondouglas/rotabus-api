const { formatRelativeDateTime, buildDateTimeFromTimeText } = require("../../../shared/utils/date");
const { getShortStopName } = require("./mapper-helpers");

/**
 * Simplifica instruções de caminhada para voz/leitura.
 */
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
  text = text.replace(
    /Siga na direção (norte|sul|leste|oeste|nordeste|sudeste|noroeste|sudoeste)/gi,
    "Siga",
  );
  text = text.replace(
    /na direção (norte|sul|leste|oeste|nordeste|sudeste|noroeste|sudoeste)/gi,
    "",
  );
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

function getStepDepartureText(step, referenceDateTime) {
  if (step.departureDateTime) {
    return formatRelativeDateTime(step.departureDateTime);
  }

  if (step.departureTime) {
    const inferredDateTime = buildDateTimeFromTimeText(step.departureTime, referenceDateTime);

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
    const inferredDateTime = buildDateTimeFromTimeText(step.arrivalTime, referenceDateTime);

    if (inferredDateTime) {
      return formatRelativeDateTime(inferredDateTime);
    }

    return `às ${step.arrivalTime}`;
  }

  return "";
}

function buildTransitInstruction(step, index, totalTransitSteps, referenceDateTime) {
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
      buildTransitInstruction(step, index, transitSteps.length, summary.referenceDateTime),
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
  const line = firstTransit.line || "ônibus";
  const headsign = firstTransit.headsign ? `, sentido ${firstTransit.headsign}` : "";

  const shortMessage = `Encontrei uma rota para você. Saia de onde você está por volta das ${summary.leaveHomeAt} e pegue o ônibus ${line}${headsign} às ${summary.beAtStopAt}.`;

  const firstStopQuestion =
    summary.initialWalkTimeMin > 3
      ? `O ponto fica a cerca de ${summary.initialWalkTimeMin} minutos de caminhada. Você quer que eu te guie até ele?`
      : "";

  const firstStopGuideMessage =
    summary.initialWalkTimeMin > 0
      ? `Tudo bem. Caminhe cerca de ${summary.initialWalkDistanceMeters} metros até o ponto ${getShortStopName(firstTransit.from)}.`
      : `O ponto ${getShortStopName(firstTransit.from)} fica bem próximo de você.`;

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

function buildDetailedWalkingStepsFromMappedSteps(mappedSteps) {
  const walkingSteps = [];
  let stepIndex = 0;

  for (const step of mappedSteps) {
    if (step.type === "walk") {
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
        stepIndex,
      });
      stepIndex++;
    } else if (step.type === "transit") {
      break;
    }
  }

  return walkingSteps;
}

function buildFirstStopGuideBlock(mappedSteps, summary) {
  const transitSteps = mappedSteps.filter((step) => step.type === "transit");

  if (transitSteps.length === 0) {
    return { available: false };
  }

  const firstTransit = transitSteps[0];
  const firstStopName = getShortStopName(firstTransit.from);
  const line = firstTransit.line || "ônibus";

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
    hasValidWalkingSteps: walkingSteps.length > 0,
  };
}

function buildAlerts(transfers) {
  const alerts = [
    "Chegue ao ponto alguns minutos antes do horário indicado.",
    "Confira o número e o sentido do ônibus antes de embarcar.",
    "Os horários podem variar conforme o trânsito e a operação do transporte.",
  ];

  if (transfers > 0) {
    alerts.push("Essa rota tem troca de ônibus. Preste atenção no ponto onde deve descer.");
  }

  return alerts;
}

module.exports = {
  humanizeWalkingInstruction,
  buildFriendlyMessage,
  buildVoiceBlock,
  buildScreenBlock,
  buildFirstStopGuideBlock,
  buildAlerts,
};
