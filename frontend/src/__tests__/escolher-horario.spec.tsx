import { fireEvent, render } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import ChooseTimeScreen from "../../app/escolher-horario";

const mockStartLoop = jest.fn().mockResolvedValue(undefined);
const mockStopAll = jest.fn().mockResolvedValue(undefined);

let mockParams: Record<string, string> = {};

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.FadeIn = {
    duration: () => ({}),
  };
  Reanimated.FadeInUp = {
    duration: () => ({}),
  };

  return Reanimated;
});

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => mockParams),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{name}</Text>;
  },
  MaterialCommunityIcons: ({ name }: { name: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{name}</Text>;
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("../components/BackButton", () => ({
  BackButton: () => {
    const { Text } = jest.requireActual("react-native");
    return <Text>Voltar</Text>;
  },
}));

jest.mock("../components/ListenOptionsButton", () => ({
  ListenOptionsButton: ({ label }: { label?: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{label || "Ouvir"}</Text>;
  },
}));

jest.mock("../components/PrimaryButton", () => ({
  PrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

jest.mock("../components/TextField", () => ({
  TextField: () => {
    const { Text } = jest.requireActual("react-native");
    return <Text>Campo de texto</Text>;
  },
}));

jest.mock("../hooks/useVoiceConversationLoop", () => ({
  useVoiceConversationLoop: () => ({
    startLoop: mockStartLoop,
    stopAll: mockStopAll,
  }),
}));

jest.mock("../services/vibration.service", () => ({
  vibrationService: {
    light: jest.fn(),
    selection: jest.fn(),
    error: jest.fn(),
  },
}));

function buildParams(overrides: Record<string, string> = {}) {
  return {
    latitude: "-19.747",
    longitude: "-47.939",
    destination: "Centro",
    destinationLat: "-19.748",
    destinationLng: "-47.932",
    selectedDestination: JSON.stringify({ name: "Centro" }),
    sessionId: "session-1",
    voiceMode: "true",
    ...overrides,
  };
}

describe("ChooseTimeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = buildParams();
    (useLocalSearchParams as jest.Mock).mockImplementation(() => mockParams);
  });

  it("não abre o microfone automaticamente quando voiceMode não está ativo", () => {
    mockParams = buildParams({ voiceMode: "false" });

    render(<ChooseTimeScreen />);

    expect(mockStartLoop).not.toHaveBeenCalled();
  });

  it("preserva origem, destino e voiceMode ao escolher agora por toque", () => {
    const screen = render(<ChooseTimeScreen />);

    fireEvent.press(screen.getByText("Agora"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/processando",
      params: expect.objectContaining({
        latitude: "-19.747",
        longitude: "-47.939",
        destination: "Centro",
        destinationLat: "-19.748",
        destinationLng: "-47.932",
        selectedDestination: JSON.stringify({ name: "Centro" }),
        sessionId: "session-1",
        voiceMode: "true",
        timeType: "DEPARTURE",
      }),
    });
  });
});
