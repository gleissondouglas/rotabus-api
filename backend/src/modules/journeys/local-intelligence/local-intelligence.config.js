/**
 * Configurações e dicionários geográficos locais (Uberaba - MG).
 */

const LOCAL_ALIASES = {
  centro: "Praça Rui Barbosa, Uberaba - MG",
  "centro da cidade": "Praça Rui Barbosa, Uberaba - MG",
  uniube: "UNIUBE - Universidade de Uberaba, Uberaba - MG",
  "mario palmerio": "Hospital Mário Palmério Universitário, Uberaba - MG",
  "hospital mario palmerio": "Hospital Mário Palmério Universitário, Uberaba - MG",
  "praça shopping": "Praça Shopping Uberaba, Uberaba - MG",
  "shopping uberaba": "Shopping Uberaba, Uberaba - MG",
  "terminal oeste": "Terminal Oeste - BRT Vetor, Uberaba - MG",
  "terminal leste": "Terminal Leste - BRT Vetor, Uberaba - MG",
  "terminal sudeste": "Terminal Sudeste - BRT Vetor, Uberaba - MG",
  "terminal sudoeste": "Terminal Sudoeste - BRT Vetor, Uberaba - MG",
  "terminal central": "Terminal Central - BRT Vetor, Uberaba - MG",
  "upa são benedito": "UPA São Benedito, Uberaba - MG",
  "upa sao benedito": "UPA São Benedito, Uberaba - MG",
  "upa do mirante": "UPA Dr. José Marcus Cherém (UPA Mirante), Uberaba - MG",
  "upa mirante": "UPA Dr. José Marcus Cherém (UPA Mirante), Uberaba - MG",
  "postinho do beija-flor 3": "Unidade de Saúde Beija Flor III, Uberaba - MG",
  "postinho do beija flor 3": "Unidade de Saúde Beija Flor III, Uberaba - MG",
  "postinho do beija flor": "Unidade de Saúde Beija Flor III, Uberaba - MG",
};

const GENERIC_PLACE_TYPES = {
  hospital: ["hospital"],
  hospitais: ["hospital"],
  supermercado: ["supermarket"],
  supermercados: ["supermarket"],
  mercado: ["supermarket"],
  mercados: ["supermarket"],
  farmacia: ["pharmacy"],
  farmácia: ["pharmacy"],
  farmacias: ["pharmacy"],
  farmácias: ["pharmacy"],
  padaria: ["bakery"],
  padarias: ["bakery"],
  posto: ["gas_station"],
  "posto de gasolina": ["gas_station"],
  shopping: ["shopping_mall"],
  shoppings: ["shopping_mall"],
  forum: ["courthouse"],
  fórum: ["courthouse"],
  escola: ["school"],
  escolas: ["school"],
  faculdade: ["university"],
  faculdades: ["university"],
  universidade: ["university"],
  universidades: ["university"],
  terminal: ["bus_station", "transit_station"],
  praça: ["park", "tourist_attraction"],
  praca: ["park", "tourist_attraction"],
};

const TERMS_THAT_SHOULD_SHOW_OPTIONS = [
  "uniube",
  "universidade",
  "faculdade",
  "hospital",
  "supermercado",
  "mercado",
  "farmacia",
  "farmácia",
  "restaurante",
  "terminal",
  "forum",
  "fórum",
  "clinica",
  "clínica",
  "posto de saúde",
];

const GENERIC_CITY_TERMS = ["uberaba", "uberaba, mg", "uberaba - mg", "uberaba, minas gerais"];

module.exports = {
  LOCAL_ALIASES,
  GENERIC_PLACE_TYPES,
  TERMS_THAT_SHOULD_SHOW_OPTIONS,
  GENERIC_CITY_TERMS,
};
