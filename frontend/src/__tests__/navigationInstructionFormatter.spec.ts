import { formatWalkingInstruction } from "../utils/navigationInstructionFormatter";

describe("navigationInstructionFormatter", () => {
  it("trata instrução vazia sem rua com fallback padrão", () => {
    const res = formatWalkingInstruction({ rawInstruction: "" });
    expect(res.displayTitle).toBe("Siga pelo caminho");
    expect(res.speechText).toBe("Siga pelo caminho indicado no mapa.");
  });

  it("trata instrução vazia com rua de destino preenchida", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "",
      destinationStreet: "Rua Francisco Pucci",
    });
    expect(res.displayTitle).toBe("Siga pela Rua Francisco Pucci");
    expect(res.speechText).toBe("Siga pela Rua Francisco Pucci indicado no mapa.");
  });

  it("converte 'Siga na direção nordeste em direção a Rua Francisco Pucci' para 'Siga pela Rua Francisco Pucci'", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Siga na direção nordeste em direção a Rua Francisco Pucci",
      distanceMeters: 228,
    });
    expect(res.displayTitle).toBe("Siga pela Rua Francisco Pucci");
    expect(res.displaySubtitle).toBe("228 metros");
    expect(res.speechText).toBe("Siga pela Rua Francisco Pucci por 228 metros.");
  });

  it("converte 'Siga na direção nordeste' sem rua para 'Siga pela [rua]' quando destinationStreet for fornecido", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Siga na direção nordeste",
      distanceMeters: 228,
      destinationStreet: "Rua Francisco Pucci",
    });
    expect(res.displayTitle).toBe("Siga pela Rua Francisco Pucci");
    expect(res.displaySubtitle).toBe("228 metros");
    expect(res.speechText).toBe("Siga pela Rua Francisco Pucci por 228 metros.");
  });

  it("usa 'Siga até [destino]' quando não for uma rua", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Siga",
      distanceMeters: 150,
      destinationStreet: "Terminal Oeste",
    });
    expect(res.displayTitle).toBe("Siga até Terminal Oeste");
    expect(res.speechText).toBe("Siga até Terminal Oeste por 150 metros.");
  });

  it("preserva manobras de conversão (vire à direita / esquerda)", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Vire à direita na R. Artur Machado",
      distanceMeters: 45,
      maneuver: "TURN_RIGHT",
    });
    expect(res.displayTitle).toBe("Vire à direita na Rua Artur Machado");
    expect(res.displaySubtitle).toBe("45 metros");
    expect(res.speechText).toBe("Em 45 metros, Vire à direita na Rua Artur Machado.");
    expect(res.maneuver).toBe("TURN_RIGHT");
  });

  it("detecta estradas de uso restrito e gera warning", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Siga estrada de uso restrito",
      distanceMeters: 100,
    });
    expect(res.warning).toBe("Verifique o acesso");
    expect(res.displayTitle).toBe("Siga em frente");
  });
});
