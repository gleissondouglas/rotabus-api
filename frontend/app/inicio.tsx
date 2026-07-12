import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "../src/components/ScreenContainer";
import {
  useVoiceConversationLoop,
} from "../src/hooks/useVoiceConversationLoop";
import type {
  VoiceLoopStatus,
  VoiceRecognitionIssue,
} from "../src/hooks/useVoiceConversationLoop";
import { sessionService } from "../src/services/session.service";
import { journeyService } from "../src/services/journey.service";
import { locationService } from "../src/services/location.service";
import { vibrationService } from "../src/services/vibration.service";
import { stopListening } from "../src/services/speech.service";
import { useThemeColors } from "../src/theme/colors";
import { cleanVoiceTranscript } from "../src/utils/helpers";
import {
  isLikelyNoiseTranscript,
  type VoiceIntent,
} from "../src/utils/voiceIntentParser";
import type {
  DestinationOption,
  ResolveDestinationResponse,
} from "../src/types/journey.types";
import { VoiceVisualizer, type VoiceVisualizerState } from "../src/components/VoiceVisualizer";
import { VoicePromptText } from "../src/components/VoicePromptText";
import { LiveTranscript } from "../src/components/LiveTranscript";
import { BottomActionBar } from "../src/components/BottomActionBar";

type ScreenStatus = "idle" | "listening" | "processing" | "error" | "success";
type VoiceScreenStatus = ScreenStatus | "speaking";

/** Mensagem de fallback quando o usuário não fala nada */
const SILENCE_FALLBACK_MESSAGE =
  "Não entendi, toque no microfone para falar.";

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

/**
 * Mapeia o status da tela para o estado do VoiceVisualizer.
 */
function toVisualizerState(status: VoiceScreenStatus): VoiceVisualizerState {
  if (status === "speaking") return "speaking";
  if (status === "listening") return "listening";
  if (status === "processing") return "processing";
  return "idle";
}

/**
 * A HomeScreen é o centro principal do aplicativo (Dashboard).
 * Layout voice-first com 3 zonas:
 *  1. Topo fixo: Ajuda + Configurações
 *  2. Centro: VoiceVisualizer + VoicePromptText + LiveTranscript
 *  3. Rodapé fixo: BottomActionBar
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
   * - 'speaking': Assistente está falando (TTS).
   * - 'listening': Microfone aberto capturando a fala.
   * - 'processing': Enviando o texto para o backend.
   * - 'error': Algum erro na escuta ou no processamento.
   * - 'success': Destino encontrado e pronto para navegar.
   */
  const [status, setStatus] = useState<VoiceScreenStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [userName, setUserName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isTranscriptFinal, setIsTranscriptFinal] = useState(false);
  /**
   * Controla se o texto da saudação deve animar progressivamente.
   * true = primeira vez (anima palavra por palavra)
   * false = retorno à tela (exibe completo de uma vez)
   */
  const [promptAnimated, setPromptAnimated] = useState(false);
  const [promptText, setPromptText] = useState("");

  const lastHandledSearchTextRef = useRef<string | null>(null);
  const voiceIssueMessageRef = useRef("");

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
    const destinationText = text.trim();

    if (!destinationText || isLikelyNoiseTranscript(destinationText)) {
      setStatus("error");
      setErrorMessage(
        destinationText
          ? `Entendi "${destinationText}", mas isso parece muito curto. Fale o destino novamente ou use a digitação.`
          : "Não consegui entender sua fala. Tente falar novamente ou digite o destino.",
      );
      vibrationService.error();
      return;
    }

    setStatus("processing");
    setErrorMessage("");
    try {
      // Limpa a sessão conversacional anterior ao iniciar novo diálogo de busca
      sessionService.clearSessionId?.();

      const origin = await getOriginCoords();

      const response = await journeyService.resolveDestination({
        text: destinationText,
        origin: {
          lat: Number(origin.latitude),
          lng: Number(origin.longitude),
        },
      });

      const resolvedOptions = normalizeDestinationOptions(response);

      if (resolvedOptions.length > 0) {
        setStatus("success");
        if (response.mode === "resolved" || response.mode === "suggestions") {
          const bestOption = resolvedOptions[0];
          vibrationService.success();
          router.push({
            pathname: "/confirmar-destino",
            params: {
              latitude: origin.latitude,
              longitude: origin.longitude,
              destination: bestOption?.name || response.interpretedDestination,
              recognizedText: destinationText,
              address: bestOption?.address || "",
              confirmationQuestion: response.voice?.confirmationQuestion || response.message,
              options: JSON.stringify(resolvedOptions),
              mode: response.mode,
              message: response.message,
              speechText: response.speechText || "",
              screen: response.screen || "",
              displayData: response.displayData ? JSON.stringify(response.displayData) : "",
              expectedInput: response.expectedInput || "",
              conversationState: response.conversationState || "",
              actions: response.actions ? JSON.stringify(response.actions) : "",
              sessionId: response.metadata?.sessionId || "",
              interactionMode: "voice",
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
   */
  const handleIntent = useCallback((intent: VoiceIntent) => {
    if (intent.type === "DESTINATION_TEXT") {
      const cleanedText = cleanVoiceTranscript(intent.text);
      setTranscript(cleanedText || intent.text);
      setIsTranscriptFinal(true);
      void processTranscription(cleanedText || intent.text);
      return;
    }

    if (intent.type === "CANCEL") {
      setStatus("idle");
      setTranscript("");
      setIsTranscriptFinal(false);
      setErrorMessage("");
      voiceIssueMessageRef.current = "";
    }
  }, [processTranscription]);

  const handleLoopStatusChange = useCallback((loopStatus: VoiceLoopStatus) => {
    if (loopStatus === "error") {
      setErrorMessage(
        voiceIssueMessageRef.current ||
          "Não consegui te ouvir. Pode tentar novamente.",
      );
      voiceIssueMessageRef.current = "";
      setStatus("error");
      return;
    }

    if (loopStatus === "speaking") {
      voiceIssueMessageRef.current = "";
      setErrorMessage("");
      setStatus("speaking");
      return;
    }

    if (loopStatus === "listening") {
      voiceIssueMessageRef.current = "";
      setErrorMessage("");
      setStatus("listening");
      return;
    }

    if (loopStatus === "processing") {
      voiceIssueMessageRef.current = "";
      setErrorMessage("");
      setStatus("processing");
      return;
    }

    if (loopStatus === "idle" || loopStatus === "stopped") {
      voiceIssueMessageRef.current = "";
      setStatus("idle");
    }
  }, []);

  const handleLoopTranscript = useCallback((text: string, isFinal: boolean) => {
    setTranscript(text);
    setIsTranscriptFinal(isFinal);
  }, []);

  const handleRecognitionIssue = useCallback((issue: VoiceRecognitionIssue) => {
    if ("transcript" in issue && issue.transcript) {
      setTranscript(issue.transcript);
      setIsTranscriptFinal(true);
    }

    // Quando é erro de silêncio (usuário não falou nada), usa a mensagem de fallback
    const isSilentError =
      issue.type === "EMPTY_TRANSCRIPT" || issue.type === "SPEECH_ERROR";

    voiceIssueMessageRef.current = isSilentError
      ? SILENCE_FALLBACK_MESSAGE
      : issue.message;
    setErrorMessage(isSilentError ? SILENCE_FALLBACK_MESSAGE : issue.message);
  }, []);

  const { startLoop, stopAll } = useVoiceConversationLoop({
    onIntent: handleIntent,
    onStatusChange: handleLoopStatusChange,
    onTranscript: handleLoopTranscript,
    onRecognitionIssue: handleRecognitionIssue,
    maxSilentRetries: 0,
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
    setIsTranscriptFinal(true);
    setErrorMessage("");
    void processTranscription(text);
  }, [params.searchText, processTranscription]);

  useFocusEffect(
    useCallback(() => {
      setStatus("idle");
      setTranscript("");
      setIsTranscriptFinal(false);
      setErrorMessage("");
      voiceIssueMessageRef.current = "";

      if (!params.searchText && userName) {
        // Primeira vez: texto anima progressivamente
        setPromptAnimated(true);
        const greetingText = `Olá, ${userName}. Bem-vindo ao Nuvem. Para onde você quer ir hoje?`;
        setPromptText(greetingText);
      } else if (userName) {
        // Retorno à tela: texto aparece completo de uma vez
        setPromptAnimated(false);
        setPromptText(`Para onde você quer ir hoje?`);
      }

      return () => {
        void stopAll();
        lastHandledSearchTextRef.current = null;
      };
    }, [params.searchText, stopAll, userName]),
  );

  // Atualiza o texto de boas-vindas quando o nome do usuário carrega (após o useFocusEffect inicial)
  useEffect(() => {
    if (!userName || promptText) return;
    setPromptAnimated(false);
    setPromptText("Para onde você quer ir hoje?");
  }, [userName, promptText]);

  /**
   * Gerencia o microfone no estilo pressionar e segurar.
   */
  function handleMicPressIn() {
    if (status === "listening" || status === "processing" || status === "speaking") {
      return;
    }

    vibrationService.light();
    setTranscript("");
    setIsTranscriptFinal(false);
    setErrorMessage("");
    voiceIssueMessageRef.current = "";
    void startLoop();
  }

  function handleMicPressOut() {
    if (status === "listening") {
      stopListening();
    }
  }

  function getMicActionLabel() {
    if (status === "speaking") {
      return "Aguarde";
    }

    if (status === "listening") {
      return "Estou ouvindo";
    }

    if (status === "processing") {
      return "Entendendo";
    }

    if (status === "error") {
      return "Tentar de novo";
    }

    return "Falar destino";
  }

  async function handleTypeDestination() {
    vibrationService.light();
    void stopAll();
    const origin = await getOriginCoords();

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

  /** Mostra transcrição na área central quando está ouvindo ou processando */
  const showLiveTranscript =
    (status === "listening" || status === "processing") && !!transcript;

  /** Mostra transcrição de erro (texto entendido mas rejeitado) */
  const showErrorTranscript = status === "error" && !!transcript && !!errorMessage;
  const showUserMessage = showLiveTranscript || showErrorTranscript;

  return (
    <ScreenContainer withPadding={false} style={{ backgroundColor: "#F6F8FA" }}>
      {/* ─── ZONA 1: TOPO ─── */}
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

      {/* ─── ZONA 2: CENTRO ─── */}
      <View style={styles.centerZone} pointerEvents="none">

        {/* Barrinhas de áudio animadas */}
        <VoiceVisualizer state={toVisualizerState(status)} size="large" />

        <View style={styles.conversationStack}>
          {/* Mensagem da assistente */}
          {!!promptText && (
            <Animated.View
              entering={FadeIn.duration(250)}
              style={styles.assistantMessage}
            >
              <Text style={styles.messageLabel}>Assistente</Text>
              <View style={styles.assistantBubble}>
                <VoicePromptText
                  text={promptText}
                  animated={promptAnimated && status === "speaking"}
                  align="left"
                  style={styles.promptTextWrapper}
                  textStyle={styles.assistantPromptText}
                />
              </View>
            </Animated.View>
          )}

          {/* Mensagem do usuário */}
          {showUserMessage && (
            <Animated.View
              entering={FadeIn.duration(250)}
              style={styles.userMessage}
            >
              <Text style={styles.userMessageLabel}>Você</Text>
              <View style={[styles.userBubble, { backgroundColor: theme.primary }]}>
                <LiveTranscript
                  transcript={transcript}
                  isFinal={isTranscriptFinal || showErrorTranscript}
                  variant="conversation"
                />
              </View>
            </Animated.View>
          )}
        </View>

        {/* Banner de erro / fallback */}
        {status === "error" && !!errorMessage && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.errorBanner}
            pointerEvents="none"
            accessible
            accessibilityLiveRegion="assertive"
          >
            <Ionicons name="alert-circle" size={16} color="#9F1239" style={styles.errorIcon} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </Animated.View>
        )}
      </View>

      {/* ─── ZONA 3: BARRA INFERIOR FIXA ─── */}
      <View
        style={[
          styles.bottomContainer,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        pointerEvents="box-none"
      >
        <BottomActionBar
          status={status}
          micLabel={getMicActionLabel()}
          onTypeDestination={handleTypeDestination}
          onMicPressIn={handleMicPressIn}
          onMicPressOut={handleMicPressOut}
        />
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
    zIndex: 10,
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
  // Zona central: flex-grow ocupa todo o espaço entre topo e rodapé
  centerZone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
    paddingHorizontal: 16,
    paddingBottom: 120, // Espaço para não colidir com a barra inferior
  },
  conversationStack: {
    width: "100%",
    maxWidth: 380,
    gap: 18,
  },
  assistantMessage: {
    alignSelf: "flex-start",
    maxWidth: "92%",
  },
  userMessage: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    alignItems: "flex-end",
  },
  messageLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  userMessageLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    marginRight: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  assistantBubble: {
    backgroundColor: "white",
    borderRadius: 26,
    borderTopLeftRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  userBubble: {
    borderRadius: 26,
    borderTopRightRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  promptTextWrapper: {
    paddingHorizontal: 0,
  },
  assistantPromptText: {
    color: "#011030",
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    maxWidth: "90%",
  },
  errorIcon: {
    flexShrink: 0,
  },
  errorText: {
    color: "#9F1239",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
    lineHeight: 20,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
