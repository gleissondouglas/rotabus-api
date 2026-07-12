import type { DestinationOption } from "../types/journey.types";

export type DestinationCategory =
  | "health"
  | "pharmacy"
  | "market"
  | "bakery"
  | "food"
  | "education"
  | "bus_terminal"
  | "bus_stop"
  | "address"
  | "residence"
  | "residential_building"
  | "lodging"
  | "commerce"
  | "fuel"
  | "bank"
  | "religious"
  | "park"
  | "gym"
  | "police"
  | "government"
  | "station"
  | "airport"
  | "unknown";

type DestinationCategoryInput = Pick<
  DestinationOption,
  "name" | "address" | "type" | "primaryType" | "category"
>;

const categoryMatchers: [DestinationCategory, RegExp][] = [
  ["health", /hospital|pronto socorro|upa|clinica|medical|health/],
  ["pharmacy", /farmacia|pharmacy|drugstore/],
  ["market", /supermercado|mercado|mercearia|grocery|supermarket/],
  ["bakery", /padaria|bakery/],
  ["food", /restaurante|lanchonete|cafeteria|cafe|restaurant|food/],
  ["education", /escola|universidade|faculdade|colegio|school|university/],
  ["bus_terminal", /rodoviaria|terminal.*onibus|bus_station/],
  ["bus_stop", /ponto.*onibus|bus_stop/],
  ["lodging", /hotel|pousada|hostel|lodging/],
  ["fuel", /posto.*combustivel|gasolina|gas_station/],
  ["bank", /banco|caixa eletronico|atm|bank/],
  ["residential_building", /condominio|apartamento|edificio|predio residencial/],
  ["residence", /casa|residencia|residential_home/],
  ["religious", /igreja|templo|paroquia|church|mosque/],
  ["park", /parque|praca|jardim|park/],
  ["gym", /academia|gym|fitness/],
  ["police", /delegacia|policia|police/],
  ["government", /prefeitura|orgao publico|secretaria|city_hall|government/],
  ["station", /estacao|metro|trem|train_station/],
  ["airport", /aeroporto|airport/],
  ["commerce", /shopping|loja|comercio|store|mall/],
];

export function normalizePlaceCategory(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, " ");
}

function findCategory(value?: string | null) {
  const normalized = normalizePlaceCategory(value);
  if (!normalized) return null;
  return categoryMatchers.find(([, matcher]) => matcher.test(normalized))?.[0] || null;
}

function isGenericAddress(destination: DestinationCategoryInput) {
  const type = normalizePlaceCategory(destination.type);
  if (type === "street address" || type === "street" || type === "route") return true;

  const text = normalizePlaceCategory(`${destination.name || ""} ${destination.address || ""}`);
  return /\b(rua|avenida|av|travessa|estrada|rodovia)\b/.test(text);
}

/** Resolves display category without claiming a residence from an unclassified address. */
export function resolveDestinationCategory(destination: DestinationCategoryInput): DestinationCategory {
  const fromType = findCategory(destination.primaryType) || findCategory(destination.type);
  if (fromType) return fromType;

  const fromCategory = findCategory(destination.category);
  if (fromCategory) return fromCategory;

  const fromName = findCategory(destination.name);
  if (fromName) return fromName;

  if (isGenericAddress(destination)) return "address";

  return "unknown";
}

export function getDestinationCategoryLabel(category: DestinationCategory) {
  const labels: Record<DestinationCategory, string> = {
    health: "Saúde", pharmacy: "Farmácia", market: "Mercado", bakery: "Padaria",
    food: "Alimentação", education: "Educação", bus_terminal: "Terminal", bus_stop: "Ponto de ônibus",
    address: "Endereço", residence: "Residência", residential_building: "Residencial", lodging: "Hospedagem",
    commerce: "Comércio", fuel: "Combustível", bank: "Banco", religious: "Local religioso",
    park: "Parque", gym: "Academia", police: "Polícia", government: "Órgão público",
    station: "Estação", airport: "Aeroporto", unknown: "Local",
  };
  return labels[category];
}
