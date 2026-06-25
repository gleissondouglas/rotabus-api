import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import WelcomeScreen from "../../app";
import { sessionService } from "../services/session.service";
import { speak, stopSpeaking } from "../services/speech.service";

jest.mock("expo-router", () => {
  const ReactModule = jest.requireActual("react");

  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
    },
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
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("../services/session.service", () => ({
  sessionService: {
    getToken: jest.fn(),
    getHasSeenPermissions: jest.fn(),
  },
}));

jest.mock("../services/speech.service", () => ({
  speak: jest.fn(),
  stopSpeaking: jest.fn(),
}));

jest.mock("../contexts/AccessibilityContext", () => ({
  useAccessibility: () => ({ highContrast: false }),
}));

jest.mock("../theme/colors", () => ({
  useThemeColors: () => ({
    primary: "#2563EB",
    primaryDark: "#1E40AF",
    primaryLight: "#EEF4FF",
    background: "#F8FAFF",
    card: "#FFFFFF",
    white: "#FFFFFF",
    text: "#1E293B",
    textMuted: "#475569",
    border: "#E0EAFF",
    danger: "#EF4444",
    success: "#10B981",
    warning: "#F59E0B",
  }),
}));

const mockedSessionService = jest.mocked(sessionService);

describe("WelcomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSessionService.getToken.mockResolvedValue(null);
    mockedSessionService.getHasSeenPermissions.mockResolvedValue(false);
  });

  it("mostra o estado de carregamento enquanto verifica a sessão", () => {
    mockedSessionService.getToken.mockReturnValue(new Promise(() => {}));

    const screen = render(<WelcomeScreen />);

    expect(screen.getByText("Entrando no Nuvem...")).toBeTruthy();
  });

  it("redireciona para inicio quando existe token e permissões vistas", async () => {
    mockedSessionService.getToken.mockResolvedValue("token-1");
    mockedSessionService.getHasSeenPermissions.mockResolvedValue(true);

    render(<WelcomeScreen />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/inicio");
    });
  });

  it("redireciona para permissões quando existe token sem permissões vistas", async () => {
    mockedSessionService.getToken.mockResolvedValue("token-1");
    mockedSessionService.getHasSeenPermissions.mockResolvedValue(false);

    render(<WelcomeScreen />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/permissoes");
    });
  });

  it("mostra boas-vindas e fala a mensagem quando não existe sessão", async () => {
    const screen = render(<WelcomeScreen />);

    await waitFor(() => {
      expect(screen.getByText("Bem-vindo ao Nuvem")).toBeTruthy();
    });

    expect(screen.getByText("Mobilidade por voz")).toBeTruthy();
    expect(screen.getByText("Sua assistente de mobilidade por voz.")).toBeTruthy();
    expect(screen.getByText("Encontre rotas de ônibus de forma simples.")).toBeTruthy();
    expect(speak).toHaveBeenCalledWith(
      "Bem-vindo ao Nuvem. Sua assistente de mobilidade por voz. Encontre rotas de ônibus de forma simples.",
    );
  });

  it("envia para login ao tocar no CTA", async () => {
    const screen = render(<WelcomeScreen />);

    const button = await screen.findByLabelText("Entrar ou criar conta");
    fireEvent.press(button);

    expect(stopSpeaking).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/login");
  });
});
