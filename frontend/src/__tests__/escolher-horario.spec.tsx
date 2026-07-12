import { act, fireEvent, render } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";

import ChooseTimeScreen from "../../app/escolher-horario";
import type { VoiceIntent } from "../utils/voiceIntentParser";
import type { VoiceLoopStatus, VoiceRecognitionIssue } from "../hooks/useVoiceConversationLoop";

const mockStartLoop = jest.fn().mockResolvedValue(undefined);
const mockStopAll = jest.fn().mockResolvedValue(undefined);
const mockStopListeningAndSubmit = jest.fn().mockResolvedValue(undefined);

let mockParams: Record<string, string> = {};
let mockVoiceLoopCallbacks: {
  onIntent?: (intent: VoiceIntent) => void | Promise<void>;
  onStatusChange?: (status: VoiceLoopStatus) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onRecognitionIssue?: (issue: VoiceRecognitionIssue) => void;
} = {};

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
  useVoiceConversationLoop: (options: typeof mockVoiceLoopCallbacks) => {
    mockVoiceLoopCallbacks = options;

    return {
      startLoop: mockStartLoop,
      stopAll: mockStopAll,
      stopListeningAndSubmit: mockStopListeningAndSubmit,
    };
  },
}));

jest.mock("../services/speech.service", () => ({
  stopListening: jest.fn(),
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
    interactionMode: "voice",
    ...overrides,
  };
}

describe("ChooseTimeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVoiceLoopCallbacks = {};
    mockParams = buildParams();
    (useLocalSearchParams as jest.Mock).mockImplementation(() => mockParams);
  });

  it("não abre o microfone automaticamente quando interactionMode é texto", () => {
    mockParams = buildParams({ interactionMode: "text" });

    render(<ChooseTimeScreen />);

    expect(mockStartLoop).not.toHaveBeenCalled();
  });

  it("preserva origem, destino e interactionMode ao escolher agora por toque", () => {
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
        interactionMode: "voice",
        timeType: "DEPARTURE",
      }),
    });
  });

  it("remove a dica central de voz e usa o microfone inferior", () => {
    const screen = render(<ChooseTimeScreen />);

    expect(screen.queryByText(/Você pode dizer/)).toBeNull();
    expect(screen.queryByText("Ouvir opções")).toBeNull();
    expect(screen.getByText("Responder por voz")).toBeTruthy();
    expect(screen.getByText("Diga agora, hoje às oito ou amanhã às nove")).toBeTruthy();
  });

  it("mostra transcrição e estado de erro sem card grande", async () => {
    const screen = render(<ChooseTimeScreen />);

    await act(async () => {
      mockVoiceLoopCallbacks.onRecognitionIssue?.({
        type: "UNCLEAR_TRANSCRIPT",
        transcript: "ah",
        message: "Entendi \"ah\", mas isso parece muito curto.",
      });
      mockVoiceLoopCallbacks.onStatusChange?.("error");
    });

    expect(screen.getByText("Entendi: ah")).toBeTruthy();
    expect(screen.getByText("Entendi \"ah\", mas isso parece muito curto.")).toBeTruthy();
    expect(screen.getByText("Tocar para tentar novamente")).toBeTruthy();
  });

  it("permite abrir o microfone manualmente com um toque", () => {
    const screen = render(<ChooseTimeScreen />);

    mockStartLoop.mockClear();
    fireEvent.press(screen.getByLabelText("Responder por voz"));

    expect(mockStartLoop).toHaveBeenCalledWith();
  });

  it("encerra e envia a fala no segundo toque", async () => {
    const screen = render(<ChooseTimeScreen />);

    await act(async () => {
      mockVoiceLoopCallbacks.onStatusChange?.("listening");
    });

    fireEvent.press(screen.getByLabelText("Parar e enviar"));

    expect(mockStopListeningAndSubmit).toHaveBeenCalledTimes(1);
  });

  it("renderiza os cards de horário de 30 em 30 minutos e permite selecionar", () => {
    const screen = render(<ChooseTimeScreen />);
    
    fireEvent.press(screen.getByText("Outro horário"));
    
    // Verifica que alguns slots foram gerados (ex: 00:00, 08:30, 23:30)
    expect(screen.getByLabelText("Horário 00:00")).toBeTruthy();
    expect(screen.getByLabelText("Horário 08:30")).toBeTruthy();
    expect(screen.getByLabelText("Horário 23:30")).toBeTruthy();

    // Seleciona um horário e verifica se ele adquire o estado "selected"
    const card0930 = screen.getByLabelText("Horário 09:30");
    fireEvent.press(card0930);
    
    expect(card0930.props.accessibilityState.selected).toBe(true);
  });

  it("garante que opções rápidas de horário e inputs manuais não aparecem mais", () => {
    const screen = render(<ChooseTimeScreen />);
    fireEvent.press(screen.getByText("Outro horário"));
    
    expect(screen.queryByText("+30 min")).toBeNull();
    expect(screen.queryByText("+1h")).toBeNull();
    expect(screen.queryByText("+2h")).toBeNull();
    expect(screen.queryByText("Ajustar")).toBeNull();
  });

  it("confirma horário de saída usando a nova UI de cards", () => {
    const screen = render(<ChooseTimeScreen />);
    fireEvent.press(screen.getByText("Outro horário"));
    
    // Supondo que selecionou "Amanhã"
    fireEvent.press(screen.getByText("Amanhã"));
    // Seleciona o horário
    fireEvent.press(screen.getByLabelText("Horário 10:30"));
    // Confirma
    fireEvent.press(screen.getByText("Confirmar horário"));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/processando",
        params: expect.objectContaining({ timeType: "DEPARTURE" }),
      })
    );
  });

  it("confirma horário de chegada usando a nova UI de cards", () => {
    const screen = render(<ChooseTimeScreen />);
    fireEvent.press(screen.getByText("Chegar até um horário"));
    
    // Seleciona o horário
    fireEvent.press(screen.getByLabelText("Horário 16:30"));
    // Confirma
    fireEvent.press(screen.getByText("Confirmar horário"));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/processando",
        params: expect.objectContaining({ timeType: "ARRIVAL" }),
      })
    );
  });

  it("atualiza a UI de cards corretamente quando um intent de voz é recebido", async () => {
    const screen = render(<ChooseTimeScreen />);
    fireEvent.press(screen.getByText("Outro horário"));
    
    await act(async () => {
      if (mockVoiceLoopCallbacks.onIntent) {
        await mockVoiceLoopCallbacks.onIntent({
          type: "DESTINATION_TEXT",
          text: "quero sair amanhã às 20:00",
          transcript: "quero sair amanhã às 20:00",
        });
      }
    });

    const card2000 = screen.getByLabelText("Horário 20:00");
    expect(card2000.props.accessibilityState.selected).toBe(true);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/processando",
        params: expect.objectContaining({ timeType: "DEPARTURE" }),
      })
    );
  });
});
