import { BackgroundGradient } from "../src/components/BackgroundGradient";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { usePreventDoublePress } from "../src/hooks/usePreventDoublePress";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  LayoutChangeEvent,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withSpring, withTiming, useSharedValue, withSequence } from "react-native-reanimated";
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
import { shouldAutoStartHomeVoice, markHomeVoiceAutoStarted } from "../src/state/homeVoiceSession";
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
import { VoicePromptText } from "../src/components/VoicePromptText";
import { BottomActionBar } from "../src/components/BottomActionBar";
import { FavoritesAndHistoryView } from "../src/components/FavoritesAndHistoryView";
import { LiquidGlassView } from "../src/components/LiquidGlassView";
import { AdaptiveIcon } from "../src/components/AdaptiveIcon";
import { logUserInteraction } from "../src/utils/devLogger";

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
 * A HomeScreen é o centro principal do aplicativo (Dashboard).
 * Layout voice-first com 3 zonas:
 *  1. Topo fixo: Ajuda + Configurações
 *  2. Centro: VoiceVisualizer + VoicePromptText + LiveTranscript
 *  3. Rodapé fixo: BottomActionBar
 */
export default function HomeScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();
  const isDark = useColorScheme() === 'dark';

  // Coordenadas passadas por parâmetro ou obtidas do serviço de localização
  const [originCoords, setOriginCoords] = useState({
    latitude: String(params.latitude || ""),
    longitude: String(params.longitude || ""),
  });
  const latitude = originCoords.latitude;
  const longitude = originCoords.longitude;

  const [activeTab, setActiveTab] = useState<"voice" | "favorites" | "settings">("voice");

  // Animação das abas estilo iOS 26
  const [tabMeasurements, setTabMeasurements] = useState<Record<string, { x: number; width: number }>>({});
  const activeMeasurement = tabMeasurements[activeTab];

  const pillScale = useSharedValue(1);

  useEffect(() => {
    pillScale.value = withSequence(
      withTiming(0.97, { duration: 80 }),
      withSpring(1, { damping: 20, stiffness: 400 })
    );
  }, [activeTab, pillScale]);

  const tabAnimatedStyle = useAnimatedStyle(() => {
    if (!activeMeasurement) {
      return { opacity: 0 };
    }
    return {
      opacity: withTiming(1, { duration: 120 }),
      transform: [
        { translateX: withSpring(activeMeasurement.x, { damping: 28, stiffness: 300 }) },
        { scale: pillScale.value }
      ],
      width: withSpring(activeMeasurement.width, { damping: 28, stiffness: 300 }),
    };
  });

  const voiceTextStyle = useAnimatedStyle(() => ({
    color: withTiming(activeTab === "voice" ? theme.primary : theme.textMuted, { duration: 250 }),
  }));
  const favoritesTextStyle = useAnimatedStyle(() => ({
    color: withTiming(activeTab === "favorites" ? theme.primary : theme.textMuted, { duration: 250 }),
  }));
  const settingsTextStyle = useAnimatedStyle(() => ({
    color: withTiming(activeTab === "settings" ? theme.primary : theme.textMuted, { duration: 250 }),
  }));

  const handleTabLayout = (tab: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setTabMeasurements((prev) => ({ ...prev, [tab]: { x, width } }));
  };

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
  const processTranscription = useCallback(async (text: string, isVoice: boolean = false) => {
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
              interactionMode: "text",
              isVoiceSearch: isVoice ? "true" : "false",
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
    } catch (err: any) {
      console.log("Aviso ao processar destino (limite ou erro esperado):", err?.message || err);
      setStatus("error");
      
      let errorMsg = err?.message || "Erro ao buscar destino. Verifique sua conexão.";
      if (errorMsg.toLowerCase().includes("muitas requisições") || errorMsg.includes("429")) {
        errorMsg = "Muitas buscas seguidas. Por favor, aguarde uns minutos e tente novamente.";
      }
      
      setErrorMessage(errorMsg);
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
      void processTranscription(cleanedText || intent.text, true);
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

    const isPermissionDenied = issue.type === "SPEECH_ERROR" && (issue as any).error?.error === "permission-denied";
    if (isPermissionDenied) {
      // Redirect to typing screen
      const originLat = originCoords.latitude;
      const originLng = originCoords.longitude;
      setTimeout(() => {
        router.push({
          pathname: "/digitar-destino",
          params: { latitude: originLat, longitude: originLng },
        });
      }, 300);
      return;
    }

    // Quando é erro de silêncio (usuário não falou nada), usa a mensagem de fallback
    const isSilentError =
      issue.type === "EMPTY_TRANSCRIPT" || issue.type === "SPEECH_ERROR";

    voiceIssueMessageRef.current = isSilentError
      ? SILENCE_FALLBACK_MESSAGE
      : issue.message;
    setErrorMessage(isSilentError ? SILENCE_FALLBACK_MESSAGE : issue.message);
  }, [originCoords]);

  const { startLoop, stopAll, stopListeningAndSubmit } = useVoiceConversationLoop({
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
    void processTranscription(text, false);
  }, [params.searchText, processTranscription]);

  useFocusEffect(
    useCallback(() => {
      setStatus("idle");
      setTranscript("");
      setIsTranscriptFinal(false);
      setErrorMessage("");
      voiceIssueMessageRef.current = "";

      if (!params.searchText && userName) {
        if (shouldAutoStartHomeVoice()) {
          // Primeira vez na sessão: texto anima progressivamente
          setPromptAnimated(true);
          const greetingText = `Olá, ${userName}. Bem-vindo ao RotaBus. Para onde você quer ir hoje?`;
          setPromptText(greetingText);
          markHomeVoiceAutoStarted();
        } else {
          // Já iniciou na sessão antes: não exibe texto longo
          setPromptAnimated(false);
          setPromptText(`Para onde você quer ir hoje?`);
        }
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
   * Alterna a captura de voz: o primeiro toque inicia a escuta e o segundo
   * encerra e envia a transcrição disponível.
   */
  const handleMicPress = usePreventDoublePress(
    function () {
      logUserInteraction({
        component: "<BottomVoiceMicButton />",
        label: getMicActionLabel(),
        fileOrScreen: "app/inicio.tsx",
        action: status === "listening" ? "Parar escuta e enviar" : "Iniciar captura de voz no microfone",
        details: { status },
      });

      if (status === "listening") {
        void stopListeningAndSubmit();
        return;
      }

      if (status === "processing" || status === "speaking") {
        return;
      }

      vibrationService.light();
      setTranscript("");
      setIsTranscriptFinal(false);
      setErrorMessage("");
      voiceIssueMessageRef.current = "";
      void startLoop();
    },
    800,
  );

  function getMicActionLabel() {
    if (status === "speaking") {
      return "Aguarde";
    }

    if (status === "listening") {
      return "Parar e enviar";
    }

    if (status === "processing") {
      return "Entendendo";
    }

    if (status === "error") {
      return "Tentar de novo";
    }

    return "Falar destino";
  }

  const handleTypeDestination = usePreventDoublePress(async function () {
    logUserInteraction({
      component: '<Pressable id="btn-digitar-destino" />',
      label: "Digitar destino",
      fileOrScreen: "app/inicio.tsx",
      action: "Navegar para /digitar-destino",
    });

    vibrationService.light();
    void stopAll();
    const origin = await getOriginCoords();

    setTimeout(() => {
      router.push({
        pathname: "/digitar-destino",
        params: { latitude: origin.latitude, longitude: origin.longitude },
      });
    }, 100);
  }, 1000);

  const handleHelp = usePreventDoublePress(async function () {
    logUserInteraction({
      component: '<Pressable id="card-ajuda" />',
      label: "Central de Ajuda",
      fileOrScreen: "app/inicio.tsx",
      action: "Navegar para /ajuda",
    });

    vibrationService.light();
    void stopAll();
    const origin = await getOriginCoords();
    router.push({
      pathname: "/ajuda",
      params: { latitude: origin.latitude, longitude: origin.longitude },
    });
  }, 1000);

  const handleSettings = usePreventDoublePress(
    function () {
      logUserInteraction({
        component: '<Pressable id="card-configuracoes" />',
        label: "Minha Conta e App",
        fileOrScreen: "app/inicio.tsx",
        action: "Navegar para /configuracoes",
      });

      vibrationService.light();
      void stopAll();
      router.push("/configuracoes");
    },
    800,
  );

  /** Mostra transcrição na área central quando está ouvindo ou processando */
  const showLiveTranscript =
    (status === "listening" || status === "processing") && !!transcript;

  /** Mostra transcrição de erro (texto entendido mas rejeitado) */
  const showErrorTranscript = status === "error" && !!transcript && !!errorMessage;
  const showUserMessage = showLiveTranscript || showErrorTranscript;

  /** Formata a hora atual para exibir abaixo da mensagem do usuário */
  function getCurrentTime(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}h`;
  }

  return (
    <View style={{ flex: 1 }}>
      <BackgroundGradient />
      <ScreenContainer withPadding={false} backgroundColor="transparent">
      {/* ─── ZONA 1: TOPO ─── */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        style={[styles.topHeader, { paddingTop: Math.max(insets.top, 16), backgroundColor: "transparent" }]}
      >
        <LiquidGlassView
          style={[
            styles.tabsContainer,
            isDark && {
              borderColor: 'rgba(255,255,255,0.12)',
              backgroundColor: 'rgba(255,255,255,0.06)',
            }]}
          fallbackColor={theme.card}
        >
          <Animated.View
            style={[
              styles.activeTabBackground,
              isDark && {
                backgroundColor: 'rgba(255,255,255,0.12)',
                shadowOpacity: 0.25,
              },
              tabAnimatedStyle]}
          />
          
          <Pressable 
            onLayout={(e) => handleTabLayout("voice", e)}
            style={styles.tabButton}
            onPress={() => {
              logUserInteraction({
                component: '<Pressable id="tab-voice" />',
                label: "Assistente",
                fileOrScreen: "app/inicio.tsx",
                action: "Alternar para a aba Assistente",
              });
              setActiveTab("voice");
            }}
          >
            <Animated.Text style={[styles.tabText, voiceTextStyle]}>Assistente</Animated.Text>
          </Pressable>
          <Pressable 
            onLayout={(e) => handleTabLayout("favorites", e)}
            style={styles.tabButton}
            onPress={() => {
              logUserInteraction({
                component: '<Pressable id="tab-favorites" />',
                label: "Favoritos",
                fileOrScreen: "app/inicio.tsx",
                action: "Alternar para a aba Favoritos",
              });
              setActiveTab("favorites");
            }}
          >
            <Animated.Text style={[styles.tabText, favoritesTextStyle]}>Favoritos</Animated.Text>
          </Pressable>
          <Pressable 
            onLayout={(e) => handleTabLayout("settings", e)}
            style={styles.tabButton}
            onPress={() => {
              logUserInteraction({
                component: '<Pressable id="tab-settings" />',
                label: "Ajustes",
                fileOrScreen: "app/inicio.tsx",
                action: "Alternar para a aba Ajustes",
              });
              setActiveTab("settings");
            }}
          >
            <Animated.Text style={[styles.tabText, settingsTextStyle]}>Ajustes</Animated.Text>
          </Pressable>
        </LiquidGlassView>
      </Animated.View>

      {/* ─── ZONA 2: CENTRO ─── */}
      <View style={styles.centerZone} pointerEvents={(activeTab === "favorites" || activeTab === "settings") ? "auto" : "none"}>
        {activeTab === "settings" ? (
          <View style={{ width: "100%", maxWidth: 380, marginTop: 20, gap: 12 }}>
            <Pressable style={[styles.settingsCard, { backgroundColor: theme.card }]} onPress={handleSettings}>
              <AdaptiveIcon iosSymbol="gearshape" fallbackFamily="Ionicons" fallbackName="settings-outline" size={24} color={theme.text} />
              <View>
                <Text style={[styles.settingsCardText, { color: theme.text }]}>Minha Conta e App</Text>
                <Text style={[styles.settingsCardSub, { color: theme.textMuted }]}>Sua senha, acessibilidade e perfil</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.settingsCard, { backgroundColor: theme.card }]} onPress={handleHelp}>
              <AdaptiveIcon iosSymbol="questionmark.circle" fallbackFamily="Ionicons" fallbackName="help-circle-outline" size={24} color={theme.text} />
              <View>
                <Text style={[styles.settingsCardText, { color: theme.text }]}>Central de Ajuda</Text>
                <Text style={[styles.settingsCardSub, { color: theme.textMuted }]}>Aprenda a usar o RotaBus</Text>
              </View>
            </Pressable>
          </View>
        ) : activeTab === "favorites" ? (
          <FavoritesAndHistoryView onSelectDestination={(text) => {
            setActiveTab("voice");
            setTranscript(text);
            setIsTranscriptFinal(true);
            void processTranscription(text, false);
          }} />
        ) : (
          <>
        {/* Card unificado: assistente + destino do usuário */}
        {!!promptText && (
          <Animated.View
            entering={FadeIn.duration(250)}
            style={styles.unifiedCard}
          >
            <Text style={[styles.messageLabel, { color: theme.textMuted }]}>Assistente</Text>
            <LiquidGlassView
              style={[
                styles.assistantBubble,
                isDark && {
                  borderColor: 'rgba(255,255,255,0.10)',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                }]}
              fallbackColor={theme.card}
            >
              <VoicePromptText
                text={promptText}
                animated={promptAnimated && status === "speaking"}
                align="left"
                style={styles.promptTextWrapper}
                textStyle={[styles.assistantPromptText, { color: theme.text }]}
              />

              {!showUserMessage ? (
                <Text style={[styles.subtitleHint, { color: theme.textMuted }]}>
                  Diga ou digite um endereço, ponto de ônibus ou linha...
                </Text>
              ) : (
                <Animated.View
                  entering={FadeInDown.duration(300)}
                  style={styles.userMessageInCard}
                  testID={isTranscriptFinal ? "live-transcript-final" : "live-transcript-partial"}
                >
                  <Text style={[styles.userTranscriptText, { color: theme.text }]}>
                    {transcript}
                  </Text>
                  <Text style={[styles.timestampText, { color: theme.textMuted }]}>
                    {getCurrentTime()}
                  </Text>
                </Animated.View>
              )}

              {/* Botões Rápidos */}
              <View style={styles.quickPillsRow}>
                <Pressable style={[styles.quickPill, { borderColor: theme.border }]} onPress={() => { setTranscript("Casa"); processTranscription("Casa", false); }}>
                  <Ionicons name="home-outline" size={16} color={theme.primary} />
                  <Text style={[styles.quickPillText, { color: theme.primary }]}>Casa</Text>
                </Pressable>
                <Pressable style={[styles.quickPill, { borderColor: theme.border }]} onPress={() => { setTranscript("Trabalho"); processTranscription("Trabalho", false); }}>
                  <Ionicons name="briefcase-outline" size={16} color={theme.primary} />
                  <Text style={[styles.quickPillText, { color: theme.primary }]}>Trabalho</Text>
                </Pressable>
                <Pressable style={[styles.quickPill, { borderColor: theme.border }]} onPress={() => { setTranscript("Uniube"); processTranscription("Uniube", false); }}>
                  <Ionicons name="school-outline" size={16} color={theme.primary} />
                  <Text style={[styles.quickPillText, { color: theme.primary }]}>Uniube</Text>
                </Pressable>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              {/* Seção Recentes */}
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>RECENTES</Text>
              
              <View style={styles.recentList}>
                <Pressable style={styles.recentItem} onPress={() => { setTranscript("Av. Leopoldino de Oliveira"); processTranscription("Av. Leopoldino de Oliveira", false); }}>
                  <View style={[styles.recentIcon, { backgroundColor: theme.primary + "1A" }]}>
                    <Ionicons name="time-outline" size={20} color={theme.primary} />
                  </View>
                  <View style={styles.recentTexts}>
                    <Text style={[styles.recentTitle, { color: theme.text }]} numberOfLines={1}>Av. Leopoldino de Oliveira</Text>
                    <Text style={[styles.recentSubtitle, { color: theme.textMuted }]} numberOfLines={1}>Centro • Próximo ao Calçadão</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </Pressable>
              </View>
            </LiquidGlassView>
          </Animated.View>
        )}

        {/* Banner de erro / fallback */}
        {status === "error" && !!errorMessage && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{ width: '100%', alignItems: 'center', marginBottom: 12 }}
            pointerEvents="none"
            accessible
            accessibilityLiveRegion="assertive"
          >
            <LiquidGlassView 
              intensity={50} 
              disableDefaultStyles 
              style={[styles.errorBanner, { backgroundColor: "rgba(254, 226, 226, 0.4)", borderColor: "rgba(254, 205, 211, 0.5)" }]}
            >
              <Ionicons name="alert-circle" size={18} color="#9F1239" style={styles.errorIcon} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </LiquidGlassView>
          </Animated.View>
        )}
        </>
        )}
      </View>

      {/* ─── ZONA 3: BARRA INFERIOR FIXA ─── */}
      <View
        style={[
          styles.bottomContainer,
          { paddingBottom: Math.max(insets.bottom, 24) }]}
        pointerEvents="box-none"
      >
        <BottomActionBar
          status={status}
          micLabel={getMicActionLabel()}
          onTypeDestination={handleTypeDestination}
          onMicPress={handleMicPress}
        />
      </View>
    </ScreenContainer>
    </View>
  );
}

const APPLE_FONT = Platform.select({
  ios: { fontFamily: "System" },
  default: { fontFamily: "System" },
});

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  tabsContainer: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    position: "relative",
  },
  activeTabBackground: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    zIndex: 1,
  },
  tabButtonActive: {
    // Agora removido porque a pílula de fundo faz esse papel via reanimated.
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  tabTextActive: {
    // Agora usando color: theme.primary inline.
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
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
    justifyContent: "flex-start",
    gap: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  unifiedCard: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    ...APPLE_FONT,
  },
  assistantBubble: {
    borderRadius: 30,
    borderTopLeftRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 22,
    minHeight: 190,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  promptTextWrapper: {
    paddingHorizontal: 0,
  },
  assistantPromptText: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.4,
    ...APPLE_FONT,
  },
  userMessageInCard: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  userTranscriptText: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.2,
    ...APPLE_FONT,
  },
  timestampText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
    marginTop: 8,
    ...APPLE_FONT,
  },
  subtitleHint: {
    fontSize: 16,
    marginTop: 12,
    lineHeight: 22,
    ...APPLE_FONT,
  },
  quickPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 16,
  },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  quickPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  recentList: {
    gap: 16,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  recentTexts: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  recentSubtitle: {
    fontSize: 14,
    marginTop: 2,
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
    ...APPLE_FONT,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  settingsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  settingsCardText: {
    fontSize: 16,
    fontWeight: "700",
  },
  settingsCardSub: {
    fontSize: 13,
    marginTop: 2,
  },
});
