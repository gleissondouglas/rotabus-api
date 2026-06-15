import { render } from "@testing-library/react-native";
import { LiveTranscript } from "../components/LiveTranscript";

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView, Text: MockText } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.default.Text = MockText;
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.useAnimatedStyle = (updater: () => object) => updater();
  Reanimated.FadeInDown = {
    duration: () => ({}),
  };
  Reanimated.FadeOutUp = {
    duration: () => ({}),
  };

  return Reanimated;
});

jest.mock("../theme/colors", () => ({
  useThemeColors: () => ({
    primary: "#2563EB",
  }),
}));

describe("LiveTranscript", () => {
  it("não renderiza nada quando transcript está vazio", () => {
    const { toJSON } = render(<LiveTranscript transcript="" isFinal={false} />);
    expect(toJSON()).toBeNull();
  });

  it("exibe o texto de transcrição parcial", () => {
    const { getByText } = render(
      <LiveTranscript transcript="Terminal central" isFinal={false} />,
    );
    expect(getByText("Terminal central")).toBeTruthy();
    expect(getByText("Ouvindo...")).toBeTruthy();
  });

  it("exibe o texto de transcrição final com badge 'Entendi'", () => {
    const { getByText } = render(
      <LiveTranscript transcript="Terminal central" isFinal />,
    );
    expect(getByText("Você disse: Terminal central")).toBeTruthy();
    expect(getByText("Entendi")).toBeTruthy();
  });

  it("tem accessibilityLabel correto para transcrição parcial", () => {
    const { getByLabelText } = render(
      <LiveTranscript transcript="Terminal central" isFinal={false} />,
    );
    expect(getByLabelText("Ouvindo: Terminal central")).toBeTruthy();
  });

  it("tem accessibilityLabel correto para transcrição final", () => {
    const { getByLabelText } = render(
      <LiveTranscript transcript="Terminal central" isFinal />,
    );
    expect(getByLabelText("Você disse: Terminal central")).toBeTruthy();
  });
});
