import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenContainer } from "../src/components/ScreenContainer";
import { useAutoSpeak } from "../src/hooks/useAutoSpeak";
import { stopSpeaking, startListening, stopListening, isSpeechRecognitionAvailable } from "../src/services/speech.service";
import { useThemeColors } from "../src/theme/colors";
import { journeyService } from "../src/services/journey.service";
import { sessionService } from "../src/services/session.service";
import { vibrationService } from "../src/services/vibration.service";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ScreenStatus = "listening" | "processing" | "success" | "error";

const VoiceWaveform = () => {
  const theme = useThemeColors();
  const bar1 = useSharedValue(1);
  const bar2 = useSharedValue(1);
  const bar3 = useSharedValue(1);
  const bar4 = useSharedValue(1);
  const bar5 = useSharedValue(1);

  useEffect(() => {
    const animate = (sv: any, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(2.5, { duration: 400 }),
            withTiming(1, { duration: 400 })
          ),
          -1,
          true
        )
      );
    };

    animate(bar1, 0);
    animate(bar2, 150);
    animate(bar3, 300);
    animate(bar4, 450);
    animate(bar5, 600);
  }, [bar1, bar2, bar3, bar4, bar5]);

  const style1 = useAnimatedStyle(() => ({
    height: 6 * bar1.value,
    width: 3,
    backgroundColor: theme.primary,
    borderRadius: 2,
    marginHorizontal: 1.5,
  }));
  const style2 = useAnimatedStyle(() => ({
    height: 6 * bar2.value,
    width: 3,
    backgroundColor: theme.primary,
    borderRadius: 2,
    marginHorizontal: 1.5,
  }));
  const style3 = useAnimatedStyle(() => ({
    height: 6 * bar3.value,
    width: 3,
    backgroundColor: theme.primary,
    borderRadius: 2,
    marginHorizontal: 1.5,
  }));
  const style4 = useAnimatedStyle(() => ({
    height: 6 * bar4.value,
    width: 3,
    backgroundColor: theme.primary,
    borderRadius: 2,
    marginHorizontal: 1.5,
  }));
  const style5 = useAnimatedStyle(() => ({
    height: 6 * bar5.value,
    width: 3,
    backgroundColor: theme.primary,
    borderRadius: 2,
    marginHorizontal: 1.5,
  }));

  return (
    <View style={styles.waveformContainer}>
      <Animated.View style={style1} />
      <Animated.View style={style2} />
      <Animated.View style={style3} />
      <Animated.View style={style4} />
      <Animated.View style={style5} />
    </View>
  );
};

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

export default function ListeningScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const initialManualText = String(params.manualText || "");

  const [status, setStatus] = useState<ScreenStatus>(initialManualText ? "processing" : "listening");
  const [transcript, setTranscript] = useState(initialManualText);
  const [userName, setUserName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const micPulse = useSharedValue(1);

  useEffect(() => {
    async function loadUser() {
      const user = await sessionService.getUser();
      if (user?.name) {
        setUserName(user.name.split(" ")[0]);
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!initialManualText) {
      startListeningSession();
    } else {
      processTranscription(initialManualText);
    }

    return () => {
      stopListening();
    };
  }, []);

  useEffect(() => {
    if (status === "listening") {
      micPulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      micPulse.value = withTiming(1);
    }
  }, [status]);

  const micPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micPulse.value }],
    opacity: interpolate(micPulse.value, [1, 1.2], [1, 0.6]),
  }));

  async function startListeningSession() {
    setStatus("listening");
    setTranscript("");
    setErrorMessage("");
    vibrationService.light();

    if (!isSpeechRecognitionAvailable()) {
      setErrorMessage("Recurso de voz indisponível.");
      setStatus("error");
      vibrationService.error();
      return;
    }

    await startListening({
      onStart: () => console.log("Escuta iniciada"),
      onResult: (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          vibrationService.selection();
          setTimeout(() => stopAndProcess(text), 800);
        }
      },
      onError: (err: any) => {
        if (err.isSilentError || err.error === "no-speech") {
          console.log("[SpeechService] Silêncio detectado (no-speech).");
          setErrorMessage("Não ouvi seu destino. Tente falar novamente.");
        } else {
          console.warn("[SpeechService] Erro na escuta:", err);
          setErrorMessage("Não consegui ouvir. Tente novamente.");
        }
        setStatus("error");
        vibrationService.error();
      },
    });
  }

  async function stopAndProcess(text: string) {
    stopListening();
    if (text.trim()) {
      processTranscription(text);
    } else {
      setStatus("error");
      setErrorMessage("Não ouvi seu destino. Tente falar novamente.");
      vibrationService.error();
    }
  }

  async function processTranscription(text: string) {
    setStatus("processing");
    try {
      // Limpa a sessão conversacional anterior ao iniciar novo diálogo de busca
      sessionService.clearSessionId();

      const response = await journeyService.resolveDestination({
        text,
        origin: { lat: Number(latitude), lng: Number(longitude) },
      });

      if (response.options.length > 0) {
        setStatus("success");
        vibrationService.success();
        router.push({
          pathname: "/confirmar-destino",
          params: {
            latitude,
            longitude,
            destination: response.options[0].name,
            address: response.options[0].address,
            confirmationQuestion: response.voice?.confirmationQuestion || response.message,
            options: JSON.stringify(response.options),
            mode: response.mode || "",
            message: response.message || "",
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
        setErrorMessage("Não encontrei esse destino.");
        vibrationService.error();
      }
    } catch (err) {
      console.error("Erro:", err);
      setStatus("error");
      setErrorMessage("Erro ao buscar destino.");
      vibrationService.error();
    }
  }

  function handleCancel() {
    vibrationService.light();
    stopListening();
    router.replace({
      pathname: "/inicio",
      params: { latitude, longitude }
    });
  }

  const welcomeMessage = status === "listening" 
    ? "Estou ouvindo. Fale para onde quer ir." 
    : status === "processing" 
    ? "Entendendo seu destino..." 
    : "";

  useAutoSpeak(welcomeMessage);

  return (
    <ScreenContainer withPadding={false} style={{ backgroundColor: "#F6F8FA" }}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={{ flex: 1 }} />
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <Text style={[styles.greeting, { color: theme.primary }]}>
            {userName ? `Olá, ${userName}` : "Olá!"}
          </Text>
          <Text style={[styles.title, { color: "#000" }]}>Estou ouvindo você...</Text>
          <Text style={[styles.subtitle, { color: "#666" }]}>Fale o nome do lugar, rua ou bairro.</Text>
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.delay(200).duration(600).springify()} 
          style={[styles.card, { backgroundColor: "white" }]}
        >
          <Text style={[styles.cardLabel, { color: theme.primary }]}>Transcrição ao vivo</Text>
          <View style={styles.transcriptWrapper}>
            <Text style={[styles.transcriptText, { color: "#000" }]}>
              {transcript || (status === "listening" ? "Aguardando voz..." : "Processando...")}
            </Text>
            {status === "listening" && <BlinkingCursor />}
          </View>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {status === "error" && (
          <Animated.View entering={FadeIn} style={styles.errorContainer}>
            <Text style={[styles.errorMessage, { color: theme.danger }]}>{errorMessage}</Text>
            <Pressable 
              style={[styles.retryButton, { backgroundColor: theme.primaryLight }]}
              onPress={startListeningSession}
            >
              <Text style={[styles.retryButtonText, { color: theme.primary }]}>Tentar novamente</Text>
            </Pressable>
          </Animated.View>
        )}

        <Animated.View 
          entering={FadeInUp.delay(300).springify()} 
          style={[styles.bottomBar, { backgroundColor: "white", marginBottom: Math.max(insets.bottom, 24) }]}
        >
          <Pressable 
            style={[styles.cancelButton, { backgroundColor: "#F1F5F9" }]} 
            onPress={handleCancel}
            accessibilityLabel="Cancelar"
          >
            <Ionicons name="close" size={24} color="#000" />
          </Pressable>

          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: theme.primary }]}>
              {status === "processing" ? "Entendendo..." : "Ouvindo..."}
            </Text>
            {status === "listening" && <VoiceWaveform />}
            {status === "processing" && <ActivityIndicator size="small" color={theme.primary} />}
          </View>

          <View style={styles.micWrapper}>
            {status === "listening" && (
              <Animated.View style={[styles.micPulse, { backgroundColor: theme.primary }, micPulseStyle]} />
            )}
            <View style={[styles.micButton, { backgroundColor: theme.primary }]}>
              <Ionicons name="mic" size={28} color="white" />
            </View>
          </View>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingBottom: 8 },
  content: { flex: 1, paddingHorizontal: 24 },
  header: { marginBottom: 32 },
  greeting: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 17, fontWeight: "500" },
  card: { width: "100%", minHeight: 180, borderRadius: 32, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 4, borderWidth: 1, borderColor: "rgba(0,0,0,0.02)" },
  cardLabel: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 },
  transcriptWrapper: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  transcriptText: { fontSize: 24, fontWeight: "800", lineHeight: 32 },
  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 44, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.01)" },
  cancelButton: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  statusContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 15, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  waveformContainer: { flexDirection: "row", alignItems: "center", height: 15 },
  micWrapper: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  micButton: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", zIndex: 2 },
  micPulse: { position: "absolute", width: 60, height: 60, borderRadius: 30, zIndex: 1 },
  errorContainer: { alignItems: "center", marginBottom: 24, gap: 12 },
  errorMessage: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  retryButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  retryButtonText: { fontSize: 15, fontWeight: "800" },
});
