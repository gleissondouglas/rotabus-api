import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import OnboardingScreen from "../../app/onboarding";
import { completeOnboarding } from "../services/onboardingStorage";
import { speak, stopSpeaking } from "../services/speech.service";

jest.mock("expo-router", () => {
  const ReactModule = jest.requireActual("react");
  return {
    router: { replace: jest.fn() },
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useLayoutEffect(() => callback(), [callback]);
    },
  };
});

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
  useSafeAreaInsets: () => ({ top: 20, bottom: 20, left: 0, right: 0 }),
}));

jest.mock("../services/onboardingStorage", () => ({
  completeOnboarding: jest.fn(),
}));

jest.mock("../services/speech.service", () => ({
  speak: jest.fn(),
  stopSpeaking: jest.fn(),
}));

jest.mock("../contexts/AccessibilityContext", () => ({
  useAccessibility: () => ({ highContrast: false }),
}));

const mockedCompleteOnboarding = jest.mocked(completeOnboarding);
const mockedSpeak = jest.mocked(speak);
const mockedStopSpeaking = jest.mocked(stopSpeaking);

describe("OnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCompleteOnboarding.mockResolvedValue();
    mockedStopSpeaking.mockResolvedValue();
    mockedSpeak.mockResolvedValue();
  });

  it("avança e volta entre os slides mantendo a paginação", () => {
    const screen = render(<OnboardingScreen />);

    expect(screen.getByText("Bem-vindo ao Nuvem")).toBeTruthy();
    expect(screen.getByLabelText("Página 1 de 3")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Ir para próxima página"));
    expect(screen.getByText("Fale ou digite seu destino")).toBeTruthy();
    expect(screen.getByLabelText("Página 2 de 3")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Voltar para página anterior"));
    expect(screen.getByText("Bem-vindo ao Nuvem")).toBeTruthy();
  });

  it("pular salva a conclusão e abre as boas-vindas", async () => {
    const screen = render(<OnboardingScreen />);
    fireEvent.press(screen.getByLabelText("Pular apresentação"));

    await waitFor(() => expect(mockedCompleteOnboarding).toHaveBeenCalled());
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("começar aparece somente no último slide e conclui o fluxo", async () => {
    const screen = render(<OnboardingScreen />);
    expect(screen.queryByText("Começar")).toBeNull();

    fireEvent.press(screen.getByLabelText("Ir para próxima página"));
    fireEvent.press(screen.getByLabelText("Ir para próxima página"));

    expect(screen.getByText("Escolha e siga sua rota")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Finalizar apresentação e começar"));

    await waitFor(() => expect(mockedCompleteOnboarding).toHaveBeenCalled());
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("ouvir interrompe a fala anterior e lê título e descrição", async () => {
    const screen = render(<OnboardingScreen />);
    mockedStopSpeaking.mockClear();

    fireEvent.press(screen.getByLabelText("Ouvir conteúdo da página: Bem-vindo ao Nuvem"));

    await waitFor(() => {
      expect(mockedStopSpeaking).toHaveBeenCalled();
      expect(mockedSpeak).toHaveBeenCalledWith(
        "Bem-vindo ao Nuvem. Seu assistente para encontrar rotas de ônibus de forma simples.",
      );
    });
  });

  it("interrompe a fala ao trocar de slide", () => {
    const screen = render(<OnboardingScreen />);
    mockedStopSpeaking.mockClear();

    fireEvent.press(screen.getByLabelText("Ir para próxima página"));

    expect(mockedStopSpeaking).toHaveBeenCalled();
  });
});
