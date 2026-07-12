import { router, useLocalSearchParams } from "expo-router";
import { useState, useCallback } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { RouteStep } from "../src/components/RouteStep";
import { useThemeColors } from "../src/theme/colors";
import { journeyService } from "../src/services/journey.service";
import { sessionService } from "../src/services/session.service";
import { vibrationService } from "../src/services/vibration.service";
import { speak } from "../src/services/speech.service";
import { isConnected } from "../src/utils/network";
import { JourneyStep, JourneySummary } from "../src/types/journey.types";
import { formatMinutesToFriendlyText } from "../src/utils/date-time";
import { parseJsonParam } from "../src/utils/helpers";
import { getInteractionMode } from "../src/types/interaction.types";

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

function buildVoiceSummary({
  busLine,
  departureTime,
  arrivalTime,
}: {
  busLine: string;
  departureTime: string;
  arrivalTime: string;
}) {
  const linePart = busLine ? `Você vai pegar a linha ${busLine}. ` : "";
  const departurePart = departureTime ? `O ônibus sai ${departureTime.replace("às ", "às ")}. ` : "";
  const arrivalPart = arrivalTime ? `A chegada prevista é às ${arrivalTime}. ` : "";
  
  return `Encontrei uma rota. ${linePart}${departurePart}${arrivalPart}Quer iniciar a navegação?`;
}

export default function BestRouteScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  
  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const mapParam = String(params.map || "");
  const destination = String(params.destination || "seu destino");
  const destinationLat = String(params.destinationLat || "");
  const destinationLng = String(params.destinationLng || "");
  const selectedDestination = String(params.selectedDestination || "");
  const fullBackendMessage = String(params.message || "");
  const interactionMode = getInteractionMode(params.interactionMode);

  const summary = parseJsonParam<JourneySummary | null>(params.summary, null);
  const alerts = parseJsonParam<string[]>(params.alerts, []);
  const steps = parseJsonParam<JourneyStep[]>(params.steps, []);

  const [isLoadingCommand, setIsLoadingCommand] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const transitSteps = getTransitSteps(steps);
  const firstTransitStep = transitSteps[0];

  const stopName =
    firstTransitStep?.type === "transit"
      ? getShortStopName(firstTransitStep.from)
      : "Ponto próximo";

  const busLine =
    firstTransitStep?.type === "transit"
      ? firstTransitStep.line
      : summary?.busLines?.[0] || "";

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

  const voiceSummary = buildVoiceSummary({
    busLine,
    departureTime: summary?.beAtStopAt || summary?.leaveHomeAt || "",
    arrivalTime: summary?.arrivalAtDestination || "",
  });

  const voiceText = speechTextParam || voiceSummary;

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

  const handleHearRoute = useCallback(() => {
    vibrationService.selection();
    speak(voiceText);
  }, [voiceText]);

  function handleStartNavigation() {
    setIsLoadingCommand(true);
    vibrationService.success();
    router.push({
      pathname: "/navegando",
      params: {
        latitude,
        longitude,
        destination,
        destinationLat,
        destinationLng,
        selectedDestination,
        interactionMode,
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

          {/* PREMIUM SUMMARY CARD */}
          <View style={[styles.premiumSummary, { backgroundColor: theme.primaryDark || "#0F172A" }]}>
             <View style={styles.summaryTop}>
                <View style={[styles.cloudIconBg, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                  <Ionicons name="sparkles" size={24} color="#FFF" />
                </View>
                <Text style={styles.summaryMainText} numberOfLines={3}>{shortMessage}</Text>
             </View>

             <View style={styles.statsRow}>
                <View style={styles.statChip}>
                   <Ionicons name="time" size={16} color="#FFF" />
                   <Text style={styles.statChipText}>{formatMinutesToFriendlyText(totalDurationMin)}</Text>
                </View>
                <View style={styles.statChip}>
                   <FontAwesome6 name="person-walking" size={14} color="#FBBF24" />
                   <Text style={styles.statChipText}>{formatMinutesToFriendlyText(initialWalkTimeMin)}</Text>
                </View>
                <View style={styles.statChip}>
                   <MaterialCommunityIcons name="bus" size={16} color="#34D399" />
                   <Text style={styles.statChipText}>{transitSteps.length} {transitSteps.length === 1 ? 'ônibus' : 'ônibus'}</Text>
                </View>
             </View>
          </View>

          <View style={styles.stepsContainerWrapper}>
            <View style={styles.stepsContainer}>
              <Pressable 
                onPress={() => {
                  vibrationService.light();
                  setShowSteps(!showSteps);
                }}
                style={styles.sectionHeader}
                accessibilityRole="button"
                accessibilityLabel={showSteps ? "Ocultar detalhes da rota" : "Ver detalhes da rota"}
              >
                <Text style={styles.sectionTitle}>Sua jornada detalhada</Text>
                <View style={styles.chevronBg}>
                  <Ionicons 
                    name={showSteps ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={theme.primary} 
                  />
                </View>
              </Pressable>

              {showSteps && (
                <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.stepsList}>
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
                </Animated.View>
              )}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* FLOATING BOTTOM ACTIONS */}
      <View style={[styles.floatingBottomActions, { bottom: insets.bottom + 24 }]}>
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
  premiumSummary: {
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    gap: 16,
  },
  summaryTop: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  cloudIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryMainText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24,
    color: "#FFFFFF",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  statChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  stepsContainerWrapper: {
    marginTop: 4,
  },
  stepsContainer: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  chevronBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  stepsList: {
    paddingTop: 12,
  },
  floatingBottomActions: {
    position: "absolute",
    left: 24,
    right: 24,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
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
