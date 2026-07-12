import { router, useLocalSearchParams } from "expo-router";
import { useState, useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
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

  // Bottom bar fixed height for padding calculation
  const bottomBarHeight = 160;

  return (
    <View style={styles.screen}>
      {/* FIXED HEADER */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + 8 }]}>
        <BackButton label="Início" onPress={isLoadingCommand ? undefined : handleGoHome} accessibilityLabel="Voltar para a tela inicial" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: insets.top + 72, 
            paddingBottom: bottomBarHeight + insets.bottom + 24
          }
        ]}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.content}>
          {/* 1. CABEÇALHO */}
          <View style={styles.header}>
            <Text style={styles.title} maxFontSizeMultiplier={1.2}>Sua melhor rota</Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.1}>Para {destination}</Text>
          </View>

          {/* 2. CARD DE RESUMO PRINCIPAL */}
          <View style={[styles.summaryCard, { backgroundColor: theme.primaryDark || "#0F172A" }]}>
            {/* Badge */}
            <View style={styles.summaryBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34D399" />
              <Text style={styles.summaryBadgeText}>Melhor rota encontrada</Text>
            </View>

            {/* Chips de indicadores */}
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Ionicons name="time" size={18} color="#FFF" />
                <Text style={styles.chipText}>{formatMinutesToFriendlyText(totalDurationMin)}</Text>
              </View>
              <View style={styles.chip}>
                <FontAwesome6 name="person-walking" size={15} color="#FBBF24" />
                <Text style={styles.chipText}>{formatMinutesToFriendlyText(initialWalkTimeMin)} a pé</Text>
              </View>
              <View style={styles.chip}>
                <MaterialCommunityIcons name="bus" size={18} color="#34D399" />
                <Text style={styles.chipText}>{transitSteps.length} {transitSteps.length === 1 ? 'ônibus' : 'ônibus'}</Text>
              </View>
            </View>

            {/* Linha divisória */}
            <View style={styles.summaryDivider} />

            {/* Detalhes de resumo */}
            <View style={styles.summaryDetailsGrid}>
              {busLine ? (
                <View style={styles.summaryDetailItem}>
                  <Text style={styles.summaryDetailLabel}>Primeiro ônibus</Text>
                  <View style={styles.busLineHighlight}>
                    <MaterialCommunityIcons name="bus" size={16} color="#FFF" />
                    <Text style={styles.busLineNumber}>{busLine}</Text>
                  </View>
                </View>
              ) : null}
              {summary?.leaveHomeAt ? (
                <View style={styles.summaryDetailItem}>
                  <Text style={styles.summaryDetailLabel}>Saída</Text>
                  <Text style={styles.summaryDetailValue}>{summary.leaveHomeAt}</Text>
                </View>
              ) : null}
              {summary?.arrivalAtDestination ? (
                <View style={styles.summaryDetailItem}>
                  <Text style={styles.summaryDetailLabel}>Chegada</Text>
                  <Text style={styles.summaryDetailValue}>{summary.arrivalAtDestination}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* 3. PASSO A PASSO */}
          <View style={styles.stepsSection}>
            <View style={styles.stepsSectionHeader}>
              <Ionicons name="map-outline" size={20} color="#0F172A" />
              <Text style={styles.stepsSectionTitle}>Passo a passo</Text>
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

      {/* 4. RODAPÉ FIXO DE AÇÕES */}
      <Animated.View 
        entering={FadeInDown.duration(400).delay(200)} 
        style={[
          styles.bottomActions, 
          { paddingBottom: insets.bottom + 16 }
        ]}
      >
        <PrimaryButton
          title="Iniciar navegação"
          onPress={handleStartNavigation}
          disabled={isLoadingCommand}
          isLoading={isLoadingCommand}
          style={styles.mainButton}
          accessibilityLabel="Iniciar navegação para esta rota"
        />
        <ListenOptionsButton 
          label="Ouvir resumo"
          onPress={handleHearRoute} 
          accessibilityLabel="Ouvir resumo da rota em voz alta"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ─── Layout ─── */
  screen: {
    flex: 1,
    backgroundColor: "#F6F8FA",
  },
  fixedHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 5,
    paddingHorizontal: 16,
    backgroundColor: "rgba(246,248,250,0.92)",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 28,
  },

  /* ─── 1. Cabeçalho ─── */
  header: {
    alignItems: "flex-start",
    marginBottom: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#000",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 4,
  },

  /* ─── 2. Card de resumo ─── */
  summaryCard: {
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    gap: 16,
  },
  summaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(52,211,153,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  summaryBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#34D399",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 8,
  },
  chipText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  summaryDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  summaryDetailItem: {
    minWidth: 80,
    gap: 4,
  },
  summaryDetailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryDetailValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  busLineHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(59,130,246,0.4)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  busLineNumber: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  /* ─── 3. Passo a passo ─── */
  stepsSection: {
    gap: 16,
  },
  stepsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepsSectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
  },
  stepsList: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    paddingTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  /* ─── 4. Rodapé fixo ─── */
  bottomActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
    gap: 8,
    alignItems: "center",
  },
  mainButton: {
    height: 64,
    borderRadius: 32,
  },
});
