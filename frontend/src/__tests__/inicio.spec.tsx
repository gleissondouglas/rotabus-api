import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import HomeScreen from "../../app/inicio";
import type { VoiceLoopStatus } from "../hooks/useVoiceConversationLoop";
import { vibrationService } from "../services/vibration.service";

const mockStartLoop = jest.fn().mockResolvedValue(undefined);
const mockStopAll = jest.fn().mockResolvedValue(undefined);

let mockVoiceLoopCallbacks: {
  onStatusChange?: (status: VoiceLoopStatus) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
} = {};

jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.useAnimatedStyle = (updater: () => object) => updater();
  Reanimated.withTiming = (value: number) => value;
  Reanimated.withRepeat = (value: number) => value;
  Reanimated.withSequence = (...values: number[]) => values[values.length - 1];
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
  };
  Reanimated.FadeInUp = {
    delay: () => ({
      duration: () => ({}),
    }),
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
      ReactModule.useEffect(() => callback(), [callback]);
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

jest.mock("../hooks/useVoiceConversationLoop", () => ({
  useVoiceConversationLoop: (options: typeof mockVoiceLoopCallbacks) => {
    mockVoiceLoopCallbacks = options;

    return {
      status: "idle",
      startLoop: mockStartLoop,
      stopAll: mockStopAll,
    };
  },
}));

jest.mock("../services/session.service", () => ({
  sessionService: {
    restoreSessionId: jest.fn().mockResolvedValue(null),
    getUser: jest.fn().mockResolvedValue({ name: "Douglas Oliveira" }),
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
  },
}));

jest.mock("../services/speech.service", () => ({
  stopListening: jest.fn(),
}));

jest.mock("../theme/colors", () => ({
  useThemeColors: () => ({
    primary: "#2563EB",
    primaryLight: "#DBEAFE",
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("dispara a saudação automática ao entrar na tela", async () => {
    render(<HomeScreen />);

    await waitFor(() => {
      expect(mockStartLoop).toHaveBeenCalledWith(
        "Olá, Douglas. Para onde você quer ir hoje?",
      );
    });
  });

  it("só mostra o card de escuta quando o status é listening", async () => {
    const screen = render(<HomeScreen />);

    expect(screen.queryByText("Estou ouvindo...")).toBeNull();

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("speaking");
    });

    expect(screen.queryByText("Estou ouvindo...")).toBeNull();

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("listening");
    });

    expect(screen.getByText("Estou ouvindo...")).toBeTruthy();
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

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("error");
    });

    fireEvent.press(screen.getByText("Falar destino"));

    expect(vibrationService.light).toHaveBeenCalled();
    expect(mockStartLoop).toHaveBeenCalledWith();
  });
});
