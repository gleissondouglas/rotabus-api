/**
 * Utilitário para transformar instruções técnicas do Google Maps em linguagem humana,
 * simples e clara, adequada para o público do RotaBus.
 * 
 * Prioriza a humanização vinda do backend, mas aplica limpezas adicionais.
 */

interface FormattedInstruction {
  displayTitle: string;
  displaySubtitle: string;
  speechText: string;
  warning?: string;
  maneuver?: string | null;
}

interface FormatInput {
  rawInstruction: string;
  distanceMeters?: number;
  maneuver?: string | null;
}

export function formatWalkingInstruction(input: FormatInput): FormattedInstruction {
  const { rawInstruction, distanceMeters, maneuver } = input;

  if (!rawInstruction) {
    return {
      displayTitle: "Siga pelo caminho",
      displaySubtitle: distanceMeters ? `${Math.round(distanceMeters)} m` : "Até o próximo passo",
      speechText: "Siga pelo caminho indicado no mapa.",
      maneuver
    };
  }

  let text = rawInstruction.trim();

  // 1. Detectar caminho restrito (mostrar como warning, não título principal)
  const isRestricted = /uso restrito|restricted road|private road|via restrita/i.test(text);
  let warning = undefined;
  
  if (isRestricted) {
    warning = "Verifique o acesso";
    // Remove o aviso do texto principal para não poluir o título
    text = text.replace(/ \(?Estrada de uso restrito\)?/gi, "");
    text = text.replace(/ \(?Via de uso restrito\)?/gi, "");
    text = text.replace(/ \(?Restricted usage road\)?/gi, "");
    text = text.replace(/Siga estrada de uso restrito/gi, "Siga em frente");
    text = text.replace(/Siga via de uso restrito/gi, "Siga em frente");
    
    // Se o texto ficou vazio ou apenas com "Siga", padroniza
    if (text.toLowerCase() === "siga" || text.trim() === "") {
      text = "Siga em frente";
    }
  }

  // 2. Limpeza Final de Termos Técnicos (Backup do Backend)
  text = text.replace(/ na direção (norte|sul|leste|oeste|nordeste|sudeste|noroeste|sudoeste)/gi, "");
  text = text.replace(/Siga na direção (norte|sul|leste|oeste|nordeste|sudeste|noroeste|sudoeste)/gi, "Siga em frente");
  
  // Padronização e Abreviações
  text = text.replace(/Siga na R\. /gi, "Siga pela Rua ");
  text = text.replace(/Siga na /gi, "Siga pela ");
  text = text.replace(/Siga para /gi, "Siga pela ");
  text = text.replace(/ na R\. /gi, " na Rua ");
  text = text.replace(/ à R\. /gi, " à Rua ");

  // Se o texto for apenas uma rua, adiciona "Siga pela"
  if (!text.toLowerCase().includes("siga") && !text.toLowerCase().includes("vire") && !text.toLowerCase().includes("entre")) {
    text = `Siga pela ${text}`;
  }

  // 3. Formatação de Título e Subtítulo
  const displayTitle = text.charAt(0).toUpperCase() + text.slice(1);
  let displaySubtitle = "";

  if (distanceMeters && distanceMeters > 0) {
    displaySubtitle = distanceMeters < 1000 
      ? `${Math.round(distanceMeters)} metros` 
      : `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} km`;
  }

  // 4. Preparação da Fala (Voz)
  let speechText = text;
  if (distanceMeters && distanceMeters > 15) {
    const distStr = distanceMeters < 1000 
      ? `${Math.round(distanceMeters)} metros` 
      : `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} quilômetros`;
    
    // Se for uma instrução de "Siga", adicionamos a distância no final
    if (text.toLowerCase().startsWith("siga") || text.toLowerCase().startsWith("continue")) {
      speechText = `${text} por ${distStr}.`;
    } else {
      // Se for uma manobra (vire), a distância é o que falta até ela
      speechText = `Em ${distStr}, ${text}.`;
    }
  }

  return {
    displayTitle,
    displaySubtitle,
    speechText: speechText.endsWith(".") ? speechText : speechText + ".",
    warning,
    maneuver
  };
}
