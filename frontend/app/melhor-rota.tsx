import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { RouteStep } from "../src/components/RouteStep";
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";
import { useThemeColors } from "../src/theme/colors";
import { speak } from "../src/services/speech.service";
import { journeyService } from "../src/services/journey.service";
import { sessionService } from "../src/services/session.service";
import { vibrationService } from "../src/services/vibration.service";
import { isConnected } from "../src/utils/network";
import { JourneyStep, JourneySummary } from "../src/types/journey.types";
import { formatMinutesToFriendlyText } from "../src/utils/date-time";
import { parseJsonParam } from "../src/utils/helpers";

function getTransitSteps(steps: JourneyStep[]) {
  return steps.filter((step) => step.type === "transit");
}

function getShortStopName(stopName: string) {
  if (!stopName) {
    return "Ponto próximo";
  }
  return stopName.split(",")[0].trim();
}

function buildShortMessage({
  transitSteps,
  stopName,
  leaveHomeText,
  beAtStopText,
}: {
  transitSteps: JourneyStep[];
  stopName: string;
  leaveHomeText: string;
  beAtStopText: string;
}) {
  const buses = transitSteps
    .filter((step) => step.type === "transit")
    .map((step) => step.line);

  if (buses.length === 0) {
    return "Você pode ir andando até o seu destino.";
  }

  if (buses.length === 1) {
    const whenToLeave = leaveHomeText ? `Saia ${leaveHomeText}.` : "Saia agora.";
    const busInfo = beAtStopText ? `Pegue o ônibus ${buses[0]} às ${beAtStopText.replace("às ", "")}.` : `Pegue o ônibus ${buses[0]}.`;
    return `${whenToLeave} Caminhe até o ponto ${stopName}. ${busInfo}`;
  }

  return `Encontrei uma rota com ${buses.length} ônibus. Primeiro, pegue o ônibus ${buses[0]} ${beAtStopText}. Depois eu te aviso onde trocar.`;
}

export default function BestRouteScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  
  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const mapParam = String(params.map || "");
  const destination = String(params.destination || "seu destino");
  const fullBackendMessage = String(params.message || "");

  const summary = parseJsonParam<JourneySummary | null>(params.summary, null);
  const alerts = parseJsonParam<string[]>(params.alerts, []);
  const steps = parseJsonParam<JourneyStep[]>(params.steps, []);

  const [isLoadingCommand, setIsLoadingCommand] = useState(false);

  const transitSteps = getTransitSteps(steps);
  const firstTransitStep = transitSteps[0];

  const stopName =
    firstTransitStep?.type === "transit"
      ? getShortStopName(firstTransitStep.from)
      : "Ponto próximo";

  const busLine =
    firstTransitStep?.type === "transit"
      ? firstTransitStep.line
      : summary?.busLines?.[0] || "Linha não identificada";

  const leaveHomeText = summary?.leaveHomeText || "";
  const beAtStopText = summary?.beAtStopText || "";
  const initialWalkTimeMin = summary?.initialWalkTimeMin ?? 0;
  const totalDurationMin = summary?.totalDurationMin ?? 0;

  const shortMessage = buildShortMessage({
    transitSteps,
    stopName,
    leaveHomeText,
    beAtStopText,
  });

  const speechTextParam = String(params.speechText || "");
  const sessionIdParam = String(params.sessionId || "");

  const voiceText = speechTextParam || shortMessage;

  useAutoSpeakOnce(`melhor-rota-${destination}-${busLine}`, voiceText);

  async function handleGoHome() {
    setIsLoadingCommand(true);
    vibrationService.light();
    try {
      const connected = await isConnected();
      const activeSessionId = sessionIdParam || sessionService.getSessionId();
      if (connected && activeSessionId) {
        await journeyService.executeCommand({
          sessionId: activeSessionId,
          command: "CANCEL"
        });
      }
    } catch (err) {
      console.log("[BestRoute] Erro ao executar CANCEL no backend:", err);
    } finally {
      setIsLoadingCommand(false);
      sessionService.clearSessionId();
      router.replace({
        pathname: "/inicio",
        params: { latitude, longitude },
      });
    }
  }

  async function handleHearRoute() {
    setIsLoadingCommand(true);
    vibrationService.selection();
    try {
      const connected = await isConnected();
      const activeSessionId = sessionIdParam || sessionService.getSessionId();
      if (connected && activeSessionId) {
        await journeyService.executeCommand({
          sessionId: activeSessionId,
          command: "REPEAT"
        });
      }
      speak(voiceText);
    } catch (err: any) {
      console.log("[BestRoute] Erro ao executar REPEAT no backend:", err);
      if (err?.message && (
        err.message.includes("Sessão conversacional não encontrada") ||
        err.message.includes("não encontrada ou expirada")
      )) {
        vibrationService.error();
        Alert.alert(
          "Conversa Expirada",
          "Sua conversa expirou. Vamos começar de novo.",
          [{ text: "OK", onPress: () => router.replace("/inicio") }]
        );
      } else {
        speak(voiceText);
      }
    } finally {
      setIsLoadingCommand(false);
    }
  }

  function handleStartNavigation() {
    setIsLoadingCommand(true);
    vibrationService.success();
    router.push({
      pathname: "/navegando",
      params: {
        latitude,
        longitude,
        destination,
        message: fullBackendMessage,
        shortMessage,
        summary: JSON.stringify(summary),
        alerts: JSON.stringify(alerts),
        steps: JSON.stringify(steps),
        map: mapParam,
        busLine,
        stopName,
        direction:
          firstTransitStep?.type === "transit"
            ? firstTransitStep.headsign
            : "--",
        walkTimeMinutes: String(initialWalkTimeMin),
      },
    });
    setTimeout(() => {
      setIsLoadingCommand(false);
    }, 1000);
  }

  return (
    <View style={styles.screen}>
      {/* FIXED HEADER */}
      <View style={[styles.fixedHeader, { top: insets.top + 12 }]}>
        <BackButton label="Início" onPress={isLoadingCommand ? undefined : handleGoHome} accessibilityLabel="Voltar para a tela inicial" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: insets.top + 70, 
            paddingBottom: insets.bottom + 180 
          }
        ]}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: "#000" }]} maxFontSizeMultiplier={1.2}>Sua melhor rota</Text>
            <Text style={[styles.subtitle, { color: "#666" }]} maxFontSizeMultiplier={1.1}>Para {destination}</Text>
          </View>

          {/* COMPACT SUMMARY */}
          <View style={styles.compactSummary}>
             <View style={styles.summaryTop}>
                <View style={[styles.cloudIconBg, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name="cloud" size={24} color={theme.primary} />
                </View>
                <Text style={styles.summaryMainText} numberOfLines={3}>{shortMessage}</Text>
             </View>

             <View style={styles.statsRow}>
                <View style={styles.statChip}>
                   <Ionicons name="time-outline" size={16} color={theme.primary} />
                   <Text style={styles.statChipText}>{formatMinutesToFriendlyText(totalDurationMin)}</Text>
                </View>
                <View style={styles.statChip}>
                   <FontAwesome6 name="person-walking" size={14} color="#F59E0B" />
                   <Text style={styles.statChipText}>{formatMinutesToFriendlyText(initialWalkTimeMin)}</Text>
                </View>
                <View style={styles.statChip}>
                   <MaterialCommunityIcons name="bus" size={16} color="#10B981" />
                   <Text style={styles.statChipText}>{transitSteps.length} {transitSteps.length === 1 ? 'ônibus' : 'ônibus'}</Text>
                </View>
             </View>
          </View>

          <View style={styles.stepsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Como chegar</Text>
            </View>

            <View style={styles.stepsList}>
              <RouteStep 
                type="start"
                time={summary?.leaveHomeAt || "Agora"}
                title="Saia do seu local"
                description={leaveHomeText || "Comece agora."}
              />

              {transitSteps.map((step, index) => (
                <RouteStep 
                  key={`step-${index}`}
                  type="bus"
                  time={step.departureTime || (index === 0 ? summary?.beAtStopAt : "") || "--"}
                  title={`Pegue o ônibus ${step.line}`}
                  description={step.lineName || step.headsign || ""}
                  highlight={getShortStopName(step.from)}
                  highlightSecondary={getShortStopName(step.to)}
                />
              ))}

              <RouteStep 
                type="finish"
                time={summary?.arrivalAtDestination || "--"}
                title="Chegada"
                description={destination}
                isLast={true}
              />
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* FIXED BOTTOM ACTIONS */}
      <View style={[styles.fixedBottomActions, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          title="Iniciar navegação"
          onPress={handleStartNavigation}
          disabled={isLoadingCommand}
          isLoading={isLoadingCommand}
          style={styles.mainButton}
          accessibilityLabel="Iniciar navegação para esta rota"
        />
        <View style={styles.ttsWrapper}>
          <ListenOptionsButton 
            label="Ouvir resumo"
            onPress={handleHearRoute} 
            accessibilityLabel="Ouvir resumo da rota em voz alta"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F8FA",
  },
  fixedHeader: {
    position: "absolute",
    left: 16,
    zIndex: 50,
    elevation: 5,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 24,
    gap: 24,
  },
  header: {
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 2,
  },
  compactSummary: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.01)",
    gap: 16,
  },
  summaryTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  cloudIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryMainText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    color: "#011030",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  statChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  stepsContainer: {
    gap: 16,
  },
  sectionHeader: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#011030",
  },
  stepsList: {
    paddingLeft: 4,
  },
  fixedBottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
    gap: 12,
  },
  mainButton: {
    height: 64,
    borderRadius: 32,
  },
  ttsWrapper: {
    alignItems: "center",
    opacity: 0.9,
  },
});
