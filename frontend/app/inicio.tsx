import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  FadeInUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "../src/components/ScreenContainer";
import {
  useVoiceConversationLoop,
} from "../src/hooks/useVoiceConversationLoop";
import type { VoiceLoopStatus } from "../src/hooks/useVoiceConversationLoop";
import { sessionService } from "../src/services/session.service";
import { journeyService } from "../src/services/journey.service";
import { locationService } from "../src/services/location.service";
import { vibrationService } from "../src/services/vibration.service";
import {
  stopListening,
} from "../src/services/speech.service";
import { useThemeColors } from "../src/theme/colors";
import { cleanVoiceTranscript } from "../src/utils/helpers";
import type { VoiceIntent } from "../src/utils/voiceIntentParser";
import type { DestinationOption, ResolveDestinationResponse } from "../src/types/journey.types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ScreenStatus = "idle" | "listening" | "processing" | "error" | "success";
type VoiceScreenStatus = ScreenStatus | "speaking";

function isValidCoordinate(value: string) {
  return value.trim().length > 0 && Number.isFinite(Number(value));
}

function normalizeDestinationOptions(response: ResolveDestinationResponse): DestinationOption[] {
  const resolvedOptions: DestinationOption[] = [];

  if (response.resolvedDestination) {
    resolvedOptions.push(response.resolvedDestination);
  }

  if (response.candidates && response.candidates.length > 0) {
    resolvedOptions.push(...response.candidates);
  }

  if (resolvedOptions.length > 0) {
    return resolvedOptions;
  }

  if (!response.options || response.options.length === 0) {
    return [];
  }

  const firstOption = response.options[0] as unknown;
  if (typeof firstOption === "object" && firstOption !== null) {
    return response.options as DestinationOption[];
  }

  return response.options.map((option, index) => ({
    id: String(index),
    name: String(option),
    address: response.displayData?.items?.[index]?.address || "",
    lat: Number.NaN,
    lng: Number.NaN,
    source: "LEGACY_FALLBACK",
  }));
}

const BlinkingCursor = () => {
  const theme = useThemeColors();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0, { duration: 500 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    width: 2,
    height: 24,
    backgroundColor: theme.primary,
    marginLeft: 2,
  }));

  return <Animated.View style={style} />;
};

/**
 * A HomeScreen é o centro principal do aplicativo (Dashboard).
 * Ela gerencia o estado da assistente virtual (Ouvindo, Processando, etc) 
 * e coordena a interação por voz.
 */

export default function HomeScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();

  // Coordenadas passadas por parâmetro ou obtidas do serviço de localização
  const [originCoords, setOriginCoords] = useState({
    latitude: String(params.latitude || ""),
    longitude: String(params.longitude || ""),
  });
  const latitude = originCoords.latitude;
  const longitude = originCoords.longitude;

  /**
   * Máquina de Estados da Assistente:
   * - 'idle': Aguardando o usuário tocar no microfone.
   * - 'listening': Microfone aberto capturando a fala.
   * - 'processing': Enviando o texto para o backend para entender o destino.
   * - 'error': Algum erro na escuta ou no processamento.
   * - 'success': Destino encontrado e pronto para navegar.
   */
  const [status, setStatus] = useState<VoiceScreenStatus>("idle");
  const [transcript, setTranscript] = useState(""); // Texto que aparece enquanto o usuário fala
  const [userName, setUserName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const lastHandledSearchTextRef = useRef<string | null>(null);

  // Valores de animação para o "pulsar" do microfone e a expansão do painel
  const micPulse = useSharedValue(1);
  const panelTransition = useSharedValue(0);

  const getOriginCoords = useCallback(async () => {
    if (isValidCoordinate(originCoords.latitude) && isValidCoordinate(originCoords.longitude)) {
      return originCoords;
    }

    const currentLocation = await locationService.getCurrentLocation();
    const nextOrigin = {
      latitude: String(currentLocation.latitude),
      longitude: String(currentLocation.longitude),
    };
    setOriginCoords(nextOrigin);
    return nextOrigin;
  }, [originCoords]);

  /**
   * Envia o texto para o Backend para geocodificação e busca de rotas.
   */
  const processTranscription = useCallback(async (text: string) => {
    setStatus("processing");
    setErrorMessage("");
    try {
      // Limpa a sessão conversacional anterior ao iniciar novo diálogo de busca
      sessionService.clearSessionId();

      const origin = await getOriginCoords();

      const response = await journeyService.resolveDestination({
        text,
        origin: {
          lat: Number(origin.latitude),
          lng: Number(origin.longitude),
        },
      });

      const resolvedOptions = normalizeDestinationOptions(response);

      if (resolvedOptions.length > 0) {
        setStatus("success");
        // Se encontrou opções, navega para a tela de confirmação de destino
        if (response.mode === "resolved" || response.mode === "suggestions") {
          const bestOption = resolvedOptions[0];
          vibrationService.success();
          router.push({
            pathname: "/confirmar-destino",
            params: {
              latitude: origin.latitude,
              longitude: origin.longitude,
              destination: bestOption?.name || response.interpretedDestination,
              address: bestOption?.address || "",
              confirmationQuestion: response.voice?.confirmationQuestion || response.message,
              options: JSON.stringify(resolvedOptions),
              mode: response.mode,
              message: response.message,
              // --- Novos campos conversacionais ---
              speechText: response.speechText || "",
              screen: response.screen || "",
              displayData: response.displayData ? JSON.stringify(response.displayData) : "",
              expectedInput: response.expectedInput || "",
              conversationState: response.conversationState || "",
              actions: response.actions ? JSON.stringify(response.actions) : "",
              sessionId: response.metadata?.sessionId || "",
              voiceMode: "true",
            },
          });
        } else {
          setStatus("error");
          setErrorMessage(response.message || "Não encontrei esse lugar. Tente falar de forma diferente.");
          vibrationService.error();
        }
      } else {
        setStatus("error");
        setErrorMessage("Não encontrei esse lugar. Tente falar de forma diferente.");
        vibrationService.error();
      }
    } catch (err) {
      console.error("Erro ao processar destino:", err);
      setStatus("error");
      setErrorMessage("Erro ao buscar destino. Verifique sua conexão.");
      vibrationService.error();
    }
  }, [getOriginCoords]);

  /**
   * Loop de voz orquestrado.
   * Substitui a lógica manual anterior para garantir o fluxo Fala -> Escuta.
   */
  const handleIntent = useCallback((intent: VoiceIntent) => {
    if (intent.type === "DESTINATION_TEXT") {
      const cleanedText = cleanVoiceTranscript(intent.text);
      setTranscript(cleanedText || intent.text);
      void processTranscription(cleanedText || intent.text);
      return;
    }

    if (intent.type === "CANCEL") {
      setStatus("idle");
      setTranscript("");
      setErrorMessage("");
    }
  }, [processTranscription]);

  const handleLoopStatusChange = useCallback((loopStatus: VoiceLoopStatus) => {
    if (loopStatus === "error") {
      setErrorMessage("Não consegui te ouvir. Pode tentar novamente.");
      setStatus("error");
      return;
    }

    if (loopStatus === "speaking") {
      setErrorMessage("");
      setStatus("speaking");
      return;
    }

    if (loopStatus === "listening") {
      setErrorMessage("");
      setStatus("listening");
      return;
    }

    if (loopStatus === "processing") {
      setErrorMessage("");
      setStatus("processing");
      return;
    }

    if (loopStatus === "idle" || loopStatus === "stopped") {
      setStatus("idle");
    }
  }, []);

  const handleLoopTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  const { startLoop, stopAll } = useVoiceConversationLoop({
    onIntent: handleIntent,
    onStatusChange: handleLoopStatusChange,
    onTranscript: handleLoopTranscript,
  });

  useEffect(() => {
    const nextLatitude = String(params.latitude || "");
    const nextLongitude = String(params.longitude || "");

    if (nextLatitude || nextLongitude) {
      setOriginCoords({
        latitude: nextLatitude,
        longitude: nextLongitude,
      });
    }
  }, [params.latitude, params.longitude]);

  useEffect(() => {
    if (isValidCoordinate(latitude) && isValidCoordinate(longitude)) {
      return;
    }

    let isMounted = true;

    async function loadOrigin() {
      try {
        const currentLocation = await locationService.getCurrentLocation();
        if (!isMounted) {
          return;
        }

        setOriginCoords({
          latitude: String(currentLocation.latitude),
          longitude: String(currentLocation.longitude),
        });
      } catch (error) {
        console.log("[inicio] Erro ao obter localização de origem:", error);
      }
    }

    void loadOrigin();

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        await sessionService.restoreSessionId();
      } catch (error) {
        console.log("[inicio] Erro ao recuperar sessionId:", error);
      }

      const user = await sessionService.getUser();
      const first = user?.name ? user.name.split(" ")[0] : "";

      if (isMounted && first) {
        setUserName(first);
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!params.searchText) {
      return;
    }

    const text = String(params.searchText);
    if (!text || lastHandledSearchTextRef.current === text) {
      return;
    }

    lastHandledSearchTextRef.current = text;
    setTranscript(text);
    setErrorMessage("");
    void processTranscription(text);
  }, [params.searchText, processTranscription]);

  useFocusEffect(
    useCallback(() => {
      if (!params.searchText && userName) {
        setTranscript("");
        setErrorMessage("");
        void startLoop(`Olá, ${userName}. Para onde você quer ir hoje?`);
      }

      return () => {
        void stopAll();
        lastHandledSearchTextRef.current = null;
        setStatus("idle");
        setTranscript("");
        setErrorMessage("");
      };
    }, [params.searchText, startLoop, stopAll, userName]),
  );

  const isVoicePanelVisible = status === "listening" || status === "processing";

  /**
   * Este useEffect controla as animações baseadas no status da assistente.
   */
  useEffect(() => {
    const transitionConfig = {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    };

    if (status === "listening") {
      micPulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 800 }),
          withTiming(1, { duration: 800 }),
        ),
        -1,
        true,
      );
      panelTransition.value = withTiming(1, transitionConfig);
    } else if (status === "processing") {
      micPulse.value = withTiming(1);
      panelTransition.value = withTiming(1, transitionConfig);
    } else {
      micPulse.value = withTiming(1);
      panelTransition.value = withTiming(0, transitionConfig);
    }
  }, [status, micPulse, panelTransition]);

  const micPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micPulse.value }],
    opacity: interpolate(micPulse.value, [1, 1.2], [1, 0.4]),
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(panelTransition.value, [0, 1], [88, 300]),
    borderRadius: interpolate(panelTransition.value, [0, 1], [44, 32]),
  }));

  const idleContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(panelTransition.value, [0, 0.15], [1, 0]),
    transform: [
      { scale: interpolate(panelTransition.value, [0, 0.15], [1, 0.9]) },
    ],
  }));

  const expandedContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(panelTransition.value, [0.85, 1], [0, 1]),
    transform: [
      { translateY: interpolate(panelTransition.value, [0.85, 1], [10, 0]) },
    ],
  }));

  const bentoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(panelTransition.value, [0, 1], [0, -120]),
      },
    ],
    opacity: interpolate(panelTransition.value, [0, 0.5], [1, 0.6]),
  }));

  /**
   * Gerencia o clique no botão de microfone (Toggle entre Iniciar e Parar).
   */
  async function handleMicPress() {
    vibrationService.light();
    if (status === "idle" || status === "error" || status === "speaking") {
      setTranscript("");
      setErrorMessage("");
      void startLoop();
    } else if (status === "listening") {
      stopListening();
    }
  }

  async function handleTypeDestination() {
    vibrationService.light();
    void stopAll();
    const origin = await getOriginCoords();

    // Pequeno delay para garantir que o TTS ou escuta parem antes da navegação
    setTimeout(() => {
      router.push({
        pathname: "/digitar-destino",
        params: { latitude: origin.latitude, longitude: origin.longitude },
      });
    }, 100);
  }

  async function handleHelp() {
    vibrationService.light();
    void stopAll();
    const origin = await getOriginCoords();
    router.push({
      pathname: "/ajuda",
      params: { latitude: origin.latitude, longitude: origin.longitude },
    });
  }

  function handleSettings() {
    vibrationService.light();
    void stopAll();
    router.push("/configuracoes");
  }

  return (
    <ScreenContainer withPadding={false} style={{ backgroundColor: "#F6F8FA" }}>
      {/* TOP HEADER */}
      <View
        style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16) }]}
      >
        <Pressable
          style={styles.headerIconButton}
          onPress={handleHelp}
          accessibilityLabel="Ajuda"
          accessibilityRole="button"
        >
          <Ionicons name="help-circle" size={30} color="#000" />
        </Pressable>

        <Pressable
          style={styles.headerIconButton}
          onPress={handleSettings}
          accessibilityLabel="Configurações"
          accessibilityRole="button"
        >
          <Ionicons name="settings" size={30} color="#000" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInUp.delay(100).duration(600)}
          style={[styles.bentoContainer, bentoAnimatedStyle]}
        >
          {/* GREETING CARD */}
          <View
            style={styles.greetingCard}
            accessible={true}
            accessibilityRole="header"
          >
            <Text style={styles.greetingText}>
              Olá, {userName || "Douglas"}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.mainTitle}>Para onde você quer ir hoje?</Text>
          </View>

          {/* INSTRUCTION CARD */}
          <View
            style={styles.instructionCard}
            accessible={true}
            accessibilityLabel="Me diga o endereço ou o lugar para onde você quer ir."
          >
            <View
              style={[styles.iconBox, { backgroundColor: theme.primaryLight }]}
            >
              <Ionicons name="location" size={24} color={theme.primary} />
            </View>
            <Text style={styles.instructionText}>
              Me diga o endereço ou o lugar para onde você quer ir.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* FLOATING ACTION BAR */}
      <View
        style={[
          styles.bottomContainer,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
      >
        {status === "error" && !!errorMessage && (
          <View style={styles.inlineErrorBanner} pointerEvents="none">
            <Text style={styles.inlineErrorText}>{errorMessage}</Text>
          </View>
        )}

        <Animated.View style={[styles.actionPill, containerAnimatedStyle]}>
          {/* IDLE STATE */}
          <Animated.View
            style={[styles.idleRow, idleContentStyle]}
            pointerEvents={isVoicePanelVisible ? "none" : "auto"}
          >
            <Pressable
              style={styles.actionButton}
              onPress={handleTypeDestination}
              accessibilityLabel="Digitar destino"
              accessibilityRole="button"
            >
              <Ionicons name="pencil" size={22} color="#011030" />
              <Text style={styles.actionText}>Digitar destino</Text>
            </Pressable>

            <View style={styles.verticalDivider} />

            <Pressable
              style={[
                styles.actionButton,
                styles.primaryActionButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={handleMicPress}
              accessibilityLabel="Falar destino"
              accessibilityRole="button"
            >
              <Ionicons name="mic" size={24} color="white" />
              <Text style={[styles.actionText, styles.primaryActionText]}>
                Falar destino
              </Text>
            </Pressable>
          </Animated.View>

          {/* EXPANDED STATE */}
          <Animated.View
            style={[
              styles.expandedContent,
              expandedContentStyle,
              { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
            ]}
            pointerEvents={isVoicePanelVisible ? "auto" : "none"}
          >
            <View style={styles.expandedTextContainer}>
              <ScrollView contentContainerStyle={styles.transcriptScroll}>
                <View
                  style={styles.transcriptContainer}
                  accessible={true}
                  accessibilityLabel={
                    transcript ||
                    (status === "listening"
                      ? "Estou ouvindo..."
                      : "Entendendo...")
                  }
                  accessibilityLiveRegion="polite"
                >
                  <Text style={styles.transcriptText}>
                    {transcript ||
                      (status === "listening"
                        ? "Estou ouvindo..."
                        : "Entendendo...")}
                  </Text>
                  {status === "listening" && <BlinkingCursor />}
                </View>
              </ScrollView>
            </View>

            <View style={styles.expandedBottomRow}>
              <Pressable
                onPress={() => {
                  vibrationService.light();
                  stopAll();
                  setStatus("idle");
                  setTranscript("");
                  setErrorMessage("");
                }}
                style={styles.closeIcon}
                accessibilityLabel="Cancelar e fechar painel"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={36} color="#CCC" />
              </Pressable>

              <View style={styles.statusIndicator}>
                {status === "processing" && (
                  <ActivityIndicator size="small" color={theme.primary} />
                )}
                <Text style={[styles.statusMiniText, { color: theme.primary }]}>
                  {status === "listening"
                    ? "Ouvindo"
                    : status === "processing"
                      ? "Processando"
                      : ""}
                </Text>
              </View>

              <View style={styles.micWrapper}>
                {status === "listening" && (
                  <Animated.View
                    style={[
                      styles.micPulse,
                      { backgroundColor: theme.primary },
                      micPulseStyle,
                    ]}
                  />
                )}
                <Pressable
                  style={[
                    styles.micButtonActive,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={handleMicPress}
                  accessibilityLabel={
                    status === "listening"
                      ? "Concluir fala e buscar"
                      : "Falar destino"
                  }
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={status === "listening" ? "checkmark" : "mic"}
                    size={32}
                    color="white"
                  />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: "#F6F8FA",
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
    paddingBottom: 100, // Ajuste para não colidir com a barra inferior
  },
  bentoContainer: {
    gap: 16,
    marginTop: -40, // Pequeno offset para cima para centralização visual melhor
  },
  greetingCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    opacity: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 16,
    width: 40,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#000",
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  instructionCard: {
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#444",
    lineHeight: 22,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  inlineErrorBanner: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    maxWidth: SCREEN_WIDTH - 40,
  },
  inlineErrorText: {
    color: "#9F1239",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  actionPill: {
    width: SCREEN_WIDTH - 24,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  idleRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 88,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 10,
    borderRadius: 36,
  },
  primaryActionButton: {
    // Background color set via theme.primary in JSX
  },
  actionText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#011030",
    letterSpacing: -0.3,
  },
  primaryActionText: {
    color: "white",
  },
  verticalDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 4,
  },
  expandedContent: {
    padding: 24,
    justifyContent: "space-between",
  },
  expandedTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  transcriptScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  transcriptContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  transcriptText: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    color: "#000",
    lineHeight: 36,
  },
  expandedBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  closeIcon: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusMiniText: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  micWrapper: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  micPulse: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    zIndex: 1,
  },
  errorContainer: {
    alignItems: "center",
    gap: 16,
  },
  errorMessage: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "800",
  },
});
