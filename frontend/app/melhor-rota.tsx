import { BackgroundGradient } from "../src/components/BackgroundGradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, useColorScheme, useWindowDimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";
import { useAccessibility } from "../src/contexts/AccessibilityContext";
import { RouteStep } from "../src/components/RouteStep";
import Map from "../src/components/Map";
import { LiquidGlassView } from "../src/components/LiquidGlassView";
import { LinearGradient } from "expo-linear-gradient";
import { AdaptiveIcon } from "../src/components/AdaptiveIcon";
import { useThemeColors } from "../src/theme/colors";
import { vibrationService } from "../src/services/vibration.service";
import { speak } from "../src/services/speech.service";
import { trackingService } from "../src/services/tracking.service";
import { JourneyStep, MapFocusMode } from "../src/types/journey.types";
import { formatMinutesToFriendlyText } from "../src/utils/date-time";
import { parseJsonParam, calculateDistance } from "../src/utils/helpers";
import { routeReminderService } from "../src/services/routeReminder.service";
import { logUserInteraction } from "../src/utils/devLogger";
import { decodePolyline } from "../src/utils/polyline";


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
  routeCount,
}: {
  busLine: string;
  departureTime: string;
  arrivalTime: string;
  routeCount?: number;
}) {
  const linePart = busLine ? `Você vai pegar a linha ${busLine}. ` : "";
  const departurePart = departureTime ? `O ônibus sai ${departureTime.replace("às ", "às ")}. ` : "";
  const arrivalPart = arrivalTime ? `A chegada prevista é às ${arrivalTime}. ` : "";
  
  if (routeCount && routeCount > 1) {
    return `Encontrei ${routeCount} opções de rota. A recomendada é pegar a linha ${busLine}. Selecione a opção desejada na tela e clique em iniciar navegação.`;
  }
  
  return `Encontrei uma rota. ${linePart}${departurePart}${arrivalPart}Quer iniciar a navegação?`;
}

export default function BestRouteScreen() {
  const { autoRead } = useAccessibility();
  const isInitialMount = useRef(true);
  const routeScrollViewRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();

  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  
  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const destination = String(params.destination || "seu destino");
  const destinationLat = String(params.destinationLat || "");
  const destinationLng = String(params.destinationLng || "");
  const selectedDestination = String(params.selectedDestination || "");
  const fullBackendMessage = String(params.message || "");


  const summary = parseJsonParam<any>(params.summary, null);
  const alerts = parseJsonParam<string[]>(params.alerts, []);
  const steps = parseJsonParam<JourneyStep[]>(params.steps, []);
  const mapData = parseJsonParam<any>(params.map, undefined);
  const rawAlternatives = useMemo(() => parseJsonParam<any[]>(params.alternatives, []), [params.alternatives]);
  const isDark = useColorScheme() === 'dark';

  // Monta a lista completa de rotas selecionáveis
  const allRoutes = useMemo(() => {
    const main = {
      tag: summary?.tag || "Recomendada",
      summary,
      steps,
      map: mapData,
      alerts,
    };
    if (!rawAlternatives || rawAlternatives.length === 0) return [main];
    return [
      main,
      ...rawAlternatives.slice(0, 2).map((alt, i) => {
        let altTag = "Alternativa";
        
        // Comparações lógicas para dar um nome inteligente:
        if (alt.summary?.isWalkingOnly && !main.summary?.isWalkingOnly) {
          altTag = "Ir a pé";
        } else if (alt.summary?.totalDurationMin < main.summary?.totalDurationMin) {
          altTag = "Mais rápida";
        } else if (
           alt.summary?.busLines?.length > 0 && 
           main.summary?.busLines?.length > 0 && 
           alt.summary.busLines.length < main.summary.busLines.length
        ) {
          altTag = "Menos trocas";
        } else {
          altTag = `Alternativa ${i + 1}`;
        }

        return {
          tag: alt.summary?.tag || altTag,
          summary: alt.summary,
          steps: alt.steps || [],
          map: alt.map,
          alerts: alt.alerts || [],
        };
      }),
    ];
  }, [summary, steps, mapData, alerts, rawAlternatives]);

  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  const currentRoute = allRoutes[selectedRouteIndex] || allRoutes[0];
  const activeSummary = currentRoute.summary;
  const activeSteps = currentRoute.steps || [];
  const activeMapData = currentRoute.map || mapData;
  const activeAlerts = currentRoute.alerts || [];

  const [isLoadingCommand, setIsLoadingCommand] = useState(false);
  const [liveBusPosition, setLiveBusPosition] = useState<{lat: number, lng: number, heading?: number} | null>(null);
  const [mapFocusMode, setMapFocusMode] = useState<MapFocusMode>('full_route');

  const transitSteps = getTransitSteps(activeSteps);
  const firstTransitStep = transitSteps[0];
  const isWalkingOnly = transitSteps.length === 0;

  const stopName =
    firstTransitStep?.type === "transit"
      ? getShortStopName(firstTransitStep.from)
      : "Ponto próximo";

  const busLine =
    firstTransitStep?.type === "transit"
      ? firstTransitStep.line
      : activeSummary?.busLines?.[0] || "";

  const direction =
    firstTransitStep?.type === "transit"
      ? (firstTransitStep.headsign || firstTransitStep.to || "")
      : "";

  // Busca a posição comunitária do ônibus a cada 5 segundos
  useEffect(() => {
    if (isWalkingOnly || !busLine) return;
    
    const fetchBus = async () => {
      const data = await trackingService.getBusPosition(busLine, direction || undefined);
      if (data && data.lat && data.lng) {
        setLiveBusPosition({ lat: data.lat, lng: data.lng, heading: data.bearing });
      } else {
        setLiveBusPosition(null);
      }
    };
    
    fetchBus();
    const interval = setInterval(fetchBus, 5000);
    return () => clearInterval(interval);
  }, [isWalkingOnly, busLine, direction]);

  const liveBusDistanceText = useMemo(() => {
    if (!liveBusPosition || !latitude || !longitude) return null;
    const userLat = Number(latitude);
    const userLng = Number(longitude);
    if (!userLat || !userLng) return null;
    const distMeters = calculateDistance(userLat, userLng, liveBusPosition.lat, liveBusPosition.lng);
    if (distMeters < 1000) {
      return `${Math.round(distMeters)}m de você`;
    }
    return `${(distMeters / 1000).toFixed(1)}km de você`;
  }, [liveBusPosition, latitude, longitude]);

  const leaveHomeText = activeSummary?.leaveHomeText || "";
  const beAtStopText = activeSummary?.beAtStopText || "";
  const initialWalkTimeMin = activeSummary?.initialWalkTimeMin ?? 0;
  const totalDurationMin = activeSummary?.totalDurationMin ?? 0;

  const shortMessage = buildShortMessage({
    transitSteps,
    stopName,
    leaveHomeText,
    beAtStopText,
  });

  const speechTextParam = String(params.speechText || "");
  const sessionIdParam = String(params.sessionId || "");
  const isVoiceSearch = String(params.isVoiceSearch || "false");

  const baseVoiceSummary = buildVoiceSummary({
    busLine,
    departureTime: activeSummary?.beAtStopAt || activeSummary?.leaveHomeAt || "",
    arrivalTime: activeSummary?.arrivalAtDestination || "",
    routeCount: allRoutes.length,
  });

  const voiceSummary = isWalkingOnly
    ? `Você pode ir caminhando até ${destination}. São cerca de ${formatMinutesToFriendlyText(totalDurationMin)} a pé. Quer iniciar a caminhada?`
    : baseVoiceSummary;

  const voiceText = speechTextParam || voiceSummary;

  useAutoSpeakOnce(
    `best-route-${sessionIdParam || "manual"}-${destination}`,
    voiceText,
    isVoiceSearch === "true"
  );

  const lastSpokenRouteIndex = useRef(selectedRouteIndex);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Evita falar novamente se a aba não mudou de verdade (protege contra re-renders)
    if (lastSpokenRouteIndex.current === selectedRouteIndex) {
      return;
    }
    lastSpokenRouteIndex.current = selectedRouteIndex;
    
    if (autoRead || isVoiceSearch === "true") {
      const r = allRoutes[selectedRouteIndex];
      const dur = r.summary?.totalDurationMin || 0;
      const isWalking = r.summary?.isWalkingOnly;
      const lines = r.summary?.busLines?.join(" e ") || (isWalking ? "a pé" : "ônibus");
      
      let tagPrefix = "";
      if (r.tag === "Recomendada" || r.tag === "Mais rápida" || r.tag === "Menos trocas") {
        tagPrefix = "Rota ";
      } else if (r.tag === "Ir a pé") {
        tagPrefix = "Opção ";
      }
      
      const tagText = `${tagPrefix}${r.tag}`;
      
      let textToSpeak = `${tagText} selecionada. `;
      if (isWalking) {
        textToSpeak += `Caminhada de ${dur} minutos.`;
      } else {
        textToSpeak += `Duração de ${dur} minutos, usando as linhas ${lines}.`;
      }
      
      speak(textToSpeak);
    }
  }, [selectedRouteIndex, allRoutes, autoRead, isVoiceSearch]);

  // Auto-scroll para centralizar o card da rota selecionada
  useEffect(() => {
    if (allRoutes.length > 1 && routeScrollViewRef.current) {
      const ITEM_WIDTH = 145;
      const GAP = 12;
      const PADDING_HORIZONTAL = 20;

      const itemX = (ITEM_WIDTH + GAP) * selectedRouteIndex;
      const centerOffset = itemX - (width / 2) + (ITEM_WIDTH / 2) + PADDING_HORIZONTAL;

      routeScrollViewRef.current.scrollTo({
        x: Math.max(0, centerOffset),
        animated: true,
      });
    }
  }, [selectedRouteIndex, allRoutes.length, width]);

  const initialRegion = useMemo(() => {
    const coords: { latitude: number; longitude: number }[] = [];
    if (latitude && longitude) {
      coords.push({ latitude: Number(latitude), longitude: Number(longitude) });
    }
    if (activeMapData?.markers) {
      activeMapData.markers.forEach((m: any) => {
        const lat = Number(m.lat);
        const lng = Number(m.lng);
        if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
          coords.push({ latitude: lat, longitude: lng });
        }
      });
    }
    if (activeMapData?.polylines) {
      activeMapData.polylines.forEach((p: any) => {
        const decoded = decodePolyline(p.encodedPolyline);
        decoded.forEach((c) => coords.push(c));
      });
    }

    if (coords.length >= 2) {
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      coords.forEach((c) => {
        if (c.latitude < minLat) minLat = c.latitude;
        if (c.latitude > maxLat) maxLat = c.latitude;
        if (c.longitude < minLng) minLng = c.longitude;
        if (c.longitude > maxLng) maxLng = c.longitude;
      });

      const diffLat = maxLat - minLat;
      const diffLng = maxLng - minLng;
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(diffLat * 1.35, 0.006),
        longitudeDelta: Math.max(diffLng * 1.35, 0.006),
      };
    }

    return {
      latitude: Number(latitude) || -19.7472,
      longitude: Number(longitude) || -47.9392,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    };
  }, [latitude, longitude, activeMapData]);


  const handleHearRoute = useCallback(() => {
    vibrationService.selection();
    speak(voiceText);
  }, [voiceText]);

  const [scheduledReminderTime, setScheduledReminderTime] = useState<string | null>(null);
  const [isSchedulingReminder, setIsSchedulingReminder] = useState(false);

  const isFutureTrip = useMemo(() => {
    if (!activeSummary?.leaveHomeDateTime) return false;
    const leaveMs = new Date(activeSummary.leaveHomeDateTime).getTime();
    const diffMin = (leaveMs - Date.now()) / (1000 * 60);
    // Mais de 30 minutos no futuro
    return diffMin > 30;
  }, [activeSummary?.leaveHomeDateTime]);

  async function handleScheduleReminder() {
    if (!activeSummary?.leaveHomeDateTime) return;

    logUserInteraction({
      component: '<TouchableOpacity id="btn-agendar-lembrete" />',
      label: "Me avisar 10 min antes de sair",
      fileOrScreen: "app/melhor-rota.tsx",
      action: "Agendar notificação local de saída",
      details: {
        destination,
        leaveHomeDateTime: activeSummary.leaveHomeDateTime,
      },
    });

    setIsSchedulingReminder(true);
    vibrationService.light();

    const result = await routeReminderService.scheduleReminder({
      destination,
      busLine: isWalkingOnly ? "a pé" : busLine,
      leaveHomeDateTime: activeSummary.leaveHomeDateTime,
      beAtStopAt: activeSummary.beAtStopAt,
      minutesBefore: 10,
    });

    setIsSchedulingReminder(false);

    if (result.success && result.scheduledTime) {
      vibrationService.success();
      setScheduledReminderTime(result.scheduledTime);
      speak(`Lembrete agendado! Avisaremos você às ${result.scheduledTime} para sair.`);
    } else {
      vibrationService.error();
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
        destinationLat,
        destinationLng,
        selectedDestination,

        message: fullBackendMessage,
        shortMessage,
        summary: JSON.stringify(activeSummary),
        alerts: JSON.stringify(activeAlerts),
        steps: JSON.stringify(activeSteps),
        map: JSON.stringify(activeMapData),
        busLine: isWalkingOnly ? "" : busLine,
        stopName: isWalkingOnly ? destination : stopName,
        direction: isWalkingOnly
          ? ""
          : firstTransitStep?.type === "transit"
            ? firstTransitStep.headsign
            : "--",
        walkTimeMinutes: String(initialWalkTimeMin),
        ...(isWalkingOnly && { isWalkingOnly: "true" }),
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
      <BackgroundGradient />
      {/* Top Bar (Floating Glass Pill) */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topBarInner} pointerEvents="box-none">
          <BackButton label="Voltar" accessibilityLabel="Voltar para a tela anterior" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: insets.top + 60, 
            paddingBottom: bottomBarHeight + insets.bottom + 24
          }
        ]}
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.content}>
          {/* 1. CABEÇALHO E PREVIEW MAPA */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>Sua melhor rota</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]} maxFontSizeMultiplier={1.1}>Para {destination}</Text>
          </View>

          {/* SELETOR DE MÚLTIPLAS ROTAS */}
          {allRoutes.length > 1 && (
            <View style={styles.routeSelectorWrapper}>
              <View style={styles.routeSelectorHeader}>
                <Ionicons name="git-branch-outline" size={18} color={theme.primary} />
                <Text style={[styles.routeSelectorTitle, { color: theme.text }]}>
                  Opções de Rota ({allRoutes.length})
                </Text>
              </View>
              <ScrollView
                horizontal
                ref={routeScrollViewRef}
                showsHorizontalScrollIndicator={false}
                style={styles.routeSelectorScrollView}
                contentContainerStyle={styles.routeSelectorScroll}
              >
                {allRoutes.map((r, idx) => {
                  const isSelected = selectedRouteIndex === idx;
                  const dur = r.summary?.totalDurationMin || 0;
                  const lineNames = r.summary?.busLines?.join(", ") || (r.summary?.isWalkingOnly ? "A pé" : "Ônibus");
                  return (
                    <TouchableOpacity
                      key={`route-opt-${idx}`}
                      onPress={() => {
                        setSelectedRouteIndex(idx);
                        vibrationService.selection();
                      }}
                      style={[
                        styles.routeCardOption,
                        isSelected
                          ? [styles.routeCardSelected, { borderColor: theme.primary }]
                          : [styles.routeCardUnselected, isDark ? { backgroundColor: "rgba(255,255,255,0.06)" } : { backgroundColor: "rgba(255,255,255,0.7)" }]]}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Opção ${r.tag}, ${dur} minutos`}
                    >
                      <View style={[styles.routeCardTag, isSelected && { backgroundColor: theme.primary }]}>
                        <Text style={[styles.routeCardTagText, isSelected && { color: "#FFFFFF" }]}>
                          {r.tag}
                        </Text>
                      </View>
                      <View style={styles.routeCardBody}>
                        <Text style={[styles.routeCardDuration, { color: isSelected ? theme.primary : theme.text }]}>
                          {dur} min
                        </Text>
                        <Text style={[styles.routeCardLines, { color: theme.textMuted }]} numberOfLines={1}>
                          {lineNames}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {activeMapData && (
            <View style={styles.previewMapContainer}>
              <Map 
                key={`map-route-${selectedRouteIndex}`}
                mapData={activeMapData} 
                initialRegion={initialRegion} 
                userLocation={{ latitude: Number(latitude), longitude: Number(longitude) }}
                colors={theme} 
                focusMode={mapFocusMode} 
                onFocusModeChange={setMapFocusMode}
                isNavigating={false}
                liveBusPosition={liveBusPosition}
              />
            </View>
          )}

          {/* 2. CARD DE RESUMO PRINCIPAL */}
          <View style={[styles.summaryCard, { backgroundColor: "rgba(15, 23, 42, 0.75)" }]}>
            {/* Badges do Topo */}
            <View style={styles.topBadgesRow}>
              <View style={[styles.summaryBadge, isWalkingOnly && { backgroundColor: "rgba(59,130,246,0.15)" }]}>
                {isWalkingOnly ? (
                  <FontAwesome6 name="person-walking" size={16} color="#3B82F6" />
                ) : (
                  <Ionicons name="checkmark-circle" size={16} color="#34D399" />
                )}
                <Text style={[styles.summaryBadgeText, isWalkingOnly && { color: "#3B82F6" }]}>
                  {isWalkingOnly ? "Você pode ir a pé" : (currentRoute.tag || "Melhor rota encontrada")}
                </Text>
              </View>

              {!isWalkingOnly && liveBusPosition && (
                <View style={styles.liveBusBadgeContainer}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveBusBadgeText}>
                    Ao vivo {liveBusDistanceText ? `(${liveBusDistanceText})` : ""}
                  </Text>
                </View>
              )}
            </View>

            {/* Chips de indicadores */}
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Ionicons name="time" size={18} color="#FFF" />
                <Text style={styles.chipText}>{formatMinutesToFriendlyText(totalDurationMin)}{isWalkingOnly ? " a pé" : ""}</Text>
              </View>
              {isWalkingOnly ? (
                <View style={styles.chip}>
                  <MaterialCommunityIcons name="map-marker-distance" size={18} color="#FFF" />
                  <Text style={styles.chipText}>{activeSummary?.totalDistanceMeters || activeSummary?.initialWalkDistanceMeters || 0}m</Text>
                </View>
              ) : (
                <>
                  <View style={styles.chip}>
                    <FontAwesome6 name="person-walking" size={15} color="#FBBF24" />
                    <Text style={styles.chipText}>{formatMinutesToFriendlyText(initialWalkTimeMin)} a pé</Text>
                  </View>
                  <View style={styles.chip}>
                    <MaterialCommunityIcons name="bus" size={18} color="#34D399" />
                    <Text style={styles.chipText}>{transitSteps.length} {transitSteps.length === 1 ? 'ônibus' : 'ônibus'}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Linha divisória e detalhes */}
            {!isWalkingOnly && (
              <>
                <View style={styles.summaryDivider} />
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
                  {activeSummary?.leaveHomeAt ? (
                    <View style={styles.summaryDetailItem}>
                      <Text style={styles.summaryDetailLabel}>Saída</Text>
                      <Text style={styles.summaryDetailValue}>{activeSummary.leaveHomeAt}</Text>
                    </View>
                  ) : null}
                  {activeSummary?.arrivalAtDestination ? (
                    <View style={styles.summaryDetailItem}>
                      <Text style={styles.summaryDetailLabel}>Chegada</Text>
                      <Text style={styles.summaryDetailValue}>{activeSummary.arrivalAtDestination}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            )}

            {/* Lembrete de saída antecipada */}
            {isFutureTrip && (
              <View style={[styles.reminderCard, { backgroundColor: "rgba(59, 130, 246, 0.16)", borderColor: "rgba(96, 165, 250, 0.45)" }]}>
                <View style={styles.reminderHeader}>
                  <Ionicons 
                    name={scheduledReminderTime ? "checkmark-circle" : "notifications"} 
                    size={22} 
                    color={scheduledReminderTime ? "#34D399" : "#60A5FA"} 
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderTitle}>
                      {scheduledReminderTime
                        ? `Lembrete agendado para às ${scheduledReminderTime}`
                        : "Viagem programada para mais tarde"}
                    </Text>
                    <Text style={styles.reminderSubtitle}>
                      {scheduledReminderTime
                        ? `Avisaremos você 10 minutos antes de sair (saída prevista às ${activeSummary?.leaveHomeAt}).`
                        : `Você só precisa sair de onde está às ${activeSummary?.leaveHomeAt}. Quer que eu te avise 10 min antes?`}
                    </Text>
                  </View>
                </View>

                {!scheduledReminderTime && (
                  <TouchableOpacity
                    style={[styles.reminderButton, { backgroundColor: theme.primary }]}
                    onPress={handleScheduleReminder}
                    disabled={isSchedulingReminder}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Me avisar dez minutos antes de sair"
                  >
                    <Ionicons name="alarm-outline" size={18} color="#FFF" />
                    <Text style={styles.reminderButtonText}>
                      {isSchedulingReminder ? "Agendando..." : "Me avisar 10 min antes de sair"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* 3. PASSO A PASSO */}
          <View style={styles.stepsSection}>
            <View style={styles.stepsSectionHeader}>
              <AdaptiveIcon iosSymbol="map" fallbackFamily="Ionicons" fallbackName="map-outline" size={20} color={theme.text} />
              <Text style={[styles.stepsSectionTitle, { color: theme.text }]}>Passo a passo</Text>
            </View>

            <View style={[
              styles.stepsList, 
              isDark 
                ? { backgroundColor: "rgba(255, 255, 255, 0.02)", borderColor: "rgba(255, 255, 255, 0.04)" }
                : { backgroundColor: "rgba(255, 255, 255, 0.3)", borderColor: "rgba(255, 255, 255, 0.5)" }
            ]}>
              <RouteStep 
                type="start"
                time={activeSummary?.leaveHomeAt || "Agora"}
                title="Saia do seu local"
                description={leaveHomeText || "Comece agora."}
              />

              {isWalkingOnly && (
                <RouteStep
                  type="walk"
                  title={`Caminhe ${formatMinutesToFriendlyText(totalDurationMin)}`}
                  description={`${activeSummary?.totalDistanceMeters || activeSummary?.initialWalkDistanceMeters || 0} metros até o destino`}
                />
              )}

              {!isWalkingOnly && transitSteps.map((step, index) => (
                <RouteStep 
                  key={`step-${selectedRouteIndex}-${index}`}
                  type="bus"
                  time={step.departureTime || (index === 0 ? activeSummary?.beAtStopAt : "") || "--"}
                  title={`Pegue o ônibus ${step.line}`}
                  description={step.lineName || step.headsign || ""}
                  highlight={getShortStopName(step.from)}
                  highlightSecondary={getShortStopName(step.to)}
                />
              ))}

              <RouteStep 
                type="finish"
                time={activeSummary?.arrivalAtDestination || "--"}
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
        style={styles.bottomActionsShadow}
      >
        <View style={[styles.bottomActionsContent, { paddingBottom: 16 }]}>
          <LiquidGlassView style={StyleSheet.absoluteFillObject} fallbackColor={theme.card} />
          <LinearGradient
            colors={[isDark ? 'rgba(1, 16, 48, 0)' : 'rgba(241, 245, 249, 0)', theme.background]}
            locations={[0.2, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <PrimaryButton
            iconName={isFutureTrip ? undefined : "navigate"}
            title={isFutureTrip ? "Concluir e voltar para o início" : (isWalkingOnly ? "Iniciar caminhada" : "Iniciar navegação")}
            onPress={isFutureTrip ? () => router.replace("/inicio") : handleStartNavigation}
            disabled={isLoadingCommand}
            isLoading={isLoadingCommand}
            style={[styles.mainButton, { borderRadius: 100, minHeight: 56, height: 56 }]}
            accessibilityLabel={isFutureTrip ? "Concluir e voltar para a tela inicial" : "Iniciar navegação para esta rota"}
          />
          <ListenOptionsButton 
            label={isWalkingOnly ? "Ouvir destino" : "Ouvir resumo"}
            style={{ width: "100%", height: 64 }}
            onPress={handleHearRoute} 
            accessibilityLabel="Ouvir resumo da rota em voz alta"
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ─── Layout ─── */
  screen: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
  },
  topBarInner: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 28,
  },

  /* ─── 1. Cabeçalho e Mapa ─── */
  header: {
    alignItems: "center",
    marginBottom: 0,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  previewMapContainer: {
    height: 220,
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },

  /* ─── 1.1 Seletor de Rotas Alternativas ─── */
  routeSelectorWrapper: {
    gap: 12,
  },
  routeSelectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeSelectorTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  routeSelectorScrollView: {
    marginHorizontal: -20,
  },
  routeSelectorScroll: {
    paddingHorizontal: 20,
    gap: 12,
    paddingVertical: 4,
  },
  routeCardOption: {
    width: 145,
    borderRadius: 18,
    padding: 12,
    gap: 8,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  routeCardSelected: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
  },
  routeCardUnselected: {
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  routeCardTag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(100, 116, 139, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  routeCardTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  routeCardBody: {
    gap: 2,
  },
  routeCardDuration: {
    fontSize: 19,
    fontWeight: "900",
  },
  routeCardLines: {
    fontSize: 12,
    fontWeight: "600",
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
  topBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
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
  liveBusBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.22)",
    borderColor: "rgba(34, 197, 94, 0.45)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  liveBusBadgeText: {
    color: "#4ADE80",
    fontSize: 12,
    fontWeight: "800",
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
  },
  stepsList: {
    borderRadius: 24,
    padding: 20,
    paddingTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
  },

  /* ─── 4. Rodapé fixo ─── */
  bottomActionsShadow: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomActionsContent: {
    padding: 16,
    gap: 8,
    alignItems: "center",
    borderRadius: 32,
    overflow: "hidden",
  },
  mainButton: {
    height: 64,
    borderRadius: 32,
  },
  reminderCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  reminderSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
    lineHeight: 18,
  },
  reminderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  reminderButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
