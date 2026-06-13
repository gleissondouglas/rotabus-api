import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useEffect, useRef, useState, useCallback } from "react";
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
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";
import { sessionService } from "../src/services/session.service";
import { journeyService } from "../src/services/journey.service";
import { vibrationService } from "../src/services/vibration.service";
import {
  stopSpeaking,
  startListening,
  stopListening,
  isSpeechRecognitionAvailable,
  speak,
} from "../src/services/speech.service";
import { useThemeColors } from "../src/theme/colors";
import { cleanVoiceTranscript } from "../src/utils/helpers";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ScreenStatus = "idle" | "listening" | "processing" | "error" | "success";

const BlinkingCursor = () => {
  const theme = useThemeColors();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0, { duration: 500 }), -1, true);
  }, []);

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
  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");

  /**
   * Máquina de Estados da Assistente:
   * - 'idle': Aguardando o usuário tocar no microfone.
   * - 'listening': Microfone aberto capturando a fala.
   * - 'processing': Enviando o texto para o backend para entender o destino.
   * - 'error': Algum erro na escuta ou no processamento.
   * - 'success': Destino encontrado e pronto para navegar.
   */
  const [status, setStatus] = useState<ScreenStatus>("idle");
  const [transcript, setTranscript] = useState(""); // Texto que aparece enquanto o usuário fala
  const [userName, setUserName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Valores de animação para o "pulsar" do microfone e a expansão do painel
  const micPulse = useSharedValue(1);
  const panelTransition = useSharedValue(0);

  // Refs são usadas para manter valores que não devem disparar renderização imediata, 
  // mas precisam persistir entre ciclos de render.
  const isListeningRef = useRef(false);
  const retryCountRef = useRef(0);
  const currentTranscriptRef = useRef("");
  const accumulatedPartsRef = useRef<string[]>([]);
  const restartTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // Carrega o nome do usuário salvo na sessão
    async function loadUser() {
      const user = await sessionService.getUser();
      if (user?.name) {
        setUserName(user.name.split(" ")[0]); // Pega apenas o primeiro nome
      }
    }
    loadUser();

    return () => {
      // Limpeza ao sair da tela
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      stopListening();
    };
  }, []);

  /**
   * useFocusEffect: Garante que toda vez que a tela ganhar foco (voltar para ela),
   * o estado seja resetado para 'idle'.
   */
  useFocusEffect(
    useCallback(() => {
      setStatus("idle");
      isListeningRef.current = false;
      setTranscript("");
      setErrorMessage("");
      stopListening();

      return () => {
        isListeningRef.current = false;
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        stopListening();
      };
    }, []),
  );

  /**
   * Este useEffect controla as animações baseadas no status da assistente.
   * Quando 'listening', o microfone pulsa infinitamente.
   * Quando sai de 'idle', o painel inferior expande suavemente.
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
    } else if (status === "processing" || status === "error") {
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
    pointerEvents: panelTransition.value > 0.1 ? "none" : "auto",
  }));

  const expandedContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(panelTransition.value, [0.85, 1], [0, 1]),
    transform: [
      { translateY: interpolate(panelTransition.value, [0.85, 1], [10, 0]) },
    ],
    pointerEvents: panelTransition.value < 0.9 ? "none" : "auto",
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
   * Inicia uma sessão de reconhecimento de fala.
   * Utiliza callbacks para tratar o início, os resultados parciais e erros.
   */
  async function initiateListeningSession() {
    if (!isListeningRef.current) return;

    await startListening({
      onStart: () => {
        setStatus("listening");
        vibrationService.medium(); // Feedback tátil ao começar a ouvir
      },
      onResult: (text, isFinal) => {
        currentTranscriptRef.current = text;
        // Combina partes já confirmadas com a parte que o usuário está falando agora
        const fullVisibleText = [...accumulatedPartsRef.current, text]
          .join(" ")
          .trim();
        setTranscript(fullVisibleText);

        if (isFinal) {
          // Quando o SO confirma que uma frase terminou, salvamos no acumulador
          accumulatedPartsRef.current.push(text);
          currentTranscriptRef.current = "";
          vibrationService.selection();
          retryCountRef.current = 0;
        }
      },
      onError: async (err: any) => {
        const isSilent = err.isSilentError || err.error === "no-speech";
        
        if (isSilent) {
          console.log("[SpeechService] Silêncio detectado (no-speech).");
          
          // Se o usuário não falou nada, tentamos incentivar a fala uma vez antes de desistir
          if (retryCountRef.current < 1) {
            retryCountRef.current++;
            vibrationService.light();
            
            // Avisa o usuário por voz e tenta de novo automaticamente
            await speak("Não consegui te ouvir. Para onde você quer ir?");
            
            // Pequeno delay para começar a ouvir após a fala terminar
            restartTimeoutRef.current = setTimeout(() => {
              if (isListeningRef.current) initiateListeningSession();
            }, 500);
            return;
          }
        } else {
          console.warn("[SpeechService] Erro na escuta:", err);
        }
        
        isListeningRef.current = false;
        setStatus("error");
        setErrorMessage(
          err.message || "Não ouvi seu destino. Tente falar novamente."
        );
        vibrationService.error();
      },
      onEnd: () => {
        console.log("[HomeScreen] Fim da sessão de escuta.");
        isListeningRef.current = false;
        // Se a sessão acabou mas não foi por erro ou processamento manual, volta ao idle
        setStatus((current) => current === "listening" ? "idle" : current);
      },
    });
  }

  /**
   * Prepara o estado do app para começar a gravar.
   */
  async function startRecording() {
    if (status === "processing") return;

    await stopSpeaking(); // Para qualquer fala anterior da assistente

    isListeningRef.current = true;
    accumulatedPartsRef.current = [];
    currentTranscriptRef.current = "";
    setTranscript("");
    setErrorMessage("");
    setStatus("listening");

    // Verifica se o dispositivo tem suporte a reconhecimento de voz
    if (!isSpeechRecognitionAvailable()) {
      setErrorMessage("Recurso de voz indisponível no dispositivo.");
      setStatus("error");
      isListeningRef.current = false;
      vibrationService.error();
      return;
    }

    initiateListeningSession();
  }

  /**
   * Para a gravação e inicia o processamento do texto final.
   */
  async function stopAndProcess() {
    isListeningRef.current = false;
    retryCountRef.current = 0;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

    stopListening();
    vibrationService.medium();

    // Consolida todas as partes faladas em uma única string
    const finalParts = [...accumulatedPartsRef.current];
    if (currentTranscriptRef.current.trim()) {
      finalParts.push(currentTranscriptRef.current.trim());
    }
    const finalText = Array.from(new Set(finalParts))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // Limpa comandos comuns (ex: "Quero ir para...") para focar no nome do lugar
    const cleanedText = cleanVoiceTranscript(finalText);
    setTranscript(cleanedText || finalText);

    if (cleanedText || finalText) {
      processTranscription(cleanedText || finalText);
    } else {
      setStatus("error");
      setErrorMessage("Não ouvi seu destino. Tente falar novamente.");
      vibrationService.error();
    }
  }

  /**
   * Gerencia o clique no botão de microfone (Toggle entre Iniciar e Parar).
   */
  async function handleMicPress() {
    vibrationService.light();
    if (status === "idle" || status === "error") {
      retryCountRef.current = 0;
      startRecording();
    } else if (status === "listening") {
      stopAndProcess();
    }
  }

  /**
   * Envia o texto para o Backend para geocodificação e busca de rotas.
   */
  async function processTranscription(text: string) {
    setStatus("processing");
    try {
      // Limpa a sessão conversacional anterior ao iniciar novo diálogo de busca
      sessionService.clearSessionId();

      const response = await journeyService.resolveDestination({
        text,
        origin: {
          lat: Number(latitude),
          lng: Number(longitude),
        },
      });

      if (response.options.length > 0) {
        setStatus("success");
        // Se encontrou opções, navega para a tela de confirmação de destino
        if (response.mode === "resolved" || response.mode === "suggestions") {
          const bestOption = response.options[0];
          vibrationService.success();
          router.push({
            pathname: "/confirmar-destino",
            params: {
              latitude,
              longitude,
              destination: bestOption?.name || response.interpretedDestination,
              address: bestOption?.address || "",
              confirmationQuestion: response.voice?.confirmationQuestion || response.message,
              options: JSON.stringify(response.options),
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
            },
          });
        } else {
          setStatus("error");
          setErrorMessage(response.message || "Não encontrei esse lugar. Tente falar de forma diferente.");
          vibrationService.error();
        }
      }
    } catch (err) {
      console.error("Erro ao processar destino:", err);
      setStatus("error");
      setErrorMessage("Erro ao buscar destino. Verifique sua conexão.");
      vibrationService.error();
    }
  }

  function handleTypeDestination() {
    vibrationService.light();
    if (status === "listening") stopAndProcess();

    // Pequeno delay para garantir que o TTS ou escuta parem antes da navegação
    setTimeout(() => {
      router.push({
        pathname: "/digitar-destino",
        params: { latitude, longitude },
      });
    }, 100);
  }

  function handleHelp() {
    vibrationService.light();
    if (status === "listening") stopAndProcess();
    router.push({
      pathname: "/ajuda",
      params: { latitude, longitude },
    });
  }

  function handleSettings() {
    vibrationService.light();
    if (status === "listening") stopAndProcess();
    router.push("/configuracoes");
  }

  const welcomeMessage = userName
    ? `Olá, ${userName}. Para onde você quer ir hoje? Me diga o endereço ou o lugar para onde você quer ir.`
    : "Olá. Para onde você quer ir hoje? me diga o endereço ou o lugar para onde você quer ir.";

  useAutoSpeakOnce("home-greeting", status === "idle" ? welcomeMessage : "");

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
        <Animated.View style={[styles.actionPill, containerAnimatedStyle]}>
          {/* IDLE STATE */}
          <Animated.View style={[styles.idleRow, idleContentStyle]}>
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
          >
            <View style={styles.expandedTextContainer}>
              {status === "error" ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorMessage}>
                    {errorMessage || "Não ouvi bem..."}
                  </Text>
                  <Pressable
                    style={[
                      styles.retryButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      vibrationService.light();
                      setStatus("idle");
                    }}
                    accessibilityLabel="Tentar falar novamente"
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryButtonText}>Tentar de novo</Text>
                  </Pressable>
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.transcriptScroll}>
                  <View
                    style={styles.transcriptContainer}
                    accessible={true}
                    accessibilityLabel={transcript || "Ouvindo seu destino..."}
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
              )}
            </View>

            <View style={styles.expandedBottomRow}>
              <Pressable
                onPress={() => {
                  vibrationService.light();
                  isListeningRef.current = false;
                  stopListening();
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
