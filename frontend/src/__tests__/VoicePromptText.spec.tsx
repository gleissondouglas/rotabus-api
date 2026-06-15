import { render } from "@testing-library/react-native";
import { VoicePromptText } from "../components/VoicePromptText";

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView, Text: MockText } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.default.Text = MockText;
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.useAnimatedStyle = (updater: () => object) => updater();
  Reanimated.withTiming = (value: number) => value;
  Reanimated.FadeInDown = {
    duration: () => ({}),
    delay: () => ({ duration: () => ({}) }),
  };

  return Reanimated;
});

describe("VoicePromptText", () => {
  it("não renderiza nada quando text está vazio", () => {
    const { toJSON } = render(<VoicePromptText text="" animated={false} />);
    expect(toJSON()).toBeNull();
  });

  it("renderiza o texto completo quando animated=false", () => {
    const { getByText } = render(
      <VoicePromptText text="Para onde você quer ir hoje?" animated={false} />,
    );
    expect(getByText("Para onde você quer ir hoje?")).toBeTruthy();
  });

  it("renderiza as palavras separadas quando animated=true", () => {
    const text = "Olá, Douglas. Para onde você quer ir hoje?";
    const { getByText } = render(
      <VoicePromptText text={text} animated />,
    );
    // No modo animado, as palavras são divididas; verificamos que pelo menos
    // a primeira palavra está presente
    expect(getByText(/Olá,/)).toBeTruthy();
  });

  it("atualiza corretamente quando o texto muda", () => {
    const { rerender, queryByText, getByText } = render(
      <VoicePromptText text="Texto inicial" animated={false} />,
    );
    expect(getByText("Texto inicial")).toBeTruthy();

    rerender(<VoicePromptText text="Novo texto" animated={false} />);
    expect(queryByText("Texto inicial")).toBeNull();
    expect(getByText("Novo texto")).toBeTruthy();
  });
});
