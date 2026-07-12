import {
  resolveDestinationCategory,
  normalizePlaceCategory,
} from "./destinationCategory.mapper";

describe("destinationCategory.mapper", () => {
  it.each([
    [{ name: "Hospital Mário Palmério", address: "Uberaba" }, "health"],
    [{ name: "Supermercado BH", address: "Uberaba" }, "market"],
    [{ name: "Escola Estadual Brasil", address: "Uberaba" }, "education"],
    [{ name: "Rodoviária de Uberaba", address: "Uberaba" }, "bus_terminal"],
    [{ name: "Padaria Tradição", address: "Uberaba" }, "bakery"],
    [{ name: "Casa", address: "Uberaba" }, "residence"],
    [{ name: "Condomínio Jardim Azul", address: "Uberaba" }, "residential_building"],
    [{ name: "Rua José de Andrade, 45", address: "Uberaba" }, "address"],
    [{ name: "Av. Nenê Sabino, 1801", address: "Uberaba" }, "address"],
    [{ name: "", address: "" }, "unknown"],
  ])("classifica %o como %s", (destination, expected) => {
    expect(resolveDestinationCategory(destination)).toBe(expected);
  });

  it("prioriza o tipo retornado pela API sobre o nome", () => {
    expect(resolveDestinationCategory({
      name: "Padaria Central",
      address: "Uberaba",
      primaryType: "hospital",
    })).toBe("health");
  });

  it("normaliza acentos e espaços", () => {
    expect(normalizePlaceCategory("  Clínica São José ")).toBe("clinica sao jose");
  });
});
