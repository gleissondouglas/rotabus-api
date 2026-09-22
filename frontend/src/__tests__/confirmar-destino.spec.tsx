import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router } from "expo-router";

import ConfirmDestinationScreen from "../../app/confirmar-destino";
import { vibrationService } from "../services/vibration.service";

// ─── Mock: react-native-reanimated ────────────────────────────────────────────
jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock");
  const { View: MockView, ScrollView: MockScrollView } = jest.requireActual("react-native");

  Reanimated.default.View = MockView;
  Reanimated.default.ScrollView = MockScrollView;
  Reanimated.useSharedValue = (value: number) => ({ value });
  Reanimated.useAnimatedStyle = (updater: () => object) => updater();
  Reanimated.useAnimatedScrollHandler = () => () => {};
  Reanimated.interpolate = (_v: number, _i: number[], output: number[]) => output[0];
  Reanimated.withTiming = (v: number) => v;
  Reanimated.Extrapolation = { CLAMP: "clamp" };

  const chainable = {
    duration: function () { return this; },
    delay: function () { return this; },
  };
  Reanimated.FadeIn = chainable;
  Reanimated.FadeInUp = chainable;

  return Reanimated;
});

// ─── Mock: react-native-maps ──────────────────────────────────────────────────
jest.mock("react-native-maps", () => {
  const { View } = jest.requireActual("react-native");
  const MapView = ({ testID, children }: any) => (
    <View testID={testID ?? "map-view"}>{children}</View>
  );
  const Marker = ({ children }: any) => <View testID="map-marker">{children}</View>;
  return { __esModule: true, default: MapView, Marker };
});

// ─── Mock: expo-router ────────────────────────────────────────────────────────
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

// ─── Mock: expo-linear-gradient ───────────────────────────────────────────────
jest.mock("expo-linear-gradient", () => {
  const { View } = jest.requireActual("react-native");
  return { LinearGradient: ({ children }: any) => <View>{children}</View> };
});

// ─── Mock: @expo/vector-icons ─────────────────────────────────────────────────
jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

// ─── Mock: react-native-safe-area-context ─────────────────────────────────────
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ─── Mock: componentes internos ───────────────────────────────────────────────
jest.mock("../components/BackgroundGradient", () => ({
  BackgroundGradient: () => null,
}));

jest.mock("../components/BackButton", () => ({
  BackButton: ({ label }: { label: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{label}</Text>;
  },
}));

jest.mock("../components/PrimaryButton", () => ({
  PrimaryButton: ({ title, onPress, disabled }: any) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return (
      <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={title}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

jest.mock("../components/LiquidGlassView", () => ({
  LiquidGlassView: ({ children }: any) => {
    const { View } = jest.requireActual("react-native");
    return <View>{children}</View>;
  },
}));

jest.mock("../components/DestinationCategoryIcon", () => ({
  DestinationCategoryIcon: () => null,
}));

// ─── Mock: hooks ──────────────────────────────────────────────────────────────
jest.mock("../hooks/useAutoSpeakOnce", () => ({
  useAutoSpeakOnce: jest.fn(),
}));

jest.mock("../hooks/usePreventDoublePress", () => ({
  usePreventDoublePress: (fn: (...args: any[]) => any) => fn,
}));

// ─── Mock: serviços ───────────────────────────────────────────────────────────
jest.mock("../services/vibration.service", () => ({
  vibrationService: {
    light: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    selection: jest.fn(),
  },
}));

// ─── Mock: tema ───────────────────────────────────────────────────────────────
jest.mock("../theme/colors", () => ({
  useThemeColors: () => ({
    primary: "#2563EB",
    primaryLight: "#DBEAFE",
    text: "#0F172A",
    textMuted: "#64748B",
    card: "#FFFFFF",
    background: "#F8FAFC",
  }),
}));

jest.mock("../theme/layout", () => ({
  layout: {
    screenHorizontalPadding: 20,
    screenHorizontalPaddingSmall: 16,
  },
}));

// ─── Mock: utilitários ────────────────────────────────────────────────────────
jest.mock("../utils/helpers", () => ({
  parseJsonParam: jest.fn((_param: any, fallback: any) => fallback),
}));

jest.mock("../utils/destinationCategory.mapper", () => ({
  resolveDestinationCategory: () => "other",
  getDestinationCategoryLabel: () => "Outro",
}));

// ─── Referências dos mocks dinâmicos ──────────────────────────────────────────
const { useLocalSearchParams } = jest.requireMock("expo-router");
const mockParseJsonParam: jest.Mock = jest.requireMock("../utils/helpers").parseJsonParam;

function setParams(params: Record<string, string>) {
  useLocalSearchParams.mockReturnValue(params);
}

// ─── Fixtures de params ───────────────────────────────────────────────────────
const PARAMS_BASE = {
  latitude: "-19.7472",
  longitude: "-47.9392",
  destination: "Terminal Central",
  address: "Av. Leopoldino de Oliveira, 123, Uberaba, MG",
  city: "Uberaba - MG",
  mode: "confirm",
  sessionId: "sess-001",
  isVoiceSearch: "false",
  displayData: "",
  options: "",
  conversationState: "JOURNEY_DISPLAYED",
};

const PARAMS_CAROUSEL = {
  ...PARAMS_BASE,
  conversationState: "WAITING_DESTINATION_SELECTION",
};

const OPTIONS_TWO = [
  { id: "1", name: "Terminal Central", address: "Av. Principal, 100, Uberaba, MG", lat: -19.74, lng: -47.93 },
  { id: "2", name: "Terminal Sul", address: "Rua Sul, 200, Uberaba, MG", lat: -19.75, lng: -47.94 },
];

/** Helper: faz o parseJsonParam retornar displayData com um item único contendo coordenadas */
function mockSingleDestWithCoords() {
  mockParseJsonParam.mockImplementation((_p: any, fallback: any) => {
    if (fallback === null) {
      return {
        items: [{ id: "1", name: "Terminal Central", address: "Av. Principal, 100, Uberaba, MG", lat: -19.74, lng: -47.93 }],
      };
    }
    return fallback;
  });
}

/** Helper: faz o parseJsonParam retornar displayData com um item sem coordenadas */
function mockSingleDestNoCoords() {
  mockParseJsonParam.mockImplementation((_p: any, fallback: any) => {
    if (fallback === null) {
      return {
        items: [{ id: "1", name: "Destino sem coords", address: "Rua X, Uberaba, MG" }],
      };
    }
    return fallback;
  });
}

/** Helper: faz o parseJsonParam retornar a lista de opções para o carrossel */
function mockCarouselOptions() {
  mockParseJsonParam.mockImplementation((_p: any, fallback: any) => {
    // Primeira chamada = displayData (null → null), segunda = options ([] → OPTIONS_TWO)
    if (fallback === null) return null;
    return OPTIONS_TWO;
  });
}

// ─── Testes ───────────────────────────────────────────────────────────────────
describe("ConfirmDestinationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setParams(PARAMS_BASE);
    // Padrão: retorna fallback → tela renderiza sem destino real
    mockParseJsonParam.mockImplementation((_p: any, fallback: any) => fallback);
  });

  // ── Renderização básica ──────────────────────────────────────────────────────

  it("renderiza o título 'Destino encontrado' no modo card único", () => {
    mockSingleDestWithCoords();
    const { getByText } = render(<ConfirmDestinationScreen />);
    expect(getByText("Destino encontrado")).toBeTruthy();
  });

  it("renderiza o botão principal 'Buscar rota'", () => {
    const { getByText } = render(<ConfirmDestinationScreen />);
    expect(getByText("Buscar rota")).toBeTruthy();
  });

  it("renderiza o botão 'Alterar' (voltar)", () => {
    const { getByText } = render(<ConfirmDestinationScreen />);
    expect(getByText("Alterar")).toBeTruthy();
  });

  it("renderiza o link de ajuda", () => {
    const { getByText } = render(<ConfirmDestinationScreen />);
    expect(getByText("Ajuda")).toBeTruthy();
  });

  // ── Snapshot de mapa no card único ──────────────────────────────────────────

  it("exibe o MapView quando o destino tem coordenadas válidas", () => {
    mockSingleDestWithCoords();
    const { getAllByTestId } = render(<ConfirmDestinationScreen />);
    expect(getAllByTestId("map-view").length).toBeGreaterThan(0);
  });

  it("exibe o ícone fallback 'map-outline' quando não há coordenadas", () => {
    mockSingleDestNoCoords();
    const { getAllByTestId } = render(<ConfirmDestinationScreen />);
    expect(getAllByTestId("icon-map-outline").length).toBeGreaterThan(0);
  });

  it("exibe badge 'Confirmado' quando o destino tem coordenadas", () => {
    mockSingleDestWithCoords();
    const { getByText } = render(<ConfirmDestinationScreen />);
    // No card único o texto do badge é "Ponto confirmado"
    expect(getByText("Ponto confirmado")).toBeTruthy();
  });

  // ── Carrossel ────────────────────────────────────────────────────────────────

  it("renderiza o título 'Destinos encontrados' no modo carrossel", () => {
    setParams(PARAMS_CAROUSEL);
    mockCarouselOptions();
    const { getByText } = render(<ConfirmDestinationScreen />);
    expect(getByText("Destinos encontrados")).toBeTruthy();
  });

  it("exibe o subtítulo com a quantidade correta de opções no carrossel", () => {
    setParams(PARAMS_CAROUSEL);
    mockCarouselOptions();
    const { getByText } = render(<ConfirmDestinationScreen />);
    expect(getByText("2 opções para escolher")).toBeTruthy();
  });

  it("exibe MapView para cada card do carrossel que tem coordenadas", () => {
    setParams(PARAMS_CAROUSEL);
    mockCarouselOptions();
    const { getAllByTestId } = render(<ConfirmDestinationScreen />);
    // Dois cards, cada um com MapView
    expect(getAllByTestId("map-view").length).toBeGreaterThanOrEqual(2);
  });

  // ── Navegação e alertas ───────────────────────────────────────────────────────

  it("exibe alerta e chama vibrationService.error quando a origem não tem coordenadas", async () => {
    setParams({ ...PARAMS_BASE, latitude: "", longitude: "" });
    mockSingleDestWithCoords();

    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByText } = render(<ConfirmDestinationScreen />);

    await act(async () => {
      fireEvent.press(getByText("Buscar rota"));
    });

    expect(vibrationService.error).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "Localização de origem ausente",
      expect.any(String),
      expect.any(Array),
    );
  });

  it("exibe alerta quando o destino não tem coordenadas e usuário confirma", async () => {
    mockSingleDestNoCoords();

    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByText } = render(<ConfirmDestinationScreen />);

    await act(async () => {
      fireEvent.press(getByText("Buscar rota"));
    });

    expect(vibrationService.error).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "Localização não encontrada",
      expect.any(String),
      expect.any(Array),
    );
  });

  it("navega para /escolher-horario quando origem e destino têm coordenadas válidas", async () => {
    mockSingleDestWithCoords();

    const { getByText } = render(<ConfirmDestinationScreen />);

    await act(async () => {
      fireEvent.press(getByText("Buscar rota"));
    });

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/escolher-horario" }),
      );
    });
  });

  it("navega para /escolher-horario com os params corretos do destino", async () => {
    mockSingleDestWithCoords();

    const { getByText } = render(<ConfirmDestinationScreen />);

    await act(async () => {
      fireEvent.press(getByText("Buscar rota"));
    });

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/escolher-horario",
          params: expect.objectContaining({
            destination: "Terminal Central",
            destinationLat: "-19.74",
            destinationLng: "-47.93",
            sessionId: "sess-001",
          }),
        }),
      );
    });
  });

  // ── Ajuda ────────────────────────────────────────────────────────────────────

  it("navega para /ajuda ao tocar em Ajuda", () => {
    const { getByText } = render(<ConfirmDestinationScreen />);
    fireEvent.press(getByText("Ajuda"));
    expect(router.push).toHaveBeenCalledWith("/ajuda");
  });

  // ── Formatação de endereço ────────────────────────────────────────────────────

  describe("formatação de endereço (getAddressDetails)", () => {
    it("exibe as primeiras duas partes do endereço como texto principal", () => {
      mockParseJsonParam.mockImplementation((_p: any, fallback: any) => {
        if (fallback === null) {
          return {
            items: [{
              id: "1",
              name: "Hospital de Clínicas",
              address: "Av. Getúlio Guaritá, s/n, Uberaba, MG",
              lat: -19.74,
              lng: -47.93,
            }],
          };
        }
        return fallback;
      });

      const { getByText, getAllByText } = render(<ConfirmDestinationScreen />);
      expect(getAllByText("Hospital de Clínicas").length).toBeGreaterThan(0);
      expect(getByText("Av. Getúlio Guaritá, s/n")).toBeTruthy();
    });

    it("exibe cidade padrão 'Uberaba - MG' quando o param city não é informado", () => {
      setParams({ ...PARAMS_BASE, city: "" });
      mockSingleDestWithCoords();
      const { getAllByText } = render(<ConfirmDestinationScreen />);
      // city cai pro fallback "Uberaba - MG"
      expect(getAllByText("Uberaba - MG").length).toBeGreaterThan(0);
    });
  });

  // ── Validação de coordenadas ──────────────────────────────────────────────────

  describe("validação de coordenadas (parseRequiredCoordinate)", () => {
    it("trata string 'null' como ausente e mostra alerta de origem", async () => {
      setParams({ ...PARAMS_BASE, latitude: "null", longitude: "null" });
      mockSingleDestWithCoords();

      const alertSpy = jest.spyOn(Alert, "alert");
      const { getByText } = render(<ConfirmDestinationScreen />);

      await act(async () => {
        fireEvent.press(getByText("Buscar rota"));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        "Localização de origem ausente",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("trata string 'undefined' como ausente e mostra alerta de origem", async () => {
      setParams({ ...PARAMS_BASE, latitude: "undefined", longitude: "undefined" });
      mockSingleDestWithCoords();

      const alertSpy = jest.spyOn(Alert, "alert");
      const { getByText } = render(<ConfirmDestinationScreen />);

      await act(async () => {
        fireEvent.press(getByText("Buscar rota"));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        "Localização de origem ausente",
        expect.any(String),
        expect.any(Array),
      );
    });
  });
});
