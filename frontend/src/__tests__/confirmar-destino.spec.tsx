import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import ConfirmDestinationScreen from "../../app/confirmar-destino";
import type { VoiceIntent } from "../utils/voiceIntentParser";
import type { VoiceLoopStatus } from "../hooks/useVoiceConversationLoop";
import { journeyService } from "../services/journey.service";

const mockStartLoop = jest.fn().mockResolvedValue(undefined);
const mockStopAll = jest.fn().mockResolvedValue(undefined);

let mockVoiceLoopCallbacks: {
  onIntent?: (intent: VoiceIntent) => void | Promise<void>;
  onStatusChange?: (status: VoiceLoopStatus) => void;
} = {};

let mockParams: Record<string, string> = {};

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.FadeIn = {
    duration: () => ({}),
  };
  Reanimated.FadeInUp = {
    delay: () => ({
      duration: () => ({
        springify: () => ({}),
      }),
    }),
    duration: () => ({
      springify: () => ({}),
    }),
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
    return <Text>Voltar</Text>;
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
    error: jest.fn(),
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
    address: "Centro, Uberaba",
    confirmationQuestion: "Este é o destino correto?",
    options: JSON.stringify([
      {
        id: "dest-1",
        name: "Centro",
        address: "Centro, Uberaba",
        lat: -19.748,
        lng: -47.932,
        source: "GEOCODER",
      },
    ]),
    mode: "resolved",
    message: "Destino encontrado",
    sessionId: "session-1",
    voiceMode: "true",
    ...overrides,
  };
}

describe("ConfirmDestinationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVoiceLoopCallbacks = {};
    mockParams = buildParams();
    (useLocalSearchParams as jest.Mock).mockImplementation(() => mockParams);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("usa o mesmo fluxo do botão quando o usuário fala sim", async () => {
    render(<ConfirmDestinationScreen />);

    await act(async () => {
      await mockVoiceLoopCallbacks.onIntent?.({ type: "CONFIRM", transcript: "sim" });
    });

    expect(journeyService.executeCommand).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: "CONFIRM" }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/escolher-horario",
      params: expect.objectContaining({
        latitude: "-19.747",
        longitude: "-47.939",
        destination: "Centro",
        destinationLat: "-19.748",
        destinationLng: "-47.932",
        sessionId: "session-1",
        voiceMode: "true",
      }),
    });
  });

  it("envia os mesmos params quando o usuário toca no botão de buscar rota", async () => {
    const screen = render(<ConfirmDestinationScreen />);

    fireEvent.press(screen.getByText("Buscar rota para este lugar"));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/escolher-horario",
        params: expect.objectContaining({
          latitude: "-19.747",
          longitude: "-47.939",
          destination: "Centro",
          destinationLat: "-19.748",
          destinationLng: "-47.932",
          selectedDestination: expect.stringContaining("Centro"),
          voiceMode: "true",
        }),
      });
    });
  });

  it("usa o mesmo fluxo de escolher outro destino quando o usuário fala não", async () => {
    render(<ConfirmDestinationScreen />);

    await act(async () => {
      await mockVoiceLoopCallbacks.onIntent?.({
        type: "CANCEL_THEN_ASK_DESTINATION",
        transcript: "nao",
      });
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/inicio",
      params: {
        latitude: "-19.747",
        longitude: "-47.939",
      },
    });
  });

  it("não abre microfone automático quando voiceMode não está ativo", () => {
    mockParams = buildParams({ voiceMode: "false" });

    render(<ConfirmDestinationScreen />);

    expect(mockStartLoop).not.toHaveBeenCalled();
  });

  it("não navega quando faltam coordenadas do destino", async () => {
    mockParams = buildParams({
      options: JSON.stringify([
        {
          id: "dest-1",
          name: "Centro",
          address: "Centro, Uberaba",
          lat: null,
          lng: null,
          source: "GEOCODER",
        },
      ]),
    });

    render(<ConfirmDestinationScreen />);

    await act(async () => {
      await mockVoiceLoopCallbacks.onIntent?.({ type: "CONFIRM", transcript: "sim" });
    });

    expect(router.push).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Localização não encontrada",
      "Não consegui confirmar a localização desse destino. Tente escolher outra opção.",
      [{ text: "OK" }],
    );
  });
});
