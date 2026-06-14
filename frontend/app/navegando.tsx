import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { 
  Pressable, 
  StyleSheet, 
  Text, 
  View, 
  Dimensions, 
  Modal, 
  Animated, 
  Easing, 
  ScrollView, 
  ActivityIndicator,
  Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { FontAwesome6, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

import { BackButton } from "../src/components/BackButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { useThemeColors } from "../src/theme/colors";
import Map from "../src/components/Map";
import { speak } from "../src/services/speech.service";
import { MapData, MapFocusMode } from "../src/types/journey.types";
import { formatMinutesToFriendlyText, formatBusWaitingTimeToFriendlyTextShort } from "../src/utils/date-time";
import { formatWalkingInstruction } from "../src/utils/navigationInstructionFormatter";
import { parseJsonParam, calculateDistance } from "../src/utils/helpers";
import { ScreenContainer } from "../src/components/ScreenContainer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Coords { 
  latitude: number; 
  longitude: number; 
  heading?: number | null; 
}

/**
 * A NavigatingScreen é a tela de navegação guiada por GPS.
 * Ela acompanha o usuário desde a caminhada inicial até o embarque no ônibus.
 */

/**
 * Estágios da Navegação:
 * - 'walking_to_stop': Usuário está caminhando até o ponto de ônibus.
 * - 'waiting_bus': Usuário chegou ao ponto e está aguardando o ônibus chegar.
 * - 'boarded_success': Usuário confirmou que embarcou no ônibus.
 */
type NavigationStage =
  | "walking_to_stop"
  | "waiting_bus"
  | "boarded_success";

export default function NavigatingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();

  // Dados da rota passados pela tela anterior
  const busLine = String(params.busLine || "--");
  const direction = String(params.direction || "--");
  const stopName = String(params.stopName || "ponto indicado");
  const walkTimeMinutes = String(params.walkTimeMinutes || "--");
  const destination = String(params.destination || "destino");

  const walkTimeNum = useMemo(() => Number(walkTimeMinutes) || 0, [walkTimeMinutes]);

  // Decodifica os parâmetros complexos (JSON) vindos da navegação
  const mapData = useMemo(() => parseJsonParam<MapData | undefined>(params.map, undefined), [params.map]);
  const summary = useMemo(() => parseJsonParam<any>(params.summary, null), [params.summary]);
  const allSteps = useMemo(() => parseJsonParam<any[]>(params.steps, []), [params.steps]);
  
  const transitStep = useMemo(() => allSteps.find(s => s.type === "transit"), [allSteps]);
  const lineDetails = useMemo(() => {
    const details = transitStep?.lineName || transitStep?.headsign || direction || "";
    return details === "--" ? "" : details;
  }, [transitStep, direction]);

  // Estados de controle da tela
  const [stage, setStage] = useState<NavigationStage>("walking_to_stop");
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [currentDistanceToStop, setCurrentDistanceToStop] = useState<number | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0); // Qual "passo" da caminhada o usuário está executando
  const [busCountdown, setBusCountdown] = useState<string>(""); // Tempo para o ônibus chegar
  const [busCountdownDiff, setBusCountdownDiff] = useState<number | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [bottomCardHeight, setBottomCardHeight] = useState(260);

  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Refs para controle de voz e alertas
  const didAnnounceStart = useRef(false);
  const warnedApproachingTurnRef = useRef<number | null>(null);
  const warnedTurnNowRef = useRef<number | null>(null);
  const warnedNearStopRef = useRef(false);
  const lastSpokenAtRef = useRef(0);
  const lastSpokenStepIndexRef = useRef(-1);
  const lastSpokenStageRef = useRef<NavigationStage | null>(null);

  // Filtra apenas os passos de caminhada até o primeiro ponto de ônibus
  const walkSteps = useMemo(() => {
    const items = [];
    for (const step of allSteps) {
      if (step.type === 'walk') {
        items.push(step);
      } else if (step.type === 'transit') {
        break; // Para no primeiro transporte público
      }
    }
    return items;
  }, [allSteps]);

  const targetStopDateTime = summary?.beAtStopDateTime;
  const boardingMarker = useMemo(() => {
    if (!mapData || !mapData.markers) return undefined;
    return mapData.markers.find(m => m.type === 'boarding_stop');
  }, [mapData]);

  const hasValidWalkRoute = useMemo(() => {
    return walkSteps.length > 0 && walkSteps.some(s => !!s.polyline);
  }, [walkSteps]);

  /**
   * Este useEffect é o "cérebro" da navegação em tempo real.
   * Ele monitora a localização do usuário e dispara avisos de voz.
   */
  useEffect(() => {
    if (!userLocation || walkSteps.length === 0 || stage !== "walking_to_stop") return;
    
    const currentStep = walkSteps[currentStepIndex];
    if (!currentStep) return;

    const currentLat = userLocation.latitude;
    const currentLng = userLocation.longitude;

    // Calcula a distância do usuário até o final da instrução atual
    let distToEnd = 9999;
    if (currentStep.endLocation) {
      distToEnd = calculateDistance(
        currentLat, 
        currentLng, 
        currentStep.endLocation.lat, 
        currentStep.endLocation.lng
      );
    }

    /**
     * Lógica de Voz - Avisos Antecipados:
     * - A 60 metros da curva: Avisa "Em 60 metros, vire à esquerda..."
     * - A 15 metros da curva: Avisa "Vire à esquerda agora."
     */
    if (distToEnd < 60 && distToEnd > 20 && warnedApproachingTurnRef.current !== currentStepIndex) {
      const nextStep = walkSteps[currentStepIndex + 1];
      if (nextStep) {
        speakControlled(`Em ${Math.round(distToEnd)} metros, ${nextStep.humanInstruction || nextStep.instruction}`);
        warnedApproachingTurnRef.current = currentStepIndex;
      }
    }

    if (distToEnd < 15 && warnedTurnNowRef.current !== currentStepIndex) {
      const nextStep = walkSteps[currentStepIndex + 1];
      if (nextStep) {
        speakControlled(`${nextStep.humanInstruction || nextStep.instruction} agora.`);
        warnedTurnNowRef.current = currentStepIndex;
      }
    }

    /**
     * Transição de Passo:
     * Se estiver a menos de 12 metros do fim do passo, pula para o próximo.
     */
    if (distToEnd < 12 && currentStepIndex < walkSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      return; 
    }

    /**
     * Detecção de Chegada ao Ponto:
     * Verifica se o usuário está perto do marcador de 'boarding_stop'.
     */
    if (boardingMarker) {
      const distToStop = calculateDistance(currentLat, currentLng, boardingMarker.lat, boardingMarker.lng);
      
      // Alerta de proximidade (40 metros)
      if (distToStop < 40 && !warnedNearStopRef.current) {
        speakControlled("O ponto de ônibus está logo à frente.");
        warnedNearStopRef.current = true;
      }

      // Alerta de chegada (15 metros) - Muda o estágio automaticamente
      if (distToStop < 15) {
        setStage("waiting_bus");
        speakControlled(`Você chegou ao ponto. Agora aguarde o ônibus ${busLine}.`);
      }
    }
  }, [userLocation, currentStepIndex, walkSteps, stage, boardingMarker, busLine]);

  // Animations trigger
  useEffect(() => {
    if (stage === "waiting_bus" || stage === "boarded_success") {
      fadeAnim.setValue(0);
      slideAnim.setValue(16);
      scaleAnim.setValue(0.85);
      buttonFadeAnim.setValue(0);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(buttonFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          stage === "boarded_success" 
            ? Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.1, duration: 150, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
              ])
            : Animated.delay(0)
        ])
      ]).start();
    }
  }, [stage]);

  // Navigation Instruction Formatting
  const formattedInstruction = useMemo(() => {
    if (stage === "waiting_bus") {
      const subtitleText = lineDetails ? `Aguarde o ônibus ${busLine} - ${lineDetails}.` : `Aguarde o ônibus ${busLine}.`;
      const speechText = lineDetails 
        ? `Você chegou ao ponto. Aguarde o ônibus linha ${busLine}, sentido ${lineDetails}. Confira o número antes de embarcar.`
        : `Você chegou ao ponto. Aguarde o ônibus ${busLine}. Confira o número antes de embarcar.`;

      return { 
        displayTitle: "Você chegou ao ponto", 
        displaySubtitle: subtitleText, 
        speechText: speechText 
      };
    }

    if (stage === "boarded_success") {
      return { 
        displayTitle: "Você embarcou no ônibus", 
        displaySubtitle: "Boa viagem.", 
        speechText: "Você embarcou no ônibus. Boa viagem." 
      };
    }

    if (!hasValidWalkRoute) {
      return { 
        displayTitle: "Siga o mapa", 
        displaySubtitle: "Caminhe até o ponto", 
        speechText: "Siga pelo caminho indicado no mapa até o ponto de ônibus.",
      };
    }

    const currentStep = walkSteps[currentStepIndex];
    const rawText = currentStep?.humanInstruction || currentStep?.instruction || `Siga para ${stopName}`;
    
    let distToNext = 0;
    if (userLocation && currentStep?.endLocation) {
      distToNext = calculateDistance(userLocation.latitude, userLocation.longitude, currentStep.endLocation.lat, currentStep.endLocation.lng);
    } else {
      distToNext = currentStep?.distanceMeters || 0;
    }

    return formatWalkingInstruction({ 
      rawInstruction: rawText, 
      distanceMeters: distToNext, 
      maneuver: currentStep?.maneuver 
    });
  }, [stage, hasValidWalkRoute, walkSteps, currentStepIndex, stopName, userLocation, busLine]);

  const speakControlled = (text: string, force = false) => {
    const now = Date.now();
    // Só fala se for forçado, se mudou de estágio, se mudou de passo ou se passou 45s
    if (force || stage !== lastSpokenStageRef.current || (stage === "walking_to_stop" && currentStepIndex !== lastSpokenStepIndexRef.current)) {
      speak(text);
      lastSpokenAtRef.current = now;
      lastSpokenStepIndexRef.current = currentStepIndex;
      lastSpokenStageRef.current = stage;
      return;
    }
    if ((now - lastSpokenAtRef.current) > 45000) {
      speak(text);
      lastSpokenAtRef.current = now;
    }
  };

  // Initial announcement
  useEffect(() => {
    if (!didAnnounceStart.current && walkSteps.length > 0) {
      const timer = setTimeout(() => {
        speakControlled(formattedInstruction.speechText);
        didAnnounceStart.current = true;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [formattedInstruction, walkSteps]);

  // Countdown timer
  useEffect(() => {
    if (!targetStopDateTime) return;
    const updateCountdown = () => {
      const now = new Date(); 
      const target = new Date(targetStopDateTime);
      const diffMs = target.getTime() - now.getTime(); 
      const diffMin = Math.ceil(diffMs / 60000);
      setBusCountdownDiff(diffMin); 
      setBusCountdown(formatBusWaitingTimeToFriendlyTextShort(targetStopDateTime));
    };
    updateCountdown(); 
    const interval = setInterval(updateCountdown, 30000); 
    return () => clearInterval(interval);
  }, [targetStopDateTime]);

  // Alerta se o ônibus chega antes do usuário chegar ao ponto
  const showBusArrivalWarning = useMemo(() => {
    return stage === "walking_to_stop" && 
           busCountdownDiff !== null && 
           busCountdownDiff <= walkTimeNum &&
           busCountdownDiff > -2;
  }, [stage, busCountdownDiff, walkTimeNum]);

  // Location tracking init
  useEffect(() => {
    async function startTracking() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const sub = await Location.watchPositionAsync({ 
          accuracy: Location.Accuracy.High, 
          distanceInterval: 2,
          timeInterval: 2000
        }, (location) => {
          setUserLocation({ 
            latitude: location.coords.latitude, 
            longitude: location.coords.longitude,
            heading: location.coords.heading
          });
        });

        locationSubscriptionRef.current = sub;
      } catch (err) { console.error("Erro GPS:", err); }
    }
    startTracking(); 
    return () => { locationSubscriptionRef.current?.remove(); };
  }, []);

  const handleSair = () => { setShowExitModal(true); };

  const confirmExit = () => {
    setShowExitModal(false);
    router.replace({ 
      pathname: "/inicio", 
      params: { 
        latitude: String(userLocation?.latitude || params.latitude || ""), 
        longitude: String(userLocation?.longitude || params.longitude || "") 
      } 
    });
  };

  const handleStageTransition = () => {
    if (stage === "walking_to_stop") {
      setStage("waiting_bus");
      speakControlled("Você chegou ao ponto. Aguarde o embarque.", true);
    } else if (stage === "waiting_bus") {
      setStage("boarded_success");
      speakControlled(`Tudo certo! Você embarcou no ônibus. Boa viagem. Eu aviso quando estiver perto de descer.`, true);
    } else if (stage === "boarded_success") {
      router.replace({
        pathname: "/inicio",
        params: {
          latitude: String(userLocation?.latitude || params.latitude || ""),
          longitude: String(userLocation?.longitude || params.longitude || "")
        }
      });
    }
  };

  const getPrimaryButtonTitle = () => {
    switch (stage) {
      case "walking_to_stop": return "Cheguei ao ponto";
      case "waiting_bus": return "Embarquei no ônibus";
      case "boarded_success": return "Ir para início";
      default: return "Continuar";
    }
  };

  const getStageTitle = () => {
    switch (stage) {
      case "walking_to_stop": return "Caminho até o ponto";
      case "waiting_bus": return "Você chegou ao ponto";
      case "boarded_success": return "Tudo certo!";
      default: return "Navegando";
    }
  };

  const currentLocation = useMemo(() => {
    if (userLocation) return userLocation;
    if (params.latitude && params.longitude) {
      return { latitude: Number(params.latitude), longitude: Number(params.longitude) };
    }
    return null;
  }, [userLocation, params.latitude, params.longitude]);

  const initialRegion = useMemo(() => ({ 
    latitude: currentLocation?.latitude || -19.7472, 
    longitude: currentLocation?.longitude || -47.9392, 
    latitudeDelta: 0.005, 
    longitudeDelta: 0.005 
  }), []);

  return (
    <View style={styles.container}>
      {/* MAP BACKGROUND */}
      {stage === "walking_to_stop" && (
        <View style={StyleSheet.absoluteFill}>
          <Map 
            mapData={mapData} 
            userLocation={currentLocation} 
            initialRegion={initialRegion} 
            colors={theme} 
            focusMode="walking_to_stop" 
            controlsBottomOffset={bottomCardHeight}
            walkSteps={walkSteps}
            currentStepIndex={currentStepIndex}
            isNavigating={true}
          />
        </View>
      )}

      {/* SOLID BACKGROUND (For status stages) */}
      {(stage === "waiting_bus" || stage === "boarded_success") && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#F6F8FA" }]} />
      )}

      {/* Top Bar (Always Fixed) */}
      <View style={[styles.topBar, { top: insets.top + 12 }]} pointerEvents="box-none">
        <View style={styles.backButtonMini}>
          {stage !== "boarded_success" && (
            <BackButton 
              label="Sair" 
              onPress={handleSair} 
              accessibilityLabel="Sair da navegação"
            />
          )}
        </View>

        {stage !== "boarded_success" && (
          <View style={[styles.miniBadge, { backgroundColor: "white" }]}>
            {stage === "waiting_bus" && <View style={[styles.badgeDot, { backgroundColor: theme.primary }]} />}
            <Text style={styles.miniBadgeText}>
              {stage === "waiting_bus" ? "No ponto" : `${walkTimeMinutes} min caminhando`}
            </Text>
          </View>
        )}
      </View>

      {/* Instruction Card (Fixed during walking) */}
      {stage === "walking_to_stop" && (
        <View style={[styles.instructionCardContainer, { top: insets.top + 65 }]} pointerEvents="box-none">
          {!!formattedInstruction.warning && (
            <View style={styles.warningPill}>
              <Ionicons name="warning" size={16} color="#B45309" />
              <Text style={styles.warningPillText}>Verifique o acesso</Text>
            </View>
          )}

          <View style={[styles.instructionCard, { backgroundColor: "white" }]}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
              <FontAwesome6 
                name={formattedInstruction.maneuver?.includes("LEFT") ? "arrow-left" : formattedInstruction.maneuver?.includes("RIGHT") ? "arrow-right" : "arrow-up"} 
                size={22} 
                color={theme.primary} 
              />
            </View>
            <View style={styles.instructionTextContent}>
              <Text style={styles.instructionTitle} numberOfLines={1}>{formattedInstruction.displayTitle}</Text>
              <Text style={styles.instructionSubtitle}>{formattedInstruction.displaySubtitle}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Status Content (Scrollable) */}
        {(stage === "waiting_bus" || stage === "boarded_success") && (
          <ScrollView 
            contentContainerStyle={[
              styles.statusContentContainer, 
              { 
                paddingTop: insets.top + (stage === "boarded_success" ? 120 : 80),
                paddingBottom: insets.bottom + 220
              }
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.largeStatusCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <View style={[styles.largeStatusIconBox, { backgroundColor: stage === "boarded_success" ? "#DCFCE7" : "#F0F7FF" }]}>
                 {stage === "waiting_bus" ? (
                   <FontAwesome6 name="bus-simple" size={40} color={theme.primary} />
                 ) : (
                   <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                     <Ionicons name="checkmark-circle" size={stage === "boarded_success" ? 64 : 56} color="#10B981" />
                   </Animated.View>
                 )}
              </View>
              <Text style={styles.largeStatusTitle}>{getStageTitle()}</Text>
              
              {stage === "boarded_success" && (
                <Text style={styles.boardedConfirmation}>Você embarcou no ônibus.</Text>
              )}

              <Text style={styles.largeStatusSubtitle}>
                {stage === "waiting_bus" 
                  ? formattedInstruction.displaySubtitle 
                  : "Boa viagem. Eu aviso quando estiver perto de descer."}
              </Text>
              
              {stage === "waiting_bus" && !!stopName && stopName !== "ponto indicado" && (
                <Text style={styles.stopNameStatusText} numberOfLines={1}>Ponto: {stopName}</Text>
              )}

              {stage === "waiting_bus" && (
                <Text style={styles.helperText}>Confira o número antes de embarcar.</Text>
              )}

              {stage === "waiting_bus" && (
                <View style={styles.infoCardsGrid}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoCardLabel}>Linha</Text>
                    <Text style={styles.infoCardValue}>{busLine}</Text>
                    {!!lineDetails && lineDetails !== "--" && (
                      <Text style={styles.infoCardSubValue} numberOfLines={2}>{lineDetails}</Text>
                    )}
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoCardLabel}>Chega</Text>
                    <Text style={[styles.infoCardValue, { color: theme.primary }]}>{busCountdown || "Calculando..."}</Text>
                  </View>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        )}

        {/* Fixed Actions for Status Stages */}
        {(stage === "waiting_bus" || stage === "boarded_success") && (
          <Animated.View style={[styles.fixedStatusActions, { paddingBottom: insets.bottom + 16, opacity: stage === "boarded_success" ? buttonFadeAnim : fadeAnim }]}>
            <PrimaryButton title={getPrimaryButtonTitle()} onPress={handleStageTransition} style={styles.mainButton} />
            <Pressable 
              style={styles.secondaryActionBtn} 
              onPress={() => speakControlled(formattedInstruction.speechText, true)}
              accessibilityLabel="Ouvir instrução"
              accessibilityRole="button"
            >
              <Ionicons name="volume-high" size={22} color={theme.primary} />
              <Text style={[styles.secondaryActionText, { color: theme.primary }]}>Ouvir instrução</Text>
            </Pressable>
            
            {stage === "boarded_success" && (
              <Pressable 
                style={styles.tertiaryActionBtn} 
                onPress={() => router.replace("/inicio")}
                accessibilityLabel="Nova rota"
                accessibilityRole="button"
              >
                <Text style={styles.tertiaryActionText}>Nova rota</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Bottom Card for Walking Stage */}
        {stage === "walking_to_stop" && (
          <View 
            onLayout={(e) => setBottomCardHeight(e.nativeEvent.layout.height)}
            style={[styles.bottomCard, { bottom: 0, paddingBottom: insets.bottom + 16, backgroundColor: "white" }]}
          >
            <View style={[styles.dragHandle, { backgroundColor: "#EEE" }]} />

            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetLabel}>Caminho até o ponto</Text>
              {!!stopName && stopName !== "ponto indicado" && (
                <Text style={styles.stopNameText} numberOfLines={1}>Ponto: {stopName}</Text>
              )}
            </View>

            {showBusArrivalWarning && (
              <View style={styles.arrivalWarningBox}>
                <Ionicons name="alert-circle" size={18} color="#B45309" />
                <Text style={styles.arrivalWarningText}>O ônibus pode chegar antes de você.</Text>
              </View>
            )}

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Linha</Text>
                <Text style={styles.summaryValue}>{busLine}</Text>
                {!!lineDetails && lineDetails !== "--" && (
                  <Text style={styles.infoCardSubValue} numberOfLines={2}>{lineDetails}</Text>
                )}
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Chega</Text>
                <Text style={[styles.summaryValue, { color: theme.primary }]}>{busCountdown || "..."}</Text>
              </View>
            </View>
            <View style={styles.actionArea}>
              <PrimaryButton 
                title={getPrimaryButtonTitle()} 
                onPress={handleStageTransition} 
                style={styles.mainButton} 
                accessibilityLabel="Cheguei ao ponto"
              />
              <View style={styles.ttsWrapper}>
                <ListenOptionsButton 
                  label="Ouvir caminho" 
                  textToSpeak={formattedInstruction.speechText} 
                  accessibilityLabel="Ouvir caminho"
                />
              </View>
            </View>
          </View>
        )}
      </View>

      <Modal visible={showExitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sair da navegação?</Text>
            <View style={styles.modalActions}>
              <PrimaryButton title="Continuar navegando" onPress={() => setShowExitModal(false)} />
              <Pressable onPress={confirmExit} style={styles.confirmExitBtn}>
                <Text style={styles.confirmExitText}>Sim, encerrar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 100 },
  backButtonMini: { minWidth: 80 },
  miniBadge: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, alignItems: "center", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  miniBadgeText: { fontWeight: "800", fontSize: 14, color: "#011030" },
  badgeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  instructionCardContainer: { position: "absolute", left: 16, right: 16, zIndex: 90, gap: 8 },
  instructionCard: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, alignItems: "center", elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12 },
  instructionTextContent: { flex: 1 },
  instructionTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3, color: "#011030", lineHeight: 22 },
  instructionSubtitle: { fontSize: 15, fontWeight: "700", color: "#64748B", marginTop: 1 },
  warningPill: { flexDirection: "row", alignSelf: "flex-start", backgroundColor: "#FEF3C7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6, alignItems: "center", borderWidth: 1, borderColor: "#FDE68A" },
  warningPillText: { fontSize: 13, fontWeight: "800", color: "#B45309" },
  bottomCard: { position: "absolute", left: 0, right: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 16, elevation: 20, shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  bottomSheetHeader: { marginBottom: 16, alignItems: 'center' },
  bottomSheetLabel: { fontSize: 13, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 },
  stopNameText: { fontSize: 16, fontWeight: "700", color: "#011030", marginTop: 2 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  summaryItem: { flex: 1, paddingVertical: 10, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#F1F5F9", backgroundColor: "#F8FAFC" },
  summaryLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", color: "#94A3B8", marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: "900", color: "#011030" },
  arrivalWarningBox: { flexDirection: "row", backgroundColor: "#FFFBEB", padding: 10, borderRadius: 12, alignItems: "center", gap: 8, marginBottom: 16, borderWidth: 1, borderColor: "#FEF3C7" },
  arrivalWarningText: { fontSize: 14, fontWeight: "700", color: "#B45309", flex: 1 },
  actionArea: { gap: 12, alignItems: "center", width: "100%" },
  mainButton: { height: 64, borderRadius: 32 },
  ttsWrapper: { opacity: 0.9 },
  statusContentContainer: { flexGrow: 1, paddingHorizontal: 20 },
  largeStatusCard: { backgroundColor: "white", width: "100%", borderRadius: 32, padding: 24, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  largeStatusIconBox: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  largeStatusTitle: { fontSize: 28, fontWeight: "900", textAlign: "center", letterSpacing: -0.5, color: "#011030" },
  boardedConfirmation: { fontSize: 20, fontWeight: "700", color: "#475569", marginTop: 4, textAlign: "center" },
  stopNameStatusText: { fontSize: 18, fontWeight: "700", color: "#011030", marginTop: 8, textAlign: "center", paddingHorizontal: 10 },
  largeStatusSubtitle: { fontSize: 18, fontWeight: "600", textAlign: "center", marginTop: 12, color: "#64748B", lineHeight: 24, paddingHorizontal: 10 },
  helperText: { fontSize: 16, fontWeight: "500", textAlign: "center", marginTop: 8, color: "#64748B", lineHeight: 22 },
  infoCardsGrid: { flexDirection: "row", gap: 10, marginTop: 24, width: "100%" },
  infoCard: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 20, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#F1F5F9" },
  infoCardLabel: { fontSize: 11, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase", marginBottom: 4, textAlign: "center" },
  infoCardValue: { fontSize: 18, fontWeight: "900", color: "#011030" },
  infoCardSubValue: { fontSize: 12, fontWeight: "600", color: "#64748B", marginTop: 4, textAlign: "center", lineHeight: 15 },
  fixedStatusActions: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "white", paddingHorizontal: 24, paddingTop: 16, borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10, gap: 12 },
  secondaryActionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8 },
  secondaryActionText: { fontSize: 17, fontWeight: "800" },
  tertiaryActionBtn: { alignItems: "center", paddingVertical: 8 },
  tertiaryActionText: { fontSize: 15, fontWeight: "700", color: "#94A3B8", textDecorationLine: "underline" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalContent: { backgroundColor: "white", borderRadius: 32, padding: 32, width: "100%", alignItems: "center" },
  modalTitle: { fontSize: 24, fontWeight: "900", marginBottom: 24, color: "#011030", textAlign: "center" },
  modalActions: { width: "100%" },
  confirmExitBtn: { marginTop: 16, paddingVertical: 8, alignSelf: "center" },
  confirmExitText: { color: "#EF4444", fontWeight: "800", fontSize: 16 },
});
