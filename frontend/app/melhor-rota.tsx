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

/** Calcula quantos minutos faltam até a saída */
function calcMinutesUntilLeave(leaveHomeDateTime?: string): number | null {
  if (!leaveHomeDateTime) return null;
  const diff = (new Date(leaveHomeDateTime).getTime() - Date.now()) / 60000;
  if (!isFinite(diff)) return null;
  return Math.round(diff);
}

/** Formata o tempo de espera de forma amigável: "Faltam 45 min" | "Falta 1h" | "Faltam 1h 54min" | "Falta 1 dia e 2h" */
function formatWaitTimePhrase(minutes: number): string {
  if (minutes <= 1) return "Falta 1 min para sair";
  if (minutes < 60) return `Faltam ${minutes} min para sair`;

  const totalHours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (totalHours < 24) {
    if (mins === 0) {
      const verb = totalHours === 1 ? "Falta" : "Faltam";
      return `${verb} ${totalHours}h para sair`;
    }
    return `Faltam ${totalHours}h ${mins}min para sair`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const dayStr = days === 1 ? "1 dia" : `${days} dias`;
  const verb = days === 1 && hours === 0 && mins === 0 ? "Falta" : "Faltam";

  if (hours === 0 && mins === 0) {
    return `${verb} ${dayStr} para sair`;
  }
  if (hours === 0) {
    return `${verb} ${dayStr} e ${mins}min para sair`;
  }
  if (mins === 0) {
    return `${verb} ${dayStr} e ${hours}h para sair`;
  }
  return `${verb} ${dayStr}, ${hours}h ${mins}min para sair`;
}

export default function BestRouteScreen() {
  const { autoRead } = useAccessibility();
  const isInitialMount = useRef(true);
  const routeScrollViewRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();

  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

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
          altTag = `Opção ${i + 2}`;
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
      const ITEM_WIDTH = 140;
      const GAP = 10;
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
    return diffMin > 30;
  }, [activeSummary?.leaveHomeDateTime]);

  // Minutos faltando para sair (atualiza periodicamente para refletir a contagem diminuindo)
  const [minutesUntilLeave, setMinutesUntilLeave] = useState<number | null>(
    () => calcMinutesUntilLeave(activeSummary?.leaveHomeDateTime)
  );

  useEffect(() => {
    const updateMinutes = () => {
      setMinutesUntilLeave(calcMinutesUntilLeave(activeSummary?.leaveHomeDateTime));
    };
    updateMinutes();
    const interval = setInterval(updateMinutes, 5000);
    return () => clearInterval(interval);
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

  // Tempo de espera tranquilo: ≥ 20 minutos até sair
  const hasComfortableWait = minutesUntilLeave !== null && minutesUntilLeave >= 20;

  // Hora da notificação antecipada (10min antes)
  const reminderTargetTime = useMemo(() => {
    if (!activeSummary?.leaveHomeDateTime) return null;
    const d = new Date(new Date(activeSummary.leaveHomeDateTime).getTime() - 10 * 60 * 1000);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }, [activeSummary?.leaveHomeDateTime]);

  // Bottom bar para padding
  const bottomBarHeight = isFutureTrip ? 180 : 140;

  return (
    <View style={styles.screen}>
      <BackgroundGradient />
      {/* Top Bar */}
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
          {/* 1. CABEÇALHO */}
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
                  const firstTransit = r.steps?.find((s: any) => s.type === "transit");
                  const headsign = firstTransit?.headsign || "Em direção ao destino";
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
                          ? styles.routeCardSelected
                          : isDark
                            ? styles.routeCardUnselectedDark
                            : styles.routeCardUnselectedLight,
                      ]}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Opção ${r.tag}, ${dur} minutos`}
                    >
                      {/* Tag */}
                      <View style={[
                        styles.routeCardTag,
                        isSelected ? styles.routeCardTagSelected : styles.routeCardTagUnselected,
                      ]}>
                        <Text style={[
                          styles.routeCardTagText,
                          isSelected ? styles.routeCardTagTextSelected : styles.routeCardTagTextUnselected,
                        ]}>
                          {r.tag.toUpperCase()}
                        </Text>
                      </View>

                      {/* Duração */}
                      <Text style={[styles.routeCardDuration, { color: isSelected ? theme.primary : theme.text }]}>
                        {dur} min
                      </Text>

                      {/* Chip de linha */}
                      {!r.summary?.isWalkingOnly && r.summary?.busLines && r.summary.busLines.length > 0 && (
                        <View style={[styles.routeCardLinesChip, isSelected ? styles.routeCardChipSelected : styles.routeCardChipUnselected]}>
                          <MaterialCommunityIcons name="bus" size={13} color={isSelected ? theme.primary : theme.textMuted} />
                          <Text style={[styles.routeCardLinesChipText, { color: isSelected ? theme.primary : theme.textMuted }]}>
                            {r.summary.busLines.length === 1 ? `Linha ${r.summary.busLines[0]}` : r.summary.busLines.join(", ")}
                          </Text>
                        </View>
                      )}
                      {r.summary?.isWalkingOnly && (
                        <View style={[styles.routeCardLinesChip, isSelected ? styles.routeCardChipSelected : styles.routeCardChipUnselected]}>
                          <FontAwesome6 name="person-walking" size={12} color={isSelected ? theme.primary : theme.textMuted} />
                          <Text style={[styles.routeCardLinesChipText, { color: isSelected ? theme.primary : theme.textMuted }]}>A pé</Text>
                        </View>
                      )}

                      {/* Direção */}
                      <Text style={[styles.routeCardDirection, { color: isSelected ? theme.textMuted : (isDark ? "rgba(255,255,255,0.45)" : "#94A3B8") }]} numberOfLines={2}>
                        {headsign}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* MAPA */}
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
          <View style={styles.summaryCard}>
            {/* Badge de tag (centralizado) + live */}
            <View style={styles.topBadgesRow}>
              <View style={[
                styles.summaryBadge,
                isWalkingOnly ? { backgroundColor: "rgba(59,130,246,0.25)" } : null,
              ]}>
                {isWalkingOnly ? (
                  <FontAwesome6 name="person-walking" size={15} color="#3B82F6" />
                ) : (
                  <Ionicons name="checkmark-circle" size={15} color="#34D399" />
                )}
                <Text style={[styles.summaryBadgeText, isWalkingOnly && { color: "#3B82F6" }]}>
                  {isWalkingOnly ? "Você pode ir a pé" : `${currentRoute.tag || "Recomendada"} / Opção ${selectedRouteIndex + 1}`}
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
                <Text style={styles.chipText}>{formatMinutesToFriendlyText(totalDurationMin)}{isWalkingOnly ? " a pé" : ""}</Text>
              </View>
              {isWalkingOnly ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{activeSummary?.totalDistanceMeters || activeSummary?.initialWalkDistanceMeters || 0}m</Text>
                </View>
              ) : (
                <>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{formatMinutesToFriendlyText(initialWalkTimeMin)} a pé</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{transitSteps.length} {transitSteps.length === 1 ? 'ônibus' : 'ônibus'}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Linha divisória + detalhes de horário */}
            {!isWalkingOnly && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryDetailsGrid}>
                  {/* Coluna esquerda: primeiro ônibus */}
                  {busLine ? (
                    <View style={[styles.summaryDetailItem, { flex: 1 }]}>
                      <Text style={styles.summaryDetailLabel} numberOfLines={1}>PRIMEIRO ÔNIBUS</Text>
                      <View style={styles.busLineHighlight}>
                        <MaterialCommunityIcons name="bus" size={15} color="#FFF" />
                        <Text style={styles.busLineNumber}>Linha {busLine}</Text>
                      </View>
                      <Text style={styles.summaryDetailSubtext} numberOfLines={1}>
                        {direction || "Em direção ao destino"}
                      </Text>
                    </View>
                  ) : null}

                  {/* Divisor vertical */}
                  {busLine && (activeSummary?.leaveHomeAt || activeSummary?.arrivalAtDestination) && (
                    <View style={styles.summaryVerticalDivider} />
                  )}

                  {/* Coluna direita: saída e chegada empilhadas */}
                  {(activeSummary?.leaveHomeAt || activeSummary?.arrivalAtDestination) && (
                    <View style={styles.summaryTimesCol}>
                      {activeSummary?.leaveHomeAt && (
                        <View style={styles.summaryTimeRow}>
                          <Text style={styles.summaryTimeLabel} numberOfLines={1}>SAÍDA</Text>
                          <Text style={styles.summaryTimeValue} numberOfLines={1}>{activeSummary.leaveHomeAt}</Text>
                        </View>
                      )}
                      {activeSummary?.arrivalAtDestination && (
                        <View style={styles.summaryTimeRow}>
                          <Text style={styles.summaryTimeLabel} numberOfLines={1}>CHEGADA</Text>
                          <Text style={styles.summaryTimeValue} numberOfLines={1}>{activeSummary.arrivalAtDestination}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Bloco "Tempo de espera tranquilo" */}
            {!isWalkingOnly && hasComfortableWait && minutesUntilLeave !== null && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.comfortWaitCard}>
                  {/* Linha superior: Ícone do sino + Badge + Título */}
                  <View style={styles.comfortWaitHeader}>
                    <View style={styles.comfortWaitIconCircle}>
                      <Ionicons name="notifications" size={18} color="#60A5FA" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.comfortWaitBadge}>
                        <View style={styles.comfortWaitDot} />
                        <Text style={styles.comfortWaitBadgeText} numberOfLines={1}>TEMPO DE ESPERA TRANQUILO</Text>
                      </View>
                      {/* Título com tempo formatado dinâmico — sempre 1 linha */}
                      <Text style={styles.comfortWaitTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                        {formatWaitTimePhrase(minutesUntilLeave)}
                      </Text>
                    </View>
                  </View>

                  {/* Subtítulo agora estende-se até as bordas do card em até 2 linhas */}
                  {scheduledReminderTime ? (
                    <Text style={styles.comfortWaitSubtitle} numberOfLines={2}>
                      Avisaremos você às{" "}
                      <Text style={styles.comfortWaitSubtitleBold}>{scheduledReminderTime}</Text>
                      {" "}para sair.
                    </Text>
                  ) : (
                    <Text style={styles.comfortWaitSubtitle} numberOfLines={2}>
                      Fique tranquilo! Saia às{" "}
                      <Text style={styles.comfortWaitSubtitleBold}>{activeSummary?.leaveHomeAt}</Text>
                      {" "}para embarcar sem pressa.
                    </Text>
                  )}

                  {!scheduledReminderTime && reminderTargetTime && (
                    <TouchableOpacity
                      style={styles.comfortWaitButton}
                      onPress={handleScheduleReminder}
                      disabled={isSchedulingReminder}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Me avisar 10 minutos antes de sair"
                    >
                      <Ionicons name="alarm-outline" size={16} color="#FFF" style={{ flexShrink: 0 }} />
                      <Text style={styles.comfortWaitButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {isSchedulingReminder ? "Agendando..." : `Me avisar 10 min antes (às ${reminderTargetTime})`}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {scheduledReminderTime && (
                    <View style={styles.comfortWaitButtonScheduled}>
                      <Ionicons name="checkmark-circle" size={16} color="#34D399" />
                      <Text style={styles.comfortWaitButtonScheduledText} numberOfLines={1}>
                        Lembrete agendado para às {scheduledReminderTime}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Lembrete para viagem futura (> 30 min) sem o bloco de espera */}
            {isFutureTrip && !hasComfortableWait && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.reminderCard}>
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
              </>
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
                description={`hoje às ${activeSummary?.leaveHomeAt || "agora"} da noite`}
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
                  title={`Pegue o ônibus ${step.line} - ${step.headsign || step.lineName || ""}`}
                  description={step.headsign ? `LETREIRO: ${step.line} ${step.headsign.toUpperCase()}` : ""}
                  highlight={getShortStopName(step.from)}
                  highlightSecondary={getShortStopName(step.to)}
                  stopCount={step.stopCount}
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
        <View style={[styles.bottomActionsContent, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
          <LiquidGlassView style={StyleSheet.absoluteFillObject} fallbackColor={theme.card} />
          <LinearGradient
            colors={[isDark ? 'rgba(1, 16, 48, 0)' : 'rgba(241, 245, 249, 0)', theme.background]}
            locations={[0.2, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Botão principal: Se futuro → lembrete, senão → iniciar */}
          {isFutureTrip && !scheduledReminderTime && reminderTargetTime ? (
            <PrimaryButton
              iconName="alarm-outline"
              title={isSchedulingReminder ? "Agendando..." : `Me avisar 10 min antes (às ${reminderTargetTime})`}
              onPress={handleScheduleReminder}
              disabled={isSchedulingReminder}
              style={[styles.mainButton]}
              accessibilityLabel="Me avisar dez minutos antes de sair"
            />
          ) : (
            <PrimaryButton
              iconName={isFutureTrip ? undefined : (isWalkingOnly ? "walk" : "navigate")}
              title={isFutureTrip ? "Concluir e voltar para o início" : (isWalkingOnly ? "Iniciar caminhada" : "Iniciar agora")}
              onPress={isFutureTrip ? () => router.replace("/inicio") : handleStartNavigation}
              disabled={isLoadingCommand}
              isLoading={isLoadingCommand}
              style={[styles.mainButton]}
              accessibilityLabel={isFutureTrip ? "Concluir e voltar para a tela inicial" : "Iniciar navegação para esta rota"}
            />
          )}

          {/* Linha inferior: Ouvir resumo + Iniciar agora (quando for futuro) */}
          <View style={styles.bottomSecondaryRow}>
            <ListenOptionsButton
              label={isWalkingOnly ? "Ouvir destino" : "Ouvir resumo"}
              style={styles.bottomSecondaryBtn}
              onPress={handleHearRoute}
              accessibilityLabel="Ouvir resumo da rota em voz alta"
            />
            {isFutureTrip && (
              <TouchableOpacity
                style={styles.bottomSecondaryInitiarBtn}
                onPress={handleStartNavigation}
                disabled={isLoadingCommand}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Iniciar navegação agora"
              >
                <Ionicons name="navigate" size={16} color={theme.primary} />
                <Text style={[styles.bottomSecondaryInitiarText, { color: theme.primary }]}>Iniciar agora</Text>
              </TouchableOpacity>
            )}
          </View>
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
    gap: 24,
  },

  /* ─── 1. Cabeçalho ─── */
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
    gap: 10,
    paddingVertical: 4,
  },
  routeCardOption: {
    width: 140,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  routeCardSelected: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderColor: "#3B82F6",
  },
  routeCardUnselectedLight: {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderColor: "rgba(0,0,0,0.06)",
  },
  routeCardUnselectedDark: {
    backgroundColor: "rgba(15,23,42,0.75)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  routeCardTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  routeCardTagSelected: {
    backgroundColor: "#3B82F6",
  },
  routeCardTagUnselected: {
    backgroundColor: "rgba(100, 116, 139, 0.15)",
  },
  routeCardTagText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  routeCardTagTextSelected: {
    color: "#FFFFFF",
  },
  routeCardTagTextUnselected: {
    color: "#64748B",
  },
  routeCardDuration: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  routeCardLinesChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    marginTop: 2,
  },
  routeCardChipSelected: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  routeCardChipUnselected: {
    backgroundColor: "rgba(100, 116, 139, 0.12)",
  },
  routeCardLinesChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  routeCardDirection: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
    lineHeight: 15,
  },

  /* ─── 2. Card de resumo ─── */
  summaryCard: {
    borderRadius: 24,
    padding: 22,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
    gap: 18,
    overflow: "hidden",
  },
  topBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "rgba(52,211,153,0.22)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  summaryBadgeText: {
    fontSize: 15,
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
    fontSize: 13,
    fontWeight: "800",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 6,
  },
  chip: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 11,
    borderRadius: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
    textAlign: "center",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  /* Grid de detalhes: coluna esquerda + divisor + coluna de horários */
  summaryDetailsGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
  },
  summaryDetailItem: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  summaryDetailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryDetailValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  summaryVerticalDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 12,
  },
  summaryTimesCol: {
    gap: 10,
    flexShrink: 0,
    justifyContent: "center",
  },
  summaryTimeRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  summaryTimeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flexShrink: 0,
    width: 68,
  },
  summaryTimeValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    flexShrink: 0,
  },
  busLineHighlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3B82F6",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginTop: 4,
  },
  busLineNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  summaryDetailSubtext: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
    lineHeight: 17,
  },

  /* ─── Bloco de tempo de espera tranquilo ─── */
  comfortWaitCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  comfortWaitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  comfortWaitIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(59, 130, 246, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  comfortWaitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(59, 130, 246, 0.3)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    marginBottom: 4,
  },
  comfortWaitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#60A5FA",
  },
  comfortWaitBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#93C5FD",
    letterSpacing: 0.5,
  },
  comfortWaitTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  comfortWaitSubtitle: {
    fontSize: 13.5,
    fontWeight: "400",
    color: "rgba(255,255,255,0.68)",
    lineHeight: 19,
    marginTop: 0,
  },
  comfortWaitSubtitleBold: {
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
  },
  comfortWaitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  comfortWaitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  comfortWaitButtonScheduled: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  comfortWaitButtonScheduledText: {
    color: "#34D399",
    fontSize: 13.5,
    fontWeight: "700",
    flexShrink: 1,
  },

  /* ─── Reminder card (viagem futura sem comfort wait) ─── */
  reminderCard: {
    gap: 12,
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  reminderSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
    lineHeight: 17,
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
    fontSize: 14,
    fontWeight: "700",
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
    gap: 10,
    alignItems: "center",
    borderRadius: 32,
    overflow: "hidden",
  },
  mainButton: {
    width: "100%",
    borderRadius: 100,
    minHeight: 56,
    height: 56,
  },
  bottomSecondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  bottomSecondaryBtn: {
    flex: 1,
    height: 52,
  },
  bottomSecondaryInitiarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
  },
  bottomSecondaryInitiarText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
