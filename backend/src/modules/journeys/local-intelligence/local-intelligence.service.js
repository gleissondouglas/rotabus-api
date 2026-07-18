const {
  LOCAL_ALIASES,
  GENERIC_PLACE_TYPES,
  TERMS_THAT_SHOULD_SHOW_OPTIONS,
  GENERIC_CITY_TERMS,
} = require("./local-intelligence.config");

/**
 * Remove acentos de uma string.
 */
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Limpa frases naturais para extrair apenas o destino.
 */
function cleanDestinationText(text) {
  if (!text) return "";

  let cleaned = text.toLowerCase().trim();

  // Remover prefixos comuns de fala
  const prefixes = [
    "me leva para o",
    "me leva para a",
    "me leva para",
    "me leve para o",
    "me leva para a",
    "me leva para",
    "me leve até o",
    "me leve até a",
    "me leve até",
    "quero ir para o",
    "quero ir para a",
    "quero ir para",
    "quero ir até o",
    "quero ir até a",
    "quero ir até",
    "preciso ir para o",
    "preciso ir para a",
    "preciso ir para",
    "ir para",
    "ir até",
    "levar para",
    "levar até",
    "vambora para",
    "bora para",
    "me leva pro",
    "me leva pra",
    "me leve pro",
    "me leve pra",
  ];

  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.replace(prefix, "").trim();
      break;
    }
  }

  // Remover pontuação final
  cleaned = cleaned.replace(/[.!?]$/, "").trim();

  return cleaned;
}

/**
 * Aplica aliases locais para termos comuns em Uberaba.
 */
function applyLocalAliases(text) {
  return LOCAL_ALIASES[text.toLowerCase()] || text;
}

/**
 * Avalia se o texto possui heurísticas de endereço físico ou locais genéricos/específicos.
 */
function guessQueryType(text) {
  const lower = text.toLowerCase().trim();
  const lowerNoAccents = removeAccents(lower);

  if (GENERIC_PLACE_TYPES[lower] || GENERIC_PLACE_TYPES[lowerNoAccents]) {
    return "generic_category";
  }

  const addressKeywords = [
    "rua",
    "avenida",
    "av",
    "av.",
    "travessa",
    "número",
    "nº",
    "n ",
    "numero",
    "bairro",
    "parque dos",
    "vila",
    "alameda",
    "estrada",
    "rodovia",
  ];
  const placeKeywords = [
    "hospital",
    "upa",
    "supermercado",
    "shopping",
    "terminal",
    "escola",
    "faculdade",
    "igreja",
    "uniube",
    "uftm",
    "prefeitura",
    "forum",
    "fórum",
    "estádio",
    "estadio",
    "praça",
    "parque",
    "universidade",
    "museu",
    "teatro",
    "rodoviária",
    "aeroporto",
  ];

  const hasAddress = addressKeywords.some((kw) => lower.includes(kw));
  const hasPlace = placeKeywords.some((kw) => lower.includes(kw));

  if (hasAddress && !hasPlace) return "address";
  if (hasPlace) return "specific_place";

  if (/\d+/.test(lower)) return "address";

  return "unknown";
}

/**
 * Verifica se um resultado é apenas a cidade de forma genérica.
 */
function checkIfGenericCity(name, address) {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  return GENERIC_CITY_TERMS.some((term) => lowerName === term);
}

/**
 * Decidir se deve sugerir opções com base no termo buscado e candidatos.
 */
function shouldShowOptionsForKnownTerm(text, candidates) {
  const normalizedText = removeAccents(String(text || "").toLowerCase());

  const hasKnownTerm = TERMS_THAT_SHOULD_SHOW_OPTIONS.some((term) =>
    normalizedText.includes(removeAccents(term.toLowerCase())),
  );

  return hasKnownTerm && candidates.length > 1;
}

/**
 * Avalia a confiança do resultado baseado na query original e no tipo da query.
 */
function evaluateConfidence(query, result, queryType) {
  if (queryType === "generic_category") {
    return "low"; // Categorias genéricas SEMPRE exigem sugestões.
  }

  const lowerQuery = query.toLowerCase();
  const lowerResultName = result.name.toLowerCase();

  const isGeneric = checkIfGenericCity(result.name, result.address);

  // Se o usuário buscou um POI específico mas o resultado é a cidade
  if (queryType === "specific_place" && isGeneric) {
    return "low";
  }

  // Se o nome do resultado contém palavras-chave da busca, confiança alta
  const queryWords = lowerQuery.split(" ").filter((w) => w.length > 3);
  const matchesAnyWord = queryWords.some((word) => lowerResultName.includes(word));

  if (matchesAnyWord && !isGeneric) return "high";

  return result.confidence || "medium";
}

module.exports = {
  cleanDestinationText,
  applyLocalAliases,
  guessQueryType,
  checkIfGenericCity,
  shouldShowOptionsForKnownTerm,
  evaluateConfidence,
  removeAccents,
};
