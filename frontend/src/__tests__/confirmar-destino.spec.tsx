import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import ConfirmDestinationScreen from "../../app/confirmar-destino";
import type { VoiceIntent } from "../utils/voiceIntentParser";
import type { VoiceLoopStatus, VoiceRecognitionIssue } from "../hooks/useVoiceConversationLoop";
import { journeyService } from "../services/journey.service";

const mockStartLoop = jest.fn().mockResolvedValue(undefined);
const mockStopAll = jest.fn().mockResolvedValue(undefined);

let mockVoiceLoopCallbacks: {
  onIntent?: (intent: VoiceIntent) => void | Promise<void>;
  onStatusChange?: (status: VoiceLoopStatus) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onRecognitionIssue?: (issue: VoiceRecognitionIssue) => void;
} = {};

let mockParams: Record<string, string> = {};

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView, Text: MockText } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.default.Text = MockText;
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
  Reanimated.FadeInDown = {
    duration: () => ({}),
    delay: () => ({ duration: () => ({}) }),
  };
  Reanimated.FadeOutUp = {
    duration: () => ({}),
  };
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.useAnimatedStyle = (updater: () => object) => updater();
  Reanimated.withTiming = (value: number) => value;
  Reanimated.withRepeat = (value: number) => value;
  Reanimated.withSequence = (...values: number[]) => values[values.length - 1];
  Reanimated.withDelay = (_delay: number, value: number) => value;
  Reanimated.interpolate = (
    value: number,
    input: number[],
    output: number[],
  ) => {
    return value >= input[input.length - 1] ? output[output.length - 1] : output[0];
  };
  Reanimated.Easing = {
    inOut: () => undefined,
    ease: undefined,
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

// VoiceVisualizer — mock simples para não depender de animações
jest.mock("../components/VoiceVisualizer", () => ({
  VoiceVisualizer: ({ state }: { state: string }) => {
    const { View: MockView } = jest.requireActual("react-native");
    return <MockView testID={`voice-visualizer-${state}`} />;
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
  stopListening: jest.fn(),
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

jest.mock("../theme/colors", () => ({
  useThemeColors: () => ({
    primary: "#2563EB",
    primaryLight: "#DBEAFE",
    white: "#FFFFFF",
    warning: "#F59E0B",
  }),
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
    interactionMode: "voice",
    recognizedText: "Centro",
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
    jest.spyOn(console, "warn").mockImplementation(() => {});
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
        interactionMode: "voice",
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
          interactionMode: "voice",
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

  it("não abre microfone automaticamente e oculta o botão no modo texto", () => {
    mockParams = buildParams({ interactionMode: "text" });

    const screen = render(<ConfirmDestinationScreen />);

    expect(mockStartLoop).not.toHaveBeenCalled();
    expect(screen.queryByText("Responder por voz")).toBeNull();
  });

  it("mostra o botão no modo voz, sem abrir o microfone até o toque", () => {
    mockParams = buildParams({ mode: "suggestions", interactionMode: "voice" });

    const screen = render(<ConfirmDestinationScreen />);

    expect(screen.getByText("Responder por voz")).toBeTruthy();
    expect(mockStartLoop).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Responder por voz"));
    expect(mockStartLoop).toHaveBeenCalledWith();
  });

  it("mantém o layout de múltiplos destinos limpo ao buscar hospital", () => {
    mockParams = buildParams({
      mode: "suggestions",
      recognizedText: "hospital",
      options: JSON.stringify([
        {
          id: "dest-1",
          name: "Hospital de Clínicas",
          address: "Av. Getúlio Guaritá, Uberaba",
          lat: -19.746,
          lng: -47.934,
          source: "GEOCODER",
        },
        {
          id: "dest-2",
          name: "Hospital São Domingos",
          address: "Rua São Domingos, Uberaba",
          lat: -19.751,
          lng: -47.93,
          source: "GEOCODER",
        },
      ]),
    });

    const screen = render(<ConfirmDestinationScreen />);

    expect(screen.getByText("Destinos encontrados")).toBeTruthy();
    expect(screen.getByText("Hospital de Clínicas")).toBeTruthy();
    expect(screen.getByText("Opção 1 de 2")).toBeTruthy();
    expect(screen.queryByText("Entendi")).toBeNull();
    expect(screen.queryByText("Você disse: hospital")).toBeNull();
    expect(screen.queryByText("Este é o destino correto?")).toBeNull();
  });

  it("usa o botão de resposta de voz sem recriar um card de voz", () => {
    const screen = render(<ConfirmDestinationScreen />);

    // Não deve existir card antigo de voz
    expect(screen.queryByText("Responda por voz")).toBeNull();
    expect(screen.queryByText("Estou ouvindo sua resposta")).toBeNull();
    expect(screen.queryByText("Falar novamente")).toBeNull();
    expect(screen.queryByText("Ouvir destino")).toBeNull();

    expect(screen.getByText("Responder por voz")).toBeTruthy();
    expect(screen.queryByText("Entendi")).toBeNull();
    expect(screen.queryByText("Você disse: Centro")).toBeNull();
  });

  it("exibe o VoiceVisualizer no modo listening quando o loop está ouvindo", async () => {
    const screen = render(<ConfirmDestinationScreen />);

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("listening");
    });

    // O VoiceVisualizer deve refletir o estado listening
    await waitFor(() => {
      expect(screen.getByTestId("voice-visualizer-listening")).toBeTruthy();
    });
  });

  it("mantém a seleção de sugestão no mesmo handler de voz", () => {
    mockParams = buildParams({
      mode: "suggestions",
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
    });

    const screen = render(<ConfirmDestinationScreen />);

    expect(screen.getByText("Centro")).toBeTruthy();
  });

  it("seleciona uma sugestão por voz e só navega após confirmar com sim", async () => {
    mockParams = buildParams({
      mode: "suggestions",
      options: JSON.stringify([
        {
          id: "dest-1",
          name: "Hospital A",
          address: "Rua A, Uberaba",
          lat: -19.7,
          lng: -47.9,
          source: "GEOCODER",
        },
        {
          id: "dest-2",
          name: "Hospital B",
          address: "Rua B, Uberaba",
          lat: -19.8,
          lng: -47.8,
          source: "GEOCODER",
        },
      ]),
    });

    render(<ConfirmDestinationScreen />);

    await act(async () => {
      await mockVoiceLoopCallbacks.onIntent?.({
        type: "SELECT_OPTION",
        optionIndex: 1,
        transcript: "segunda",
      });
    });

    await act(async () => {
      await mockVoiceLoopCallbacks.onIntent?.({ type: "CONFIRM", transcript: "sim" });
    });

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/escolher-horario",
      params: expect.objectContaining({
        destination: "Hospital B",
        destinationLat: "-19.8",
        destinationLng: "-47.8",
      }),
    });
  });

  it("tocar no card usa a mesma seleção e permite voltar às opções com não", async () => {
    mockParams = buildParams({
      mode: "suggestions",
      options: JSON.stringify([
        {
          id: "dest-1",
          name: "Hospital A",
          address: "Rua A, Uberaba",
          lat: -19.7,
          lng: -47.9,
          source: "GEOCODER",
        },
        {
          id: "dest-2",
          name: "Hospital B",
          address: "Rua B, Uberaba",
          lat: -19.8,
          lng: -47.8,
          source: "GEOCODER",
        },
      ]),
    });

    const screen = render(<ConfirmDestinationScreen />);

    fireEvent.press(screen.getByLabelText("Selecionar 2: Hospital B, Rua B, Uberaba"));

    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText("Destinos encontrados")).toBeTruthy();

    await act(async () => {
      await mockVoiceLoopCallbacks.onIntent?.({
        type: "CANCEL_THEN_ASK_DESTINATION",
        transcript: "nao",
      });
    });

    expect(router.replace).not.toHaveBeenCalledWith({
      pathname: "/inicio",
      params: {
        latitude: "-19.747",
        longitude: "-47.939",
      },
    });
    expect(screen.getByText("Destinos encontrados")).toBeTruthy();
    expect(screen.getByLabelText("Selecionar 1: Hospital A, Rua A, Uberaba")).toBeTruthy();
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

  it("não exibe transcrição parcial durante a escuta nesta tela", async () => {
    const screen = render(<ConfirmDestinationScreen />);

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("listening");
    });

    await act(async () => {
      mockVoiceLoopCallbacks.onTranscript?.("Mário Palmério", false);
    });

    await waitFor(() => {
      expect(screen.getByText("Ouvindo...")).toBeTruthy();
      expect(screen.queryByText("Você disse: Mário Palmério")).toBeNull();
    });
  });
});
