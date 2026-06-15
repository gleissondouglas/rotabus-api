import { render } from "@testing-library/react-native";
import { VoiceVisualizer } from "../components/VoiceVisualizer";

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.useAnimatedStyle = (updater: () => object) => updater();
  Reanimated.withTiming = (value: number) => value;
  Reanimated.withRepeat = (value: number) => value;
  Reanimated.withSequence = (...values: number[]) => values[values.length - 1];
  Reanimated.withDelay = (_delay: number, value: number) => value;

  return Reanimated;
});

jest.mock("../theme/colors", () => ({
  useThemeColors: () => ({
    primary: "#2563EB",
  }),
}));

describe("VoiceVisualizer", () => {
  it("renderiza sem erros no estado idle", () => {
    const { toJSON } = render(<VoiceVisualizer state="idle" />);
    expect(toJSON()).toBeTruthy();
  });

  it("renderiza sem erros no estado speaking", () => {
    const { toJSON } = render(<VoiceVisualizer state="speaking" />);
    expect(toJSON()).toBeTruthy();
  });

  it("renderiza sem erros no estado listening", () => {
    const { toJSON } = render(<VoiceVisualizer state="listening" />);
    expect(toJSON()).toBeTruthy();
  });

  it("renderiza sem erros no estado processing", () => {
    const { toJSON } = render(<VoiceVisualizer state="processing" />);
    expect(toJSON()).toBeTruthy();
  });

  it("tem acessibilidade correta no estado listening", () => {
    const { getByLabelText } = render(<VoiceVisualizer state="listening" />);
    expect(getByLabelText("Ouvindo você")).toBeTruthy();
  });

  it("tem acessibilidade correta no estado speaking", () => {
    const { getByLabelText } = render(<VoiceVisualizer state="speaking" />);
    expect(getByLabelText("Assistente falando")).toBeTruthy();
  });

  it("tem acessibilidade correta no estado idle", () => {
    const { getByLabelText } = render(<VoiceVisualizer state="idle" />);
    expect(getByLabelText("Assistente em espera")).toBeTruthy();
  });

  it("tem acessibilidade correta no estado processing", () => {
    const { getByLabelText } = render(<VoiceVisualizer state="processing" />);
    expect(getByLabelText("Processando")).toBeTruthy();
  });
});
