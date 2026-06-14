import { act, render } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";

import BestRouteScreen from "../../app/melhor-rota";
import type { VoiceLoopStatus } from "../hooks/useVoiceConversationLoop";

const mockStartLoop = jest.fn().mockResolvedValue(undefined);
const mockStopAll = jest.fn().mockResolvedValue(undefined);

let mockParams: Record<string, string> = {};
let mockVoiceLoopCallbacks: {
  onStatusChange?: (status: VoiceLoopStatus) => void;
} = {};

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.FadeInUp = {
    duration: () => ({}),
  };
  Reanimated.FadeOutUp = {};

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
  FontAwesome6: ({ name }: { name: string }) => {
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
    return <Text>Início</Text>;
  },
}));

jest.mock("../components/ListenOptionsButton", () => ({
  ListenOptionsButton: ({ label }: { label?: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{label || "Ouvir"}</Text>;
  },
}));

jest.mock("../components/PrimaryButton", () => ({
  PrimaryButton: ({ title }: { title: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{title}</Text>;
  },
}));

jest.mock("../components/RouteStep", () => ({
  RouteStep: () => {
    const { Text } = jest.requireActual("react-native");
    return <Text>Passo da rota</Text>;
  },
}));

jest.mock("../hooks/useVoiceConversationLoop", () => ({
  useVoiceConversationLoop: (options: typeof mockVoiceLoopCallbacks) => {
    mockVoiceLoopCallbacks = options;

    return {
      startLoop: mockStartLoop,
      stopAll: mockStopAll,
    };
  },
}));

jest.mock("../services/speech.service", () => ({
  speak: jest.fn(),
}));

jest.mock("../services/journey.service", () => ({
  journeyService: {
    executeCommand: jest.fn(),
  },
}));

jest.mock("../services/session.service", () => ({
  sessionService: {
    getSessionId: jest.fn(() => "session-1"),
    clearSessionId: jest.fn(),
  },
}));

jest.mock("../services/vibration.service", () => ({
  vibrationService: {
    light: jest.fn(),
    selection: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("../utils/network", () => ({
  isConnected: jest.fn().mockResolvedValue(true),
}));

function buildParams(overrides: Record<string, string> = {}) {
  return {
    latitude: "-19.747",
    longitude: "-47.939",
    destination: "Centro",
    summary: JSON.stringify({
      timeType: "DEPARTURE",
      requestedTime: "2026-06-14T10:00:00-03:00",
      leaveHomeAt: "10:00",
      beAtStopAt: "10:10",
      arrivalAtDestination: "10:30",
      totalDurationMin: 30,
      busLines: ["101"],
      transfers: 0,
      initialWalkTimeMin: 5,
      finalWalkTimeMin: 3,
      totalWalkTimeMin: 8,
      busTimeMin: 20,
    }),
    alerts: JSON.stringify([]),
    steps: JSON.stringify([]),
    voiceMode: "false",
    ...overrides,
  };
}

describe("BestRouteScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVoiceLoopCallbacks = {};
    mockParams = buildParams();
    (useLocalSearchParams as jest.Mock).mockImplementation(() => mockParams);
  });

  it("não abre o microfone automaticamente no fluxo manual", () => {
    render(<BestRouteScreen />);

    expect(mockStartLoop).not.toHaveBeenCalled();
  });

  it("mostra dica de voz apenas quando o loop está ouvindo", async () => {
    mockParams = buildParams({ voiceMode: "true" });
    const screen = render(<BestRouteScreen />);

    expect(screen.queryByText("Você pode dizer: iniciar, repetir ou ver detalhes.")).toBeNull();

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("listening");
    });

    expect(screen.getByText("Você pode dizer: iniciar, repetir ou ver detalhes.")).toBeTruthy();
  });
});
