
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { 
  Pressable, 
  StyleSheet, 
  Text, 
  View, 
  Modal, 
  Animated, 
  ScrollView, 
  Alert,
  useColorScheme
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import { PrimaryButton } from "../src/components/PrimaryButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { useThemeColors } from "../src/theme/colors";
import Map from "../src/components/Map";
import { LiquidGlassView } from "../src/components/LiquidGlassView";
import { LinearGradient } from "expo-linear-gradient";
import { AdaptiveIcon } from "../src/components/AdaptiveIcon";
import { speak } from "../src/services/speech.service";
import { MapData } from "../src/types/journey.types";
import { formatBusWaitingTimeToFriendlyTextShort } from "../src/utils/date-time";
import { formatWalkingInstruction } from "../src/utils/navigationInstructionFormatter";
import { parseJsonParam, calculateDistance } from "../src/utils/helpers";
import { trackingService } from "../src/services/tracking.service";

interface Coords { 
  latitude: number; 
  longitude: number; 
  heading?: number | null; 
}

/**
 * A NavigatingScreen é a tela de navegação guiada por GPS.
 * Ela acompanha o usuário passo a passo desde a caminhada inicial,
 * espera no ponto, trajeto dentro do ônibus até a chegada ao destino final.
 */

/**
 * Estágios da Navegação:
 * - 'walking': Usuário está caminhando (até o ponto de embarque, baldeação ou destino final).
 * - 'waiting_bus': Usuário chegou ao ponto de ônibus e está aguardando o veículo.
 * - 'on_bus': Usuário embarcou no ônibus e está em deslocamento.
 * - 'arrived': Usuário chegou ao destino final da rota.
 */
type NavigationStage =
  | "walking"
  | "waiting_bus"
  | "on_bus"
  | "arrived";

export default function NavigatingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();
  const isDark = useColorScheme() === 'dark';

  // Dados da rota passados pela tela anterior
  const walkTimeMinutes = String(params.walkTimeMinutes || "--");
  const isWalkingOnly = String(params.isWalkingOnly || "") === "true";

  const walkTimeNum = useMemo(() => Number(walkTimeMinutes) || 0, [walkTimeMinutes]);

  // Decodifica os parâmetros complexos (JSON) vindos da navegação
  const mapData = useMemo(() => parseJsonParam<MapData | undefined>(params.map, undefined), [params.map]);
  const summary = useMemo(() => parseJsonParam<any>(params.summary, null), [params.summary]);
  const allSteps = useMemo(() => parseJsonParam<any[]>(params.steps, []), [params.steps]);

  const [globalStepIndex, setGlobalStepIndex] = useState(0);

  const activeTransitStep = allSteps[globalStepIndex]?.type === "transit" 
    ? allSteps[globalStepIndex] 
    : allSteps.slice(globalStepIndex).find(s => s.type === "transit");

  const busLine = String(activeTransitStep?.line || params.busLine || "--");
  const direction = String(activeTransitStep?.headsign || params.direction || "--");
  const stopName = String(activeTransitStep?.from || activeTransitStep?.departureStop?.name || params.stopName || "ponto indicado");
  
  const transitStep = useMemo(() => allSteps.find(s => s.type === "transit"), [allSteps]);
  const lineDetails = useMemo(() => {
    const details = transitStep?.lineName || transitStep?.headsign || direction || "";
    return (details === "--" || details === busLine) ? "" : details;
  }, [transitStep, direction, busLine]);

  // Estados de controle da tela
  const [stage, setStage] = useState<NavigationStage>("walking");
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0); // Qual "sub-passo" da caminhada o usuário está executando
  const currentGlobalStep = allSteps[globalStepIndex];
  
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
  const warnedDropoffRef = useRef(false);
  const lastSpokenAtRef = useRef(0);
  const lastSpokenStepIndexRef = useRef(-1);
  const lastSpokenStageRef = useRef<NavigationStage | null>(null);
  const lastPingAtRef = useRef(0);

  const speakControlled = useCallback((text: string, force = false) => {
    const now = Date.now();
    if (force || stage !== lastSpokenStageRef.current || (stage === "walking" && globalStepIndex !== lastSpokenStepIndexRef.current)) {
      speak(text);
      lastSpokenAtRef.current = now;
      lastSpokenStepIndexRef.current = globalStepIndex;
      lastSpokenStageRef.current = stage;
      return;
    }
    if ((now - lastSpokenAtRef.current) > 45000) {
      speak(text);
      lastSpokenAtRef.current = now;
    }
  }, [globalStepIndex, stage]);



  const targetStopDateTime = summary?.beAtStopDateTime;
  const destinationMarker = useMemo(() => {
    if (!mapData || !mapData.markers) return undefined;
    return mapData.markers.find(m => m.type === 'destination');
  }, [mapData]);

  const hasValidWalkRoute = useMemo(() => {
    return allSteps.length > 0 && allSteps.some(s => !!s.polyline);
  }, [allSteps]);

  /**
   * Este useEffect é o "cérebro" da navegação em tempo real.
   * Ele monitora a localização do usuário e dispara avisos de voz dependendo do macro-passo atual.
   */
  useEffect(() => {
    if (!userLocation || !currentGlobalStep) return;
    
    const currentLat = userLocation.latitude;
    const currentLng = userLocation.longitude;

    // Rastreamento Comunitário (Waze) - Manda a posição a cada 10s quando está no ônibus
    if (stage === "on_bus" && busLine && busLine !== "--") {
      const now = Date.now();
      if (now - lastPingAtRef.current > 10000) {
        lastPingAtRef.current = now;
        const cleanDir = (direction && direction !== "--") ? direction : undefined;
        trackingService.pingLocation(busLine, currentLat, currentLng, userLocation.heading, cleanDir)
          .catch(e => console.log('Ping invisível falhou:', e));
      }
    }

    if (stage === "walking" && currentGlobalStep.type === "walk") {
      const subSteps = currentGlobalStep.walkSteps || [];
      const subStep = subSteps[currentStepIndex];

      // Navegação curva a curva (Sub-passos)
      if (subStep && subStep.endLocation) {
        const distToEnd = calculateDistance(currentLat, currentLng, subStep.endLocation.lat, subStep.endLocation.lng);
        
        if (distToEnd < 60 && distToEnd > 20 && warnedApproachingTurnRef.current !== currentStepIndex) {
          const nextSubStep = subSteps[currentStepIndex + 1];
          if (nextSubStep) {
            speakControlled(`Em ${Math.round(distToEnd)} metros, ${nextSubStep.instruction}`);
            warnedApproachingTurnRef.current = currentStepIndex;
          }
        }
        
        if (distToEnd < 15 && warnedTurnNowRef.current !== currentStepIndex) {
          const nextSubStep = subSteps[currentStepIndex + 1];
          if (nextSubStep) {
            speakControlled(`${nextSubStep.instruction} agora.`);
            warnedTurnNowRef.current = currentStepIndex;
          }
        }

        if (distToEnd < 12 && currentStepIndex < subSteps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
          return;
        }
      }

      // Verificação de Chegada ao fim do Macro-passo de Caminhada
      const nextMacroStep = allSteps[globalStepIndex + 1];
      
      if (nextMacroStep && nextMacroStep.type === "transit") {
        // Estamos caminhando para um ponto de ônibus ou baldeação
        const stopLat = nextMacroStep.departureLocation?.lat;
        const stopLng = nextMacroStep.departureLocation?.lng;
        
        if (stopLat && stopLng) {
          const distToStop = calculateDistance(currentLat, currentLng, stopLat, stopLng);
          
          if (distToStop < 40 && !warnedNearStopRef.current) {
            speakControlled("O ponto de embarque está logo à frente.");
            warnedNearStopRef.current = true;
          }
          if (distToStop < 15) {
            setStage("waiting_bus");
            speakControlled(`Você chegou ao ponto. Agora aguarde o ônibus ${nextMacroStep.line}.`);
            setCurrentStepIndex(0); // Reseta o sub-passo para a próxima caminhada
            warnedNearStopRef.current = false;
          }
        }
      } else if (!nextMacroStep || (nextMacroStep.type === "walk" && isWalkingOnly)) {
        // Estamos caminhando para o destino final
        if (destinationMarker) {
          const distToDest = calculateDistance(currentLat, currentLng, destinationMarker.lat, destinationMarker.lng);
          if (distToDest < 40 && !warnedNearStopRef.current) {
            speakControlled("Seu destino está logo à frente.");
            warnedNearStopRef.current = true;
          }
          if (distToDest < 25) {
            setStage("arrived");
            speakControlled(`Você chegou ao seu destino.`);
          }
        }
      }
    }

    if (stage === "on_bus" && currentGlobalStep.type === "transit") {
      const dropoffLat = currentGlobalStep.arrivalLocation?.lat;
      const dropoffLng = currentGlobalStep.arrivalLocation?.lng;
      
      if (dropoffLat && dropoffLng) {
        const distToDropoff = calculateDistance(currentLat, currentLng, dropoffLat, dropoffLng);
        
        if (distToDropoff < 400 && !warnedDropoffRef.current) {
          speakControlled("Atenção! Você está se aproximando do seu ponto de descida. Prepare-se para descer.");
          warnedDropoffRef.current = true;
        }

        // Descida Automática (se o GPS detectar que ele chegou muito perto do ponto de descida)
        if (distToDropoff < 40) {
          const nextMacroStep = allSteps[globalStepIndex + 1];
          if (nextMacroStep) {
            setStage("walking");
            setGlobalStepIndex(prev => prev + 1);
            setCurrentStepIndex(0);
            speakControlled("Você chegou ao ponto de descida. Continue a rota no mapa.");
            warnedDropoffRef.current = false;
          } else {
            setStage("arrived");
            speakControlled("Você chegou ao seu destino final.");
          }
        }
      }
    }
  }, [userLocation, stage, globalStepIndex, currentStepIndex, currentGlobalStep, allSteps, destinationMarker, isWalkingOnly, speakControlled, busLine, direction]);

  useEffect(() => {
    if (stage === "waiting_bus" || stage === "arrived") {
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
          Animated.delay(0)
        ])
      ]).start();
    }
  }, [stage, fadeAnim, slideAnim, scaleAnim, buttonFadeAnim]);

  // Navigation Instruction Formatting
  const formattedInstruction = useMemo(() => {
    if (stage === "arrived") {
      return {
        displayTitle: "Você chegou!",
        displaySubtitle: `Destino: ${stopName}`,
        speechText: `Você chegou ao seu destino. ${stopName}.`,
      };
    }

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

    if (stage === "on_bus") {
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

    const currentStep = allSteps[globalStepIndex];
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
  }, [stage, hasValidWalkRoute, allSteps, globalStepIndex, stopName, userLocation, busLine, lineDetails]);

  // Initial announcement
  useEffect(() => {
    if (!didAnnounceStart.current && allSteps.length > 0) {
      const timer = setTimeout(() => {
        speakControlled(formattedInstruction.speechText);
        didAnnounceStart.current = true;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [formattedInstruction, allSteps, speakControlled]);

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
    return stage === "walking" && 
           busCountdownDiff !== null && 
           busCountdownDiff <= walkTimeNum &&
           busCountdownDiff > -2;
  }, [stage, busCountdownDiff, walkTimeNum]);

  const [userHeading, setUserHeading] = useState<number | null>(null);
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Location tracking init
  useEffect(() => {
    let isMounted = true;

    async function startTracking() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !isMounted) return;

        const sub = await Location.watchPositionAsync({ 
          accuracy: Location.Accuracy.High, 
          distanceInterval: 2,
          timeInterval: 2000
        }, (location) => {
          if (isMounted) {
            setUserLocation({ 
              latitude: location.coords.latitude, 
              longitude: location.coords.longitude,
              heading: location.coords.heading
            });
          }
        });

        if (!isMounted) {
          sub.remove();
          return;
        }
        locationSubscriptionRef.current = sub;

        // Ativa a bússola nativa
        const headingSub = await Location.watchHeadingAsync((headingData) => {
          if (isMounted) {
            setUserHeading(headingData.trueHeading !== -1 ? headingData.trueHeading : headingData.magHeading);
          }
        });

        if (!isMounted) {
          headingSub.remove();
          return;
        }
        headingSubscriptionRef.current = headingSub;

      } catch (err) { console.error("Erro GPS:", err); }
    }
    startTracking(); 
    return () => { 
      isMounted = false;
      locationSubscriptionRef.current?.remove(); 
      headingSubscriptionRef.current?.remove();
    };
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

  const handleStageTransition = (forced = false) => {
    // Validação de segurança de distância (Evitar cliques acidentais)
    if (forced !== true && userLocation) {
      if (stage === "walking") {
        const nextTransitStep = allSteps.slice(globalStepIndex).find(s => s.type === "transit");
        let targetLat, targetLng;
        
        if (nextTransitStep) {
          targetLat = nextTransitStep.departureLocation?.lat;
          targetLng = nextTransitStep.departureLocation?.lng;
        } else if (destinationMarker) {
          targetLat = destinationMarker.lat;
          targetLng = destinationMarker.lng;
        }

        if (targetLat && targetLng) {
          const dist = calculateDistance(userLocation.latitude, userLocation.longitude, targetLat, targetLng);
          if (dist > 150) {
            Alert.alert(
              "Você parece distante",
              `O GPS indica que você ainda está a ${Math.round(dist)} metros. Tem certeza que já chegou?`,
              [
                { text: "Não, cancelar", style: "cancel" },
                { text: "Sim, cheguei", onPress: () => handleStageTransition(true) }
              ]
            );
            return;
          }
        }
      } else if (stage === "on_bus" && currentGlobalStep?.type === "transit") {
        const dropoffLat = currentGlobalStep.arrivalLocation?.lat;
        const dropoffLng = currentGlobalStep.arrivalLocation?.lng;
        if (dropoffLat && dropoffLng) {
          const dist = calculateDistance(userLocation.latitude, userLocation.longitude, dropoffLat, dropoffLng);
          if (dist > 300) {
            Alert.alert(
              "Longe do ponto de descida",
              `Faltam cerca de ${Math.round(dist)} metros para o ponto ideal. Certeza que quer descer aqui?`,
              [
                { text: "Continuar no ônibus", style: "cancel" },
                { text: "Sim, já desci", onPress: () => handleStageTransition(true) }
              ]
            );
            return;
          }
        }
      }
    }

    if (stage === "walking") {
      const nextTransitStep = allSteps.slice(globalStepIndex).find(s => s.type === "transit");
      if (nextTransitStep) {
        setStage("waiting_bus");
        speakControlled("Você chegou ao ponto. Aguarde o embarque.", true);
      } else {
        setStage("arrived");
        speakControlled("Você chegou ao seu destino.", true);
      }
    } else if (stage === "waiting_bus") {
      router.replace({
        pathname: "/inicio",
        params: {
          latitude: String(userLocation?.latitude || params.latitude || ""),
          longitude: String(userLocation?.longitude || params.longitude || "")
        }
      });
    } else if (stage === "on_bus") {
      const hasTransitAhead = allSteps.slice(globalStepIndex + 1).some(s => s.type === "transit");
      if (hasTransitAhead) {
        setStage("walking");
        setGlobalStepIndex(prev => prev + 1);
        setCurrentStepIndex(0);
        speakControlled("Você chegou ao ponto de descida. Siga pelo mapa até o próximo ponto de ônibus.", true);
      } else {
        setStage("arrived");
        speakControlled("Você chegou ao seu destino final.", true);
      }
    } else if (stage === "arrived") {
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
      case "walking": 
        const hasTransitAhead = allSteps.slice(globalStepIndex).some(s => s.type === "transit");
        return hasTransitAhead ? "Cheguei ao ponto" : "Cheguei ao destino";
      case "waiting_bus": return "Ir para início";
      case "on_bus": return "Desci do ônibus";
      case "arrived": return "Ir para início";
      default: return "Continuar";
    }
  };

  const getStageTitle = () => {
    switch (stage) {
      case "walking": 
        const hasTransitAhead = allSteps.slice(globalStepIndex).some(s => s.type === "transit");
        return hasTransitAhead ? "Caminho até o ponto" : "Caminho até o destino";
      case "waiting_bus": return "Você chegou ao ponto";
      case "on_bus": return "Tudo certo!";
      case "arrived": return "Você chegou!";
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
    latitudeDelta: 0.002, 
    longitudeDelta: 0.002 
  }), [currentLocation?.latitude, currentLocation?.longitude]);

  return (
    <View style={styles.container}>
      {/* MAP BACKGROUND FICA SEMPRE VISÍVEL */}
      <View style={StyleSheet.absoluteFill}>
        <Map 
          mapData={mapData} 
          userLocation={currentLocation} 
          userHeading={userHeading}
          initialRegion={initialRegion} 
          colors={theme} 
          focusMode={stage === "on_bus" ? "on_bus" : (isWalkingOnly ? "walking_to_destination" : "walking_to_stop")} 
          controlsBottomOffset={bottomCardHeight}
          walkSteps={allSteps}
          currentStepIndex={globalStepIndex}
          isNavigating={true}
          hideControls={stage !== "walking"}
        />
      </View>

      {/* Top Bar (Floating Glass Pills over Map) */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topBarInner} pointerEvents="box-none">
          {(stage !== "on_bus" && stage !== "arrived") ? (
            <Pressable 
              onPress={handleSair}
              accessibilityRole="button"
              accessibilityLabel="Voltar e sair da navegação"
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <LiquidGlassView 
                style={[
                  styles.glassPill, 
                  isDark 
                    ? { backgroundColor: "rgba(15, 23, 42, 0.5)", borderColor: "rgba(255, 255, 255, 0.15)" } 
                    : { backgroundColor: "rgba(255, 255, 255, 0.75)", borderColor: "rgba(255, 255, 255, 0.85)" }
                ]} 
                fallbackColor={theme.card}
              >
                <Ionicons name="chevron-back" size={18} color={theme.text} />
                <Text style={[styles.glassPillText, { color: theme.text }]}>Voltar</Text>
              </LiquidGlassView>
            </Pressable>
          ) : (
            <View />
          )}

          {(stage !== "on_bus" && stage !== "arrived") && (
            <LiquidGlassView 
              style={[
                styles.glassPill, 
                isDark 
                  ? { backgroundColor: "rgba(15, 23, 42, 0.5)", borderColor: "rgba(255, 255, 255, 0.15)" } 
                  : { backgroundColor: "rgba(255, 255, 255, 0.75)", borderColor: "rgba(255, 255, 255, 0.85)" }
              ]} 
              fallbackColor={theme.card}
            >
              {stage === "waiting_bus" ? (
                <View style={[styles.badgeDot, { backgroundColor: theme.primary }]} />
              ) : (
                <AdaptiveIcon
                  iosSymbol="figure.walk"
                  fallbackFamily="FontAwesome6"
                  fallbackName="person-walking"
                  size={14}
                  color={isDark ? '#60A5FA' : theme.primary}
                />
              )}
              <Text style={[styles.glassPillText, { color: theme.text }]}>
                {stage === "waiting_bus" ? "No ponto" : `${walkTimeMinutes} min caminhando`}
              </Text>
            </LiquidGlassView>
          )}
        </View>
      </View>

      {/* Instruction Card (Fixed during walking) */}
      {(stage === "walking") && (
        <View style={[styles.instructionCardContainer, { top: insets.top + 62 }]} pointerEvents="box-none">
          {!!formattedInstruction.warning && (
            <View style={styles.warningPill}>
              <Ionicons name="warning" size={16} color="#B45309" />
              <Text style={styles.warningPillText}>Verifique o acesso</Text>
            </View>
          )}

          <Pressable onPress={() => speakControlled(formattedInstruction.speechText, true)}>
            <View style={styles.instructionCardShadow}>
              <LiquidGlassView 
                style={[
                  styles.instructionCardContent, 
                  isDark 
                    ? { backgroundColor: "rgba(15, 23, 42, 0.55)", borderColor: "rgba(255, 255, 255, 0.12)" } 
                    : { backgroundColor: "rgba(255, 255, 255, 0.75)", borderColor: "rgba(255, 255, 255, 0.85)" }
                ]} 
                fallbackColor={theme.card}
              >
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : theme.primaryLight }]}>
                  <AdaptiveIcon 
                    iosSymbol={formattedInstruction.maneuver?.includes("LEFT") ? "arrow.left" : formattedInstruction.maneuver?.includes("RIGHT") ? "arrow.right" : "arrow.up"}
                    fallbackFamily="FontAwesome6"
                    fallbackName={formattedInstruction.maneuver?.includes("LEFT") ? "arrow-left" : formattedInstruction.maneuver?.includes("RIGHT") ? "arrow-right" : "arrow-up"} 
                    size={18} 
                    color={isDark ? '#60A5FA' : theme.primary} 
                  />
                </View>
                <View style={styles.instructionTextContent}>
                  <Text style={[styles.instructionTitle, { color: theme.text }]} numberOfLines={1}>{formattedInstruction.displayTitle}</Text>
                  <Text style={[styles.instructionSubtitle, { color: theme.textMuted }]}>{formattedInstruction.displaySubtitle}</Text>
                </View>
              </LiquidGlassView>
            </View>
          </Pressable>
        </View>
      )}

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Status Content (Scrollable) */}
        {(stage === "waiting_bus" || stage === "on_bus" || stage === "arrived") && (
          <ScrollView
            contentContainerStyle={[
              styles.statusContentContainer,
              {
                paddingTop: insets.top + 100,
                paddingBottom: insets.bottom + 160
              }
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View 
              style={[
                styles.largeStatusCardShadow, 
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              <View style={[styles.largeStatusCardContent, isDark ? { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.05)' } : { borderColor: theme.border }]}>
                <LiquidGlassView style={StyleSheet.absoluteFillObject} fallbackColor={theme.card} />
              <View style={[styles.largeStatusIconBox, { backgroundColor: (stage === "on_bus" || stage === "arrived") ? "rgba(16, 185, 129, 0.15)" : (isDark ? 'rgba(59,130,246,0.15)' : theme.primaryLight) }]}>
                 {stage === "waiting_bus" ? (
                   <AdaptiveIcon iosSymbol="bus" fallbackFamily="FontAwesome6" fallbackName="bus-simple" size={40} color={theme.primary} />
                 ) : (
                   <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                     <Ionicons name="checkmark-circle" size={(stage === "on_bus" || stage === "arrived") ? 64 : 56} color="#10B981" />
                   </Animated.View>
                 )}
              </View>

              <View style={{ gap: 14, alignItems: "center", marginBottom: 24 }}>
                <Text style={[styles.largeStatusTitle, { color: theme.text }]}>{getStageTitle()}</Text>
                
                

                <Text style={[styles.largeStatusSubtitle, { color: theme.textMuted }]}>
                  {stage === "waiting_bus" 
                    ? formattedInstruction.displaySubtitle 
                    : stage === "arrived"
                    ? `Destino: ${stopName}`
                    : "Boa viagem. Eu aviso quando estiver perto de descer."}
                </Text>
                
                {stage === "waiting_bus" && !!stopName && stopName !== "ponto indicado" && (
                  <View style={[styles.stopNamePill, isDark && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                    <Ionicons name="location" size={16} color={isDark ? '#60A5FA' : theme.primary} />
                    <Text style={[styles.stopNameStatusText, { color: theme.text }]} numberOfLines={1}>Ponto: {stopName}</Text>
                  </View>
                )}

                {stage === "waiting_bus" && (
                  <Text style={[styles.helperText, { color: theme.textMuted }]}>Confira o número antes de embarcar.</Text>
                )}

                {stage === "waiting_bus" && (() => {
                  const hasEmPrefix = busCountdown.startsWith("em ");
                  const chegaLabel = hasEmPrefix ? "CHEGA EM" : "CHEGA";
                  const chegaValue = hasEmPrefix ? busCountdown.substring(3) : (busCountdown || "...");

                  return (
                    <View style={styles.infoCardsGrid}>
                      <LiquidGlassView style={styles.infoCard} fallbackColor={theme.card}>
                        <Text style={[styles.infoCardLabel, { color: theme.textMuted }]}>LINHA {busLine}</Text>
                        <Text style={[styles.infoCardValue, { color: theme.text, fontSize: 18 }]} numberOfLines={2} adjustsFontSizeToFit>{lineDetails || busLine}</Text>
                      </LiquidGlassView>
                      <LiquidGlassView style={styles.infoCard} fallbackColor={theme.card}>
                        <Text style={[styles.infoCardLabel, { color: theme.textMuted }]}>{chegaLabel}</Text>
                        <Text style={[styles.infoCardValue, { color: isDark ? '#60A5FA' : theme.primary }]} numberOfLines={1} adjustsFontSizeToFit>{chegaValue}</Text>
                        {!!stopName && stopName !== "ponto indicado" && (
                          <Text style={[styles.infoCardSubValue, { color: theme.textMuted }]} numberOfLines={2}>{stopName}</Text>
                        )}
                      </LiquidGlassView>
                    </View>
                  );
                })()}
              </View>
              </View>
            </Animated.View>
          </ScrollView>
        )}

        {/* Fixed Actions for Status Stages */}
        {(stage === "waiting_bus" || stage === "on_bus" || stage === "arrived") && (
          <Animated.View style={[styles.fixedStatusActionsShadow, { opacity: (stage === "on_bus" || stage === "arrived") ? buttonFadeAnim : fadeAnim }]} pointerEvents="box-none">
            <View style={[styles.fixedStatusActionsContent, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LiquidGlassView style={StyleSheet.absoluteFillObject} fallbackColor={theme.background} />
                <LinearGradient
                  colors={[isDark ? 'rgba(1, 16, 48, 0)' : 'rgba(241, 245, 249, 0)', theme.background]}
                  locations={[0.1, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
              <PrimaryButton title={getPrimaryButtonTitle()} onPress={() => handleStageTransition()} style={styles.mainButton} />
            <Pressable 
              style={styles.secondaryActionBtn} 
              onPress={() => speakControlled(formattedInstruction.speechText, true)}
              accessibilityLabel="Ouvir instrução"
              accessibilityRole="button"
            >
              <Ionicons name="volume-high" size={22} color={theme.primary} />
              <Text style={[styles.secondaryActionText, { color: theme.primary }]}>Ouvir instrução</Text>
            </Pressable>
            
            {(stage === "arrived") && (
              <Pressable 
                style={styles.tertiaryActionBtn} 
                onPress={() => router.replace("/inicio")}
                accessibilityLabel="Nova rota"
                accessibilityRole="button"
              >
                <Text style={styles.tertiaryActionText}>Nova rota</Text>
              </Pressable>
            )}
            </View>
          </Animated.View>
        )}

        {/* Bottom Card for Waiting Bus Stage */}
        {(stage === "waiting_bus") && (
          <View style={[styles.bottomCardShadow, { bottom: 20 }]} pointerEvents="box-none">
            <View style={[styles.bottomCardContent, { padding: 16, marginHorizontal: 16, borderRadius: 32 }]}>
              <LiquidGlassView style={StyleSheet.absoluteFillObject} fallbackColor={theme.card} />

              {/* Row 1: Header */}
              <View style={styles.waitingHeaderRow}>
                <View style={styles.waitingHeaderLeft}>
                  <View style={styles.checkCircleGreen}>
                    <Ionicons name="checkmark" size={16} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.waitingTitle, { color: theme.text }]} numberOfLines={2}>Você chegou ao ponto</Text>
                    <Text style={[styles.waitingSubtitle, { color: theme.textMuted }]} numberOfLines={1}>Aguarde no local • Ônibus a caminho</Text>
                  </View>
                </View>
                <View style={styles.confirmedPill}>
                  <Text style={styles.confirmedText}>Confirmado</Text>
                </View>
              </View>

              {/* Main Info Card */}
              <View style={[styles.waitingInnerCard, isDark ? { backgroundColor: 'rgba(255,255,255,0.05)' } : { backgroundColor: '#F8FAFC' }]}>
                {/* Info Top Row */}
                <View style={styles.waitingInnerTop}>
                  <View style={styles.waitingBusPill}>
                    <Ionicons name="bus" size={14} color="#2563EB" />
                    <Text style={styles.waitingBusPillText}>Linha {busLine}</Text>
                  </View>
                  <View style={styles.livePill}>
                    <View style={styles.greenDot} />
                    <Text style={styles.liveText}>AO VIVO</Text>
                  </View>
                </View>

                {/* Info Middle Row */}
                <View style={styles.waitingInnerMiddle}>
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <Text style={[styles.waitingDestTitle, { color: theme.text }]} numberOfLines={1}>{lineDetails || "Direção indicada"}</Text>
                    <Text style={[styles.waitingViaText, { color: theme.textMuted }]} numberOfLines={1}>Via {stopName || "Ponto indicado"}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.waitingTimeGiant}>{busCountdown.replace("em ", "")}</Text>
                    <Text style={[styles.waitingViaText, { color: theme.textMuted }]}>Previsão {new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</Text>
                  </View>
                </View>

                {/* Info Bottom Row */}
                <View style={styles.waitingInnerBottom}>
                  <Ionicons name="location" size={16} color="#2563EB" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.waitingParadaText, { color: theme.text }]}>
                      <Text style={{ fontWeight: "700" }}>Parada: </Text>{stopName || "Ponto indicado"}
                    </Text>
                    <Text style={[styles.waitingViaText, { color: theme.textMuted, marginTop: 4 }]} numberOfLines={2}>
                      🚪 Embarque pela porta dianteira • Letreiro frontal
                    </Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={{ gap: 12, marginTop: 20 }}>
                <PrimaryButton 
                  iconName="notifications"
                  title="Me notifique faltando 2 minutos" 
                  onPress={() => {
                     
                  }} 
                  style={[styles.mainButton, { borderRadius: 100, minHeight: 56, height: 56 }]} 
                />
                
                <Pressable 
                  style={({ pressed }) => [
                    styles.waitingSecondaryBtn, 
                    isDark ? { borderColor: 'rgba(255,255,255,0.1)' } : { borderColor: theme.border },
                    pressed && { opacity: 0.7 }
                  ]}
                  onPress={() => handleStageTransition()}
                >
                  <Text style={[styles.waitingSecondaryText, { color: "#2563EB" }]}>Já entrei no ônibus</Text>
                </Pressable>

                <Pressable 
                  style={({ pressed }) => [styles.waitingTertiaryBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => speakControlled(formattedInstruction.speechText, true)}
                >
                  <Ionicons name="volume-high-outline" size={18} color="#2563EB" />
                  <Text style={[styles.waitingTertiaryText, { color: "#2563EB" }]}>Ouvir status da linha em voz alta</Text>
                </Pressable>
              </View>

            </View>
          </View>
        )}

        {/* Bottom Card for Walking Stage */}

        {/* Bottom Card for Walking Stage */}
        {(stage === "walking") && (
          <View style={[styles.bottomCardShadow, { bottom: 0 }]} pointerEvents="box-none">
            <View 
              onLayout={(e) => setBottomCardHeight(e.nativeEvent.layout.height)}
              style={[styles.bottomCardContent, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}
            >
              <LiquidGlassView style={StyleSheet.absoluteFillObject} fallbackColor={theme.card} />
              <View style={[styles.dragHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : theme.border }]} />

            <View style={styles.bottomSheetHeader}>
              <Text style={[styles.bottomSheetLabel, { color: theme.text }]}>
                {(() => {
                  if (isWalkingOnly) return "Caminho até o destino";
                  const hasTransitAhead = allSteps.slice(globalStepIndex).some(s => s.type === "transit");
                  return hasTransitAhead ? "Caminho até o ponto" : "Caminho até o destino";
                })()}
              </Text>
              {!!stopName && stopName !== "ponto indicado" && (
                <Text style={[styles.stopNameText, { color: theme.textMuted }]} numberOfLines={1}>
                  {(() => {
                    if (isWalkingOnly) return `Destino: ${stopName}`;
                    const hasTransitAhead = allSteps.slice(globalStepIndex).some(s => s.type === "transit");
                    return hasTransitAhead ? `Ponto: ${stopName}` : `Destino Final`;
                  })()}
                </Text>
              )}
            </View>

            {showBusArrivalWarning && (
              <View style={styles.arrivalWarningBox}>
                <Ionicons name="alert-circle" size={16} color="#bd2a09" />
                <Text style={styles.arrivalWarningText}>O ônibus pode chegar antes de você.</Text>
              </View>
            )}

            {!isWalkingOnly && (() => {
              const hasTransitAhead = allSteps.slice(globalStepIndex).some(s => s.type === "transit");
              if (!hasTransitAhead) return null;
              
              const hasEmPrefix = busCountdown.startsWith("em ");
              const chegaLabel = hasEmPrefix ? "CHEGA EM" : "CHEGA";
              const chegaValue = hasEmPrefix ? busCountdown.substring(3) : (busCountdown || "...");

              return (
                <View style={styles.infoCardsGrid}>
                  <LiquidGlassView style={styles.infoCard} fallbackColor={theme.card}>
                    <Text style={[styles.infoCardLabel, { color: theme.textMuted }]}>LINHA {busLine}</Text>
                    <Text style={[styles.infoCardValue, { color: theme.text, fontSize: 16 }]} numberOfLines={1} adjustsFontSizeToFit>{lineDetails || busLine}</Text>
                  </LiquidGlassView>
                  <LiquidGlassView style={styles.infoCard} fallbackColor={theme.card}>
                    <Text style={[styles.infoCardLabel, { color: theme.textMuted }]}>{chegaLabel}</Text>
                    <Text style={[styles.infoCardValue, { color: isDark ? '#60A5FA' : theme.primary, fontSize: 18 }]} numberOfLines={1} adjustsFontSizeToFit>{chegaValue}</Text>
                    {!!stopName && stopName !== "ponto indicado" && (
                      <Text style={[styles.infoCardSubValue, { color: theme.textMuted }]} numberOfLines={1}>{stopName}</Text>
                    )}
                  </LiquidGlassView>
                </View>
              );
            })()}
            <View style={styles.actionArea}>
              <PrimaryButton 
                title={getPrimaryButtonTitle()} 
                onPress={handleStageTransition} 
                style={styles.mainButton} 
                accessibilityLabel={getPrimaryButtonTitle()}
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
        </View>
        )}
      </View>

      
      {/* ON BUS FULL SCREEN OVERLAY */}
      {stage === "on_bus" && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? theme.background : "#F8FAFC", zIndex: 999, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}>
            {/* Header */}
            <View style={styles.onBusHeader}>
              <Pressable onPress={handleSair} style={styles.onBusBackBtn}>
                <Ionicons name="chevron-back" size={24} color="#2563EB" />
              </Pressable>
              <Text style={[styles.onBusHeaderTitle, { color: theme.text }]}>Live Journey Tracking</Text>
              
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable style={styles.onBusHeaderSpeaker} onPress={() => speakControlled(formattedInstruction.speechText, true)}>
                  <Ionicons name="volume-high" size={16} color="#2563EB" />
                  <Text style={styles.onBusHeaderSpeakerText}>Ouvir</Text>
                </Pressable>
                <View style={styles.onBusHeaderAvatar}>
                  <Ionicons name="person-outline" size={16} color="#FFFFFF" />
                </View>
              </View>
            </View>

            {/* Content */}
            <View style={styles.onBusContent}>
              <View style={styles.onBusIconRings}>
                <View style={styles.onBusIconRingOuter}>
                  <View style={styles.onBusIconRingInner}>
                    <View style={styles.onBusIconSolid}>
                      <Ionicons name="checkmark" size={32} color="#FFFFFF" />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.onBusBadge}>
                <Ionicons name="bus" size={16} color="#1E3A8A" />
                <Text style={styles.onBusBadgeText}>Embarque Confirmado</Text>
              </View>

              <Text style={[styles.onBusGiantTitle, { color: theme.text }]}>Boa viagem!</Text>
              
              <Text style={[styles.onBusDescription, { color: theme.textMuted }]}>
                Você já está a bordo da <Text style={{ fontWeight: "800", color: theme.text }}>Linha {busLine}</Text>. O RotaBus guiou seus passos com segurança até o ponto.
              </Text>

              <View style={styles.onBusFeedbackBox}>
                <Text style={[styles.onBusFeedbackTitle, { color: theme.text }]}>Como foi o trajeto a pé até o ponto?</Text>
                <Text style={[styles.onBusFeedbackSubtitle, { color: theme.textMuted }]}>Sua avaliação calibra a precisão dos alertas.</Text>
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={styles.onBusBottomActions}>
              <PrimaryButton 
                iconName="checkmark-done"
                title="Concluir e voltar ao início" 
                onPress={() => router.replace("/inicio")}
                style={{ borderRadius: 100, minHeight: 64, height: 64, width: "100%" }} 
              />
              <Pressable 
                style={({ pressed }) => [styles.onBusSecondaryBtn, pressed && { opacity: 0.7 }]}
                onPress={() => speakControlled("Você já está a bordo da Linha. Boa viagem!", true)}
              >
                <Ionicons name="volume-high-outline" size={20} color="#2563EB" />
                <Text style={styles.onBusSecondaryText}>Ouvir aviso de boa viagem</Text>
              </Pressable>
            </View>
        </View>
      )}

      <Modal visible={showExitModal} transparent animationType="fade">

        <LiquidGlassView style={styles.modalOverlay} fallbackColor="rgba(0,0,0,0.7)">
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Sair da navegação?</Text>
            <View style={styles.modalActions}>
              <PrimaryButton title="Continuar navegando" onPress={() => setShowExitModal(false)} />
              <Pressable onPress={confirmExit} style={styles.confirmExitBtn}>
                <Text style={[styles.confirmExitText, { color: theme.danger }]}>Sim, encerrar</Text>
              </Pressable>
            </View>
          </View>
        </LiquidGlassView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: "absolute", left: 0, right: 0, zIndex: 100 },
  topBarInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  glassPill: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 14, 
    paddingVertical: 9, 
    borderRadius: 22, 
    borderWidth: 1, 
    gap: 6, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 8, 
    elevation: 6 
  },
  glassPillText: { fontWeight: "800", fontSize: 14, letterSpacing: -0.2 },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  instructionCardContainer: { position: "absolute", left: 16, right: 16, zIndex: 90, gap: 8 },
  instructionCardShadow: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  instructionCardContent: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22, alignItems: "center", borderWidth: 1 },
  iconCircle: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  instructionTextContent: { flex: 1 },
  instructionTitle: { fontSize: 16, fontWeight: "900", letterSpacing: -0.3, lineHeight: 22 },
  instructionSubtitle: { fontSize: 15, fontWeight: "700", marginTop: 1 },
  warningPill: { flexDirection: "row", alignSelf: "flex-start", backgroundColor: "#FEF3C7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6, alignItems: "center", borderWidth: 1, borderColor: "#FDE68A" },
  warningPillText: { fontSize: 13, fontWeight: "800", color: "#B45309" },
  bottomCardShadow: { position: "absolute", left: 0, right: 0, elevation: 20, shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  bottomCardContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 8, overflow: "hidden", borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.02)" },
  dragHandle: { width: 36, height: 3.5, borderRadius: 2, alignSelf: "center", marginBottom: 6, zIndex: 2 },
  bottomSheetHeader: { marginBottom: 8, alignItems: 'center', zIndex: 2 },
  bottomSheetLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  stopNameText: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  arrivalWarningBox: { flexDirection: "row", backgroundColor: "rgba(254, 243, 199, 0.4)", padding: 8, borderRadius: 12, alignItems: "center", gap: 6, marginBottom: 8, borderWidth: 1, borderColor: "rgba(253, 230, 138, 0.5)", zIndex: 2 },
  arrivalWarningText: { fontSize: 13, fontWeight: "700", color: "#B45309", flex: 1 },
  actionArea: { gap: 6, alignItems: "center", width: "100%", zIndex: 2 },
  mainButton: { height: 50, borderRadius: 25 },
  ttsWrapper: { opacity: 0.9 },
  statusContentContainer: { flexGrow: 1, paddingHorizontal: 20, zIndex: 2, justifyContent: "center" },
  largeStatusCardShadow: { shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  largeStatusCardContent: { borderRadius: 32, borderWidth: 1, overflow: "hidden", paddingTop: 20, paddingBottom: 24, paddingHorizontal: 16 },
  largeStatusIconBox: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20, alignSelf: "center" },
  largeStatusTitle: { fontSize: 26, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
  boardedConfirmation: { fontSize: 18, fontWeight: "700", color: "#475569", textAlign: "center" },
  stopNamePill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.03)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, gap: 6, maxWidth: "90%", marginTop: 4 },
  stopNameStatusText: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  largeStatusSubtitle: { fontSize: 17, fontWeight: "500", textAlign: "center", color: "#64748B", lineHeight: 24, paddingHorizontal: 16 },
  helperText: { fontSize: 15, fontWeight: "600", textAlign: "center", color: "#94A3B8" },
  infoCardsGrid: { flexDirection: "row", gap: 8, marginBottom: 8 },
  infoCard: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, alignItems: "flex-start", borderWidth: 1 },
  infoCardLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 2, letterSpacing: 0.5 },
  infoCardValue: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  infoCardSubValue: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  fixedStatusActionsShadow: { position: "absolute", bottom: 0, left: 0, right: 0, shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
  fixedStatusActionsContent: { paddingHorizontal: 24, paddingTop: 16, borderTopLeftRadius: 32, borderTopRightRadius: 32, gap: 12, overflow: "hidden", borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.02)" },
  secondaryActionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8 },
  secondaryActionText: { fontSize: 17, fontWeight: "800" },
  tertiaryActionBtn: { alignItems: "center", paddingVertical: 8 },
  tertiaryActionText: { fontSize: 15, fontWeight: "700", color: "#94A3B8", textDecorationLine: "underline" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalContent: { backgroundColor: "white", borderRadius: 32, padding: 32, width: "100%", alignItems: "center" },
  modalTitle: { fontSize: 24, fontWeight: "900", marginBottom: 24, color: "#011030", textAlign: "center" },
  modalActions: { width: "100%" },
  confirmExitBtn: { marginTop: 20, paddingVertical: 8, alignSelf: "center" },
  confirmExitText: { color: "#f21515", fontWeight: "800", fontSize: 20 },

  // Novos Estilos do Card Flutuante (Walking)
  walkingCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  walkingCardIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 16,
  },
  walkingCardMainText: {
    fontSize: 18,
    fontWeight: "800",
    flexShrink: 1,
  },
  walkingTimePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  walkingTimeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  busLineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  busLineCircleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  walkingCardSubText: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  walkingStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  walkingStatusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },
  walkingActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  // Novos Estilos do Card Flutuante (Waiting Bus)
  waitingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  waitingHeaderLeft: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  checkCircleGreen: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  waitingSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
  confirmedPill: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  confirmedText: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
  },
  waitingInnerCard: {
    borderRadius: 24,
    padding: 16,
  },
  waitingInnerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  waitingBusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  waitingBusPillText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "700",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveText: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "800",
  },
  waitingInnerMiddle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    paddingBottom: 12,
    marginBottom: 12,
  },
  waitingDestTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  waitingViaText: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  waitingTimeGiant: {
    fontSize: 32,
    fontWeight: "900",
    color: "#2563EB",
    lineHeight: 36,
  },
  waitingInnerBottom: {
    flexDirection: "row",
    gap: 8,
  },
  waitingParadaText: {
    fontSize: 14,
    lineHeight: 20,
  },
  waitingSecondaryBtn: {
    height: 56,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  waitingSecondaryText: {
    fontSize: 16,
    fontWeight: "700",
  },
  waitingTertiaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
  },
  waitingTertiaryText: {
    fontSize: 15,
    fontWeight: "600",
  },


  // Novos Estilos Tela Cheia (On Bus)
  onBusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  onBusBackBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  onBusHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  onBusHeaderSpeaker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  onBusHeaderSpeakerText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "700",
  },
  onBusHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
  },
  onBusContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  onBusIconRings: {
    marginBottom: 24,
  },
  onBusIconRingOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  onBusIconRingInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  onBusIconSolid: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
  },
  onBusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0EAFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 24,
  },
  onBusBadgeText: {
    color: "#1E3A8A",
    fontSize: 14,
    fontWeight: "800",
  },
  onBusGiantTitle: {
    fontSize: 40,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  onBusDescription: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  onBusFeedbackBox: {
    alignItems: "center",
  },
  onBusFeedbackTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  onBusFeedbackSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  onBusBottomActions: {
    paddingHorizontal: 20,
    gap: 16,
  },
  onBusSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    height: 64,
    borderRadius: 100,
    gap: 8,
  },
  onBusSecondaryText: {
    color: "#1E40AF",
    fontSize: 16,
    fontWeight: "700",
  }

});
