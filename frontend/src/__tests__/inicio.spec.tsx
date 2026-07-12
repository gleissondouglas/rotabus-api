import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import HomeScreen from "../../app/inicio";
import type { VoiceLoopStatus, VoiceRecognitionIssue } from "../hooks/useVoiceConversationLoop";
import { vibrationService } from "../services/vibration.service";
import { resetHomeVoiceSessionForTests } from "../state/homeVoiceSession";

const mockStartLoop = jest.fn().mockResolvedValue(undefined);
const mockStopAll = jest.fn().mockResolvedValue(undefined);
const mockStopListeningAndSubmit = jest.fn().mockResolvedValue(undefined);

let mockVoiceLoopCallbacks: {
  onStatusChange?: (status: VoiceLoopStatus) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onRecognitionIssue?: (issue: VoiceRecognitionIssue) => void;
} = {};

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView, Text: MockText } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.default.Text = MockText;
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
    out: () => undefined,
    cubic: () => undefined,
    inOut: () => () => undefined,
    ease: undefined,
  };
  Reanimated.FadeIn = {
    duration: () => ({}),
    delay: () => ({ duration: () => ({}) }),
  };
  Reanimated.FadeInDown = {
    duration: () => ({}),
    delay: () => ({ duration: () => ({}) }),
  };
  Reanimated.FadeInUp = {
    delay: () => ({
      duration: () => ({}),
    }),
  };
  Reanimated.FadeOutUp = {
    duration: () => ({}),
  };

  return Reanimated;
});

jest.mock("expo-router", () => {
  const ReactModule = jest.requireActual("react");

  return {
    router: {
      push: jest.fn(),
    },
    useLocalSearchParams: () => ({}),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useLayoutEffect(() => callback(), [callback]);
    },
  };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text: MockText } = jest.requireActual("react-native");
    return <MockText>{name}</MockText>;
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("../components/ScreenContainer", () => ({
  ScreenContainer: ({ children }: { children: any }) => {
    const { View: MockView } = jest.requireActual("react-native");
    return <MockView>{children}</MockView>;
  },
}));

// Mock dos novos componentes.
// O jest.mock resolve o path relativo ao arquivo de teste (src/__tests__/).
// ../components/ daqui aponta para src/components/, que é o mesmo módulo
// que app/inicio.tsx importa como ../src/components/
jest.mock("../components/VoiceVisualizer", () => ({
  VoiceVisualizer: ({ state }: { state: string }) => {
    const { View: MockView } = jest.requireActual("react-native");
    return <MockView testID={`voice-visualizer-${state}`} />;
  },
}));

jest.mock("../components/VoicePromptText", () => ({
  VoicePromptText: ({ text }: { text: string }) => {
    const { Text: MockText } = jest.requireActual("react-native");
    return <MockText>{text}</MockText>;
  },
}));

jest.mock("../components/LiveTranscript", () => ({
  LiveTranscript: ({ transcript, isFinal }: { transcript: string; isFinal: boolean }) => {
    const { Text: MockText } = jest.requireActual("react-native");
    return (
      <MockText testID={isFinal ? "live-transcript-final" : "live-transcript-partial"}>
        {transcript}
      </MockText>
    );
  },
}));

jest.mock("../components/BottomActionBar", () => ({
  BottomActionBar: ({
    micLabel,
    onTypeDestination,
    onMicPress,
  }: {
    status: string;
    micLabel: string;
    onTypeDestination: () => void;
    onMicPress: () => void;
  }) => {
    const { View: MockView, Text: MockText, Pressable: MockPressable } = jest.requireActual("react-native");
    return (
      <MockView>
        <MockPressable onPress={onTypeDestination} accessibilityLabel="Digitar destino">
          <MockText>Digitar destino</MockText>
        </MockPressable>
        <MockPressable
          onPress={onMicPress}
          accessibilityLabel={micLabel}
        >
          <MockText>{micLabel}</MockText>
        </MockPressable>
      </MockView>
    );
  },
}));


jest.mock("../hooks/useVoiceConversationLoop", () => ({
  useVoiceConversationLoop: (options: typeof mockVoiceLoopCallbacks) => {
    mockVoiceLoopCallbacks = options;

    return {
      status: "idle",
      startLoop: mockStartLoop,
      stopAll: mockStopAll,
      stopListeningAndSubmit: mockStopListeningAndSubmit,
    };
  },
}));

jest.mock("../services/session.service", () => ({
  sessionService: {
    restoreSessionId: jest.fn().mockResolvedValue(null),
    getUser: jest.fn().mockResolvedValue({ name: "Douglas Oliveira" }),
    clearSessionId: jest.fn(),
  },
}));

jest.mock("../services/journey.service", () => ({
  journeyService: {
    resolveDestination: jest.fn(),
  },
}));

jest.mock("../services/location.service", () => ({
  locationService: {
    getCurrentLocation: jest.fn().mockResolvedValue({
      latitude: -19.7472,
      longitude: -47.9392,
    }),
  },
}));

jest.mock("../services/vibration.service", () => ({
  vibrationService: {
    light: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    medium: jest.fn(),
    selection: jest.fn(),
  },
}));

jest.mock("../services/speech.service", () => ({
  stopListening: jest.fn(),
}));

jest.mock("../theme/colors", () => ({
  useThemeColors: () => ({
    primary: "#2563EB",
    primaryLight: "#DBEAFE",
    white: "#FFFFFF",
  }),
}));

jest.mock("../utils/helpers", () => ({
  cleanVoiceTranscript: (text: string) => text.trim(),
}));

describe("HomeScreen voice-first flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockVoiceLoopCallbacks = {};
    resetHomeVoiceSessionForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("não abre o microfone automaticamente ao entrar na tela", () => {
    const screen = render(<HomeScreen />);

    expect(mockStartLoop).not.toHaveBeenCalled();
    expect(screen.getByText("Falar destino")).toBeTruthy();
  });

  it("mantém a saudação visual ao voltar para a tela sem abrir o microfone", async () => {
    const firstRender = render(<HomeScreen />);

    await act(async () => {
      firstRender.unmount();
    });
    mockStartLoop.mockClear();

    const secondRender = render(<HomeScreen />);

    await waitFor(() => {
      expect(secondRender.queryByText("Para onde você quer ir hoje?")).toBeTruthy();
    });

    expect(mockStartLoop).not.toHaveBeenCalled();
  });

  it("mantém digitação e microfone lado a lado quando está ouvindo", async () => {
    const screen = render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText("Para onde você quer ir hoje?")).toBeTruthy());

    expect(screen.getByText("Digitar destino")).toBeTruthy();
    expect(screen.getByText("Falar destino")).toBeTruthy();

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("speaking");
    });

    expect(screen.getByText("Digitar destino")).toBeTruthy();
    expect(screen.getByText("Aguarde")).toBeTruthy();

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("listening");
    });

    expect(screen.getByText("Digitar destino")).toBeTruthy();
    expect(screen.getByText("Parar e enviar")).toBeTruthy();
  });

  it("mantém o botão de digitar funcionando depois de erro de voz", async () => {
    const screen = render(<HomeScreen />);

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("error");
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Digitar destino"));
      await Promise.resolve();
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(mockStopAll).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/digitar-destino",
      params: { latitude: "-19.7472", longitude: "-47.9392" },
    });
  });

  it("permite reabrir o microfone manualmente depois de erro", async () => {
    const screen = render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText("Falar destino")).toBeTruthy());

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("error");
    });

    fireEvent.press(screen.getByLabelText("Tentar de novo"));

    expect(vibrationService.light).toHaveBeenCalled();
    expect(mockStartLoop).toHaveBeenCalledWith();
  });

  it("mostra claramente a transcrição descartada por ruído curto", async () => {
    const screen = render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText("Falar destino")).toBeTruthy());

    await act(async () => {
      mockVoiceLoopCallbacks.onRecognitionIssue?.({
        type: "UNCLEAR_TRANSCRIPT",
        transcript: "ah",
        message: "Entendi \"ah\", mas isso parece muito curto.",
      });
      mockVoiceLoopCallbacks.onStatusChange?.("error");
    });

    expect(screen.getByText("Entendi \"ah\", mas isso parece muito curto.")).toBeTruthy();
    // Transcrição "ah" deve aparecer no LiveTranscript
    expect(screen.getByTestId("live-transcript-final")).toBeTruthy();
  });

  it("exibe mensagem de fallback de silêncio quando usuário não fala nada", async () => {
    const screen = render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText("Falar destino")).toBeTruthy());

    await act(async () => {
      mockVoiceLoopCallbacks.onRecognitionIssue?.({
        type: "EMPTY_TRANSCRIPT",
        message: "Não consegui entender sua fala. Toque no microfone e tente novamente.",
      });
      mockVoiceLoopCallbacks.onStatusChange?.("error");
    });

    expect(screen.getByText("Não entendi, toque no microfone para falar.")).toBeTruthy();
  });

  it("reflete o estado speaking no label do botão mic enquanto assistente fala", async () => {
    const screen = render(<HomeScreen />);

    // Estado inicial: deve mostrar "Falar destino"
    await waitFor(() => {
      expect(screen.getByText("Falar destino")).toBeTruthy();
    });

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("speaking");
    });

    // Durante speaking o botão deve mostrar "Aguarde"
    await waitFor(() => {
      expect(screen.getByText("Aguarde")).toBeTruthy();
    });

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("listening");
    });

    // Durante listening o botão deve permitir encerrar e enviar a resposta.
    await waitFor(() => {
      expect(screen.getByText("Parar e enviar")).toBeTruthy();
    });
  });

  it("exibe a transcrição parcial na área central durante a escuta", async () => {
    const screen = render(<HomeScreen />);

    // Aguarda o componente montar e registrar os callbacks
    await waitFor(() => {
      expect(screen.getByText("Falar destino")).toBeTruthy();
    });

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("listening");
    });

    await waitFor(() => {
    expect(screen.getByText("Parar e enviar")).toBeTruthy();
    });

    await act(async () => {
      mockVoiceLoopCallbacks.onTranscript?.("Terminal central", false);
    });

    // O texto transcrito deve aparecer na tela
    await waitFor(() => {
      expect(screen.getByText("Terminal central")).toBeTruthy();
    });
  });
});
