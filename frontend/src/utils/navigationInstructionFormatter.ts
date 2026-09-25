/**
 * Utilitário para transformar instruções técnicas do Google Maps em linguagem humana,
 * simples e clara, adequada para o público do RotaBus.
 * 
 * Prioriza a humanização vinda do backend, mas aplica limpezas adicionais.
 */

export interface FormattedInstruction {
  displayTitle: string;
  displaySubtitle: string;
  speechText: string;
  warning?: string;
  maneuver?: string | null;
}

export interface FormatInput {
  rawInstruction: string;
  distanceMeters?: number;
  maneuver?: string | null;
  destinationStreet?: string;
}

export function formatWalkingInstruction(input: FormatInput): FormattedInstruction {
  const { rawInstruction, distanceMeters, maneuver, destinationStreet } = input;

  const cleanDestStreet = destinationStreet && destinationStreet !== "ponto indicado" && destinationStreet !== "Destino Final"
    ? destinationStreet.trim()
    : "";

  if (!rawInstruction) {
    let title = "Siga pelo caminho";
    if (cleanDestStreet) {
      title = /^(rua|av|avenida|praça|alameda|rodovia|travessa|beco|estrada)/i.test(cleanDestStreet)
        ? `Siga pela ${cleanDestStreet}`
        : `Siga até ${cleanDestStreet}`;
    }
    return {
      displayTitle: title,
      displaySubtitle: distanceMeters ? `${Math.round(distanceMeters)} m` : "Até o próximo passo",
      speechText: `${title} indicado no mapa.`,
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
  }

  // 2. Limpeza Final de Termos Técnicos e Direções Cardeais
  text = text.replace(
    /Siga na direção (norte|sul|leste|oeste|nordeste|sudeste|noroeste|sudoeste)\s*/gi,
    "Siga "
  );
  text = text.replace(
    /na direção (norte|sul|leste|oeste|nordeste|sudeste|noroeste|sudoeste)\s*/gi,
    ""
  );

  // Preserva o nome da via se houver 'em direção a Rua/Av...'
  text = text.replace(/ em direção [aà]\s+(R\.|Rua|Av\.|Avenida|Praça|Alameda|Travessa|Rodovia|Beco|Estrada)/gi, " pela $1");
  text = text.replace(/ em direção [aà]\s+/gi, " até ");
  
  // Padronização e Abreviações
  text = text.replace(/Siga na R\. /gi, "Siga pela Rua ");
  text = text.replace(/Siga na /gi, "Siga pela ");
  text = text.replace(/Siga para /gi, "Siga pela ");
  text = text.replace(/ na R\. /gi, " na Rua ");
  text = text.replace(/ à R\. /gi, " à Rua ");

  // Se o texto for apenas uma rua (sem verbo), adiciona "Siga pela"
  if (!text.toLowerCase().includes("siga") && !text.toLowerCase().includes("vire") && !text.toLowerCase().includes("entre") && !text.toLowerCase().includes("caminhe")) {
    text = `Siga pela ${text}`;
  }

  // Se o texto ficou genérico (apenas "Siga" ou "Siga em frente" ou "Siga pelo caminho")
  const isGenericSiga = /^(siga|siga em frente|siga pelo caminho)$/i.test(text.trim());
  if (isGenericSiga && cleanDestStreet) {
    text = /^(rua|av|avenida|praça|alameda|rodovia|travessa|beco|estrada)/i.test(cleanDestStreet)
      ? `Siga pela ${cleanDestStreet}`
      : `Siga até ${cleanDestStreet}`;
  } else if (text.trim().toLowerCase() === "siga") {
    text = "Siga em frente";
  }

  // 3. Formatação de Título e Subtítulo
  const displayTitle = text.trim().charAt(0).toUpperCase() + text.trim().slice(1);
  let displaySubtitle = "";

  if (distanceMeters && distanceMeters > 0) {
    displaySubtitle = distanceMeters < 1000 
      ? `${Math.round(distanceMeters)} metros` 
      : `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} km`;
  }

  // 4. Preparação da Fala (Voz)
  let speechText = text.trim();
  if (distanceMeters && distanceMeters > 15) {
    const distStr = distanceMeters < 1000 
      ? `${Math.round(distanceMeters)} metros` 
      : `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} quilômetros`;
    
    // Se for uma instrução de "Siga", adicionamos a distância no final
    if (speechText.toLowerCase().startsWith("siga") || speechText.toLowerCase().startsWith("continue") || speechText.toLowerCase().startsWith("caminhe")) {
      speechText = `${speechText} por ${distStr}.`;
    } else {
      // Se for uma manobra (vire), a distância é o que falta até ela
      speechText = `Em ${distStr}, ${speechText}.`;
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
