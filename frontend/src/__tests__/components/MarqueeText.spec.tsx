import React from "react";
import { render, screen, act } from "@testing-library/react-native";
import { MarqueeText } from "../../../src/components/MarqueeText";
import { Animated } from "react-native";

describe("MarqueeText", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renderiza o texto estático normalmente quando montado", () => {
    render(<MarqueeText testID="marquee-text">Av. Leopoldino de Oliveira</MarqueeText>);

    expect(screen.getAllByText("Av. Leopoldino de Oliveira").length).toBeGreaterThan(0);
  });

  it("não inicia animação quando o texto cabe no contêiner", () => {
    const loopSpy = jest.spyOn(Animated, "loop");

    const { getByTestId, UNSAFE_getAllByType } = render(
      <MarqueeText testID="marquee-text">Texto Curto</MarqueeText>
    );

    // Simula layout do contêiner com 300px
    act(() => {
      const container = getByTestId("marquee-text");
      container.props.onLayout({
        nativeEvent: { layout: { width: 300 } },
      });
    });

    // Simula layout do texto com 100px (menor que o container)
    const { Text } = require("react-native");
    const textComponents = UNSAFE_getAllByType(Text);
    const measureText = textComponents.find(
      (comp: any) => comp.props.children === "Texto Curto"
    );

    if (measureText) {
      act(() => {
        measureText.props.onLayout({
          nativeEvent: { layout: { width: 100 } },
        });
      });
    }

    expect(loopSpy).not.toHaveBeenCalled();
    loopSpy.mockRestore();
  });

  it("inicia animação em modo restart (padrão) quando o texto excede o contêiner", () => {
    const loopSpy = jest.spyOn(Animated, "loop");

    const { getByTestId, UNSAFE_getAllByType } = render(
      <MarqueeText testID="marquee-text" speed={40}>
        Hospital São Marcos - Unidade Central de Uberaba
      </MarqueeText>
    );

    act(() => {
      const container = getByTestId("marquee-text");
      container.props.onLayout({
        nativeEvent: { layout: { width: 200 } },
      });
    });

    const { Text } = require("react-native");
    const textComponents = UNSAFE_getAllByType(Text);
    const measureText = textComponents.find(
      (comp: any) =>
        comp.props.children === "Hospital São Marcos - Unidade Central de Uberaba"
    );

    if (measureText) {
      act(() => {
        measureText.props.onLayout({
          nativeEvent: { layout: { width: 450 } },
        });
      });
    }

    expect(loopSpy).toHaveBeenCalled();
    loopSpy.mockRestore();
  });

  it("inicia animação em modo ping-pong quando o texto excede o contêiner", () => {
    const loopSpy = jest.spyOn(Animated, "loop");

    const { getByTestId, UNSAFE_getAllByType } = render(
      <MarqueeText testID="marquee-text" mode="ping-pong" speed={40}>
        Avenida Leopoldino de Oliveira, Centro, Uberaba - MG
      </MarqueeText>
    );

    act(() => {
      const container = getByTestId("marquee-text");
      container.props.onLayout({
        nativeEvent: { layout: { width: 200 } },
      });
    });

    const { Text } = require("react-native");
    const textComponents = UNSAFE_getAllByType(Text);
    const measureText = textComponents.find(
      (comp: any) =>
        comp.props.children === "Avenida Leopoldino de Oliveira, Centro, Uberaba - MG"
    );

    if (measureText) {
      act(() => {
        measureText.props.onLayout({
          nativeEvent: { layout: { width: 400 } },
        });
      });
    }

    expect(loopSpy).toHaveBeenCalled();
    loopSpy.mockRestore();
  });

  it("inicia animação em modo continuous e duplica o texto para loop infinito", () => {
    const loopSpy = jest.spyOn(Animated, "loop");

    const { getByTestId, UNSAFE_getAllByType } = render(
      <MarqueeText testID="marquee-text" mode="continuous" speed={35} spacing={30}>
        Texto Muito Longo de Letreiro
      </MarqueeText>
    );

    act(() => {
      const container = getByTestId("marquee-text");
      container.props.onLayout({
        nativeEvent: { layout: { width: 150 } },
      });
    });

    const { Text } = require("react-native");
    const textComponents = UNSAFE_getAllByType(Text);
    const measureText = textComponents.find(
      (comp: any) => comp.props.children === "Texto Muito Longo de Letreiro"
    );

    if (measureText) {
      act(() => {
        measureText.props.onLayout({
          nativeEvent: { layout: { width: 350 } },
        });
      });
    }

    expect(loopSpy).toHaveBeenCalled();
    expect(
      screen.getAllByText("Texto Muito Longo de Letreiro", { includeHiddenElements: true }).length
    ).toBeGreaterThanOrEqual(2);
    loopSpy.mockRestore();
  });

  it("não anima quando active={false} mesmo se o texto for longo", () => {
    const loopSpy = jest.spyOn(Animated, "loop");

    const { getByTestId, UNSAFE_getAllByType } = render(
      <MarqueeText testID="marquee-text" active={false}>
        Texto Que Deveria Rolar Mas Está Inativo
      </MarqueeText>
    );

    act(() => {
      const container = getByTestId("marquee-text");
      container.props.onLayout({
        nativeEvent: { layout: { width: 100 } },
      });
    });

    const { Text } = require("react-native");
    const textComponents = UNSAFE_getAllByType(Text);
    const measureText = textComponents.find(
      (comp: any) => comp.props.children === "Texto Que Deveria Rolar Mas Está Inativo"
    );

    if (measureText) {
      act(() => {
        measureText.props.onLayout({
          nativeEvent: { layout: { width: 300 } },
        });
      });
    }

    expect(loopSpy).not.toHaveBeenCalled();
    loopSpy.mockRestore();
  });

  it("para a animação ao desmontar o componente sem vazar timers", () => {
    const { getByTestId, UNSAFE_getAllByType, unmount } = render(
      <MarqueeText testID="marquee-text">Texto para desmontagem</MarqueeText>
    );

    act(() => {
      const container = getByTestId("marquee-text");
      container.props.onLayout({
        nativeEvent: { layout: { width: 100 } },
      });
    });

    const { Text } = require("react-native");
    const textComponents = UNSAFE_getAllByType(Text);
    const measureText = textComponents.find(
      (comp: any) => comp.props.children === "Texto para desmontagem"
    );

    if (measureText) {
      act(() => {
        measureText.props.onLayout({
          nativeEvent: { layout: { width: 300 } },
        });
      });
    }

    expect(() => unmount()).not.toThrow();
  });
});
