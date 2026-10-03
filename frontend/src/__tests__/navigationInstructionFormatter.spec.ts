import { formatWalkingInstruction } from "../utils/navigationInstructionFormatter";

describe("navigationInstructionFormatter", () => {
  it("trata instrução vazia sem rua com fallback padrão", () => {
    const res = formatWalkingInstruction({ rawInstruction: "" });
    expect(res.displayTitle).toBe("Siga pelo caminho");
    expect(res.displaySubtitle).toBe("Até o próximo passo");
    expect(res.speechText).toBe("Siga pelo caminho indicado no mapa.");
  });

  it("retorna default com distância em metros quando instrução for vazia mas tiver distância", () => {
    const res = formatWalkingInstruction({ rawInstruction: "", distanceMeters: 150 });
    expect(res.displayTitle).toBe("Siga pelo caminho");
    expect(res.displaySubtitle).toBe("150 m");
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

  it("remove direções relativas e expande abreviações de vias (ex: R. para Rua)", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Siga na direção norte na R. ABC",
    });
    expect(res.displayTitle).toBe("Siga pela Rua ABC");
  });

  it("trata ruas sem o verbo siga, prefixando 'Siga pela'", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Rua das Flores",
    });
    expect(res.displayTitle).toBe("Siga pela Rua das Flores");
  });

  it("formata distância em quilômetros (1,5 km) e voz com quilômetros para manobras", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Vire à direita",
      distanceMeters: 1500,
    });
    expect(res.displaySubtitle).toBe("1,5 km");
    expect(res.speechText).toBe("Em 1,5 quilômetros, Vire à direita.");
  });

  it("gera texto de fala de 'Siga' colocando a distância percorrida no final", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Siga em frente",
      distanceMeters: 200,
    });
    expect(res.displaySubtitle).toBe("200 metros");
    expect(res.speechText).toBe("Siga em frente por 200 metros.");
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

  it("alerta sobre uso restrito quando indicado entre parênteses", () => {
    const res = formatWalkingInstruction({
      rawInstruction: "Siga em frente (Via de uso restrito)",
    });
    expect(res.warning).toBe("Verifique o acesso");
    expect(res.displayTitle).toBe("Siga em frente");
  });
});
