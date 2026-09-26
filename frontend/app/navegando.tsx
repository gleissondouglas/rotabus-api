
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
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { PrimaryButton } from "../src/components/PrimaryButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { useThemeColors } from "../src/theme/colors";
import Map from "../src/components/Map";
import { LiquidGlassView } from "../src/components/LiquidGlassView";
import { LinearGradient } from "expo-linear-gradient";
import { BackgroundGradient } from "../src/components/BackgroundGradient";
import { AdaptiveIcon } from "../src/components/AdaptiveIcon";
import { MarqueeText } from "../src/components/MarqueeText";
import { speak } from "../src/services/speech.service";
import { MapData } from "../src/types/journey.types";
import { formatBusWaitingTimeToFriendlyTextShort, formatMinutesToFriendlyText } from "../src/utils/date-time";
import { formatWalkingInstruction } from "../src/utils/navigationInstructionFormatter";
import { parseJsonParam, calculateDistance } from "../src/utils/helpers";
import { trackingService } from "../src/services/tracking.service";
import { logUserInteraction } from "../src/utils/devLogger";

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
  const [isBusReminderSet, setIsBusReminderSet] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [bottomCardHeight, setBottomCardHeight] = useState(260);
  const [onBusFeedback, setOnBusFeedback] = useState<"facil" | "tranquilo" | "dificil" | null>("tranquilo");

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
  const didAlertBusApproaching = useRef(false);
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

  const stopDisplayName = useMemo(() => {
    if (stopName && stopName !== "ponto indicado") {
      return stopName;
    }
    if (isWalkingOnly) {
      return "Destino Final";
    }
    return "Ponto de Embarque";
  }, [stopName, isWalkingOnly]);

  const formattedBusArrival = useMemo(() => {
    if (targetStopDateTime) {
      try {
        const d = new Date(targetStopDateTime);
        if (!isNaN(d.getTime())) {
          const hours = d.getHours();
          const minutes = String(d.getMinutes()).padStart(2, "0");
          return `Chega ${hours}h${minutes}`;
        }
      } catch {}
    }
    if (busCountdownDiff !== null && busCountdownDiff > 0) {
      try {
        const d = new Date(Date.now() + busCountdownDiff * 60000);
        const hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return `Chega ${hours}h${minutes}`;
      } catch {}
    }
    if (busCountdown) {
      const cleanCountdown = busCountdown.replace(/^em\s+/i, "");
      return `Chega ${cleanCountdown}`;
    }
    return "No horário";
  }, [targetStopDateTime, busCountdownDiff, busCountdown]);

  const displayCountdownText = useMemo(() => {
    if (busCountdownDiff !== null && busCountdownDiff > 0) {
      return formatMinutesToFriendlyText(busCountdownDiff);
    }
    if (busCountdown) {
      const clean = busCountdown.replace(/^em\s+/i, "").trim();
      if (clean) return clean;
    }
    return "3 min";
  }, [busCountdownDiff, busCountdown]);

  const predictedArrivalHour = useMemo(() => {
    if (targetStopDateTime) {
      try {
        const d = new Date(targetStopDateTime);
        if (!isNaN(d.getTime())) {
          const timeString = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `Chega às ${timeString}`;
        }
      } catch {}
    }
    if (busCountdownDiff !== null && busCountdownDiff > 0) {
      const d = new Date(Date.now() + busCountdownDiff * 60000);
      const timeString = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `Chega às ${timeString}`;
    }
    const d = new Date(Date.now() + 3 * 60000);
    const timeString = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `Chega às ${timeString}`;
  }, [targetStopDateTime, busCountdownDiff]);

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
      maneuver: currentStep?.maneuver,
      destinationStreet: stopDisplayName || stopName
    });
  }, [stage, hasValidWalkRoute, allSteps, globalStepIndex, stopName, stopDisplayName, userLocation, busLine, lineDetails]);

  // Título da instrução com o nome da rua ou parada para evitar ficar apenas 'Siga'
  const walkInstructionTitle = useMemo(() => {
    let title = formattedInstruction.displayTitle || "Siga pelo caminho";
    const isGenericSiga = /^(siga|siga em frente|siga pelo caminho)$/i.test(title.trim());
    if (isGenericSiga) {
      const streetOrStop = stopDisplayName || stopName;
      if (streetOrStop && streetOrStop !== "ponto indicado" && streetOrStop !== "Destino Final") {
        if (/^(rua|av|avenida|praça|alameda|rodovia|travessa|beco|estrada)/i.test(streetOrStop.trim())) {
          title = `Siga pela ${streetOrStop}`;
        } else {
          title = `Siga até ${streetOrStop}`;
        }
      }
    }
    return title;
  }, [formattedInstruction.displayTitle, stopDisplayName, stopName]);

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

  // Efeito para disparar o alarme de 2 minutos do ônibus
  useEffect(() => {
    if (isBusReminderSet && busCountdownDiff !== null && busCountdownDiff <= 2 && busCountdownDiff > 0) {
      if (!didAlertBusApproaching.current) {
        didAlertBusApproaching.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        speakControlled(`Atenção! O ônibus da linha ${busLine} está se aproximando. Prepare-se para embarcar.`, true);
      }
    }
    // Reseta caso o botão seja desligado ou o tempo volte a subir (refresh)
    if (!isBusReminderSet || (busCountdownDiff !== null && busCountdownDiff > 2)) {
      didAlertBusApproaching.current = false;
    }
  }, [isBusReminderSet, busCountdownDiff, busLine, speakControlled]);

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
    // Validação de segurança de distância para descida do ônibus
    if (forced !== true && userLocation) {
      if (stage === "on_bus" && currentGlobalStep?.type === "transit") {
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
        speakControlled(`Você chegou ao ponto. Aguarde o ônibus ${nextTransitStep.line || busLine}.`, true);
      } else {
        setStage("arrived");
        speakControlled("Você chegou ao seu destino.", true);
      }
    } else if (stage === "waiting_bus") {
      setStage("on_bus");
      const nextTransitIndex = allSteps.findIndex((s, idx) => idx >= globalStepIndex && s.type === "transit");
      if (nextTransitIndex !== -1) {
        setGlobalStepIndex(nextTransitIndex);
      }
      speakControlled(`Você embarcou no ônibus Linha ${busLine}. Boa viagem! Eu aviso quando estiver perto de descer.`, true);
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

  const handleToggleReminder = () => {
    logUserInteraction({
      component: "WaitingBusReminderButton",
      label: isBusReminderSet ? "Alerta 2 min desativado" : "Alerta 2 min Ativado",
      fileOrScreen: "app/navegando.tsx",
      action: "Alternar lembrete de chegada de ônibus",
    });
    const nextState = !isBusReminderSet;
    setIsBusReminderSet(nextState);
    if (nextState) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      speakControlled("Tudo bem! Vou te avisar 2 minutos antes do ônibus chegar ao ponto.", true);
    } else {
      speakControlled("Lembrete desativado.", true);
    }
  };

  const handleEnteredBus = () => {
    logUserInteraction({
      component: "WaitingBusEnteredButton",
      label: "Já entrei no ônibus",
      fileOrScreen: "app/navegando.tsx",
      action: "Confirmar embarque no ônibus",
    });
    handleStageTransition(true);
  };

  const handleListenStatus = () => {
    logUserInteraction({
      component: "WaitingBusListenStatusButton",
      label: "Ouvir status da linha",
      fileOrScreen: "app/navegando.tsx",
      action: "Ouvir status da linha por voz",
    });
    const statusText = `Você chegou ao ponto. O ônibus da Linha ${busLine} com destino a ${lineDetails || 'seu itinerário'} chega em aproximadamente ${displayCountdownText}. Aguarde no local.`;
    speakControlled(statusText, true);
  };

  const getPrimaryButtonTitle = () => {
    switch (stage) {
      case "walking": 
        const hasTransitAhead = allSteps.slice(globalStepIndex).some(s => s.type === "transit");
        return hasTransitAhead ? "Cheguei ao ponto" : "Cheguei ao destino";
      case "waiting_bus": return "Já entrei no ônibus";
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
          focusMode={stage === "waiting_bus" ? "waiting_bus" : (stage === "on_bus" ? "on_bus" : (isWalkingOnly ? "walking_to_destination" : "walking_to_stop"))} 
          controlsBottomOffset={bottomCardHeight}
          walkSteps={allSteps}
          currentStepIndex={globalStepIndex}
          isNavigating={true}
          hideControls={stage === "on_bus" || stage === "arrived"}
          busLine={busLine}
          isWaitingBus={stage === "waiting_bus"}
        />
      </View>

      {/* Top Bar (Floating Glass Pills over Map) */}
      <View style={[styles.topBar, { top: insets.top + 10 }]} pointerEvents="box-none">
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
                    ? { backgroundColor: "rgba(25, 28, 34, 0.85)", borderColor: "rgba(255, 255, 255, 0.15)" } 
                    : { backgroundColor: "rgba(255, 255, 255, 0.90)", borderColor: "rgba(255, 255, 255, 0.95)" }
                ]} 
                fallbackColor={theme.card}
              >
                <Ionicons 
                  name="chevron-back" 
                  size={18} 
                  color={stage === "waiting_bus" ? (isDark ? '#0A84FF' : '#007AFF') : theme.text} 
                />
                <Text 
                  style={[
                    styles.glassPillText, 
                    { 
                      color: stage === "waiting_bus" ? (isDark ? '#0A84FF' : '#007AFF') : theme.text,
                      fontWeight: stage === "waiting_bus" ? '700' : '600'
                    }
                  ]}
                >
                  Voltar
                </Text>
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
                  ? { backgroundColor: "rgba(25, 28, 34, 0.85)", borderColor: "rgba(255, 255, 255, 0.15)" } 
                  : { backgroundColor: "rgba(255, 255, 255, 0.90)", borderColor: "rgba(255, 255, 255, 0.95)" }
              ]} 
              fallbackColor={theme.card}
            >
              {stage === "waiting_bus" ? (
                <View style={styles.topBarLiveGroup}>
                  <View style={styles.topBarGreenDot} />
                  <Text style={[styles.topBarLiveBusText, { color: theme.text, flexShrink: 1 }]} numberOfLines={1}>
                    {lineDetails || `Linha ${busLine}`}
                  </Text>
                </View>
              ) : (
                <>
                  <AdaptiveIcon
                    iosSymbol="figure.walk"
                    fallbackFamily="FontAwesome6"
                    fallbackName="person-walking"
                    size={14}
                    color={isDark ? '#60A5FA' : theme.primary}
                  />
                  <Text style={[styles.glassPillText, { color: theme.text }]}>
                    {`${formatMinutesToFriendlyText(Number(walkTimeMinutes))} caminhando`}
                  </Text>
                </>
              )}
            </LiquidGlassView>
          )}
        </View>
      </View>

      {/* Instruction Card (Fixed during walking) */}
      {(stage === "walking") && (
        <View style={[styles.instructionCardContainer, { top: insets.top + 66 }]} pointerEvents="box-none">
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
                  <MarqueeText
                    style={[styles.instructionTitle, { color: theme.text }]}
                    speed={32}
                    delay={1400}
                  >
                    {walkInstructionTitle}
                  </MarqueeText>
                  <Text style={[styles.instructionSubtitle, { color: theme.textMuted }]}>{formattedInstruction.displaySubtitle}</Text>
                </View>
              </LiquidGlassView>
            </View>
          </Pressable>
        </View>
      )}

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Status Content (Scrollable) */}
        {(stage === "on_bus" || stage === "arrived") && (
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
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <Ionicons name="checkmark-circle" size={(stage === "on_bus" || stage === "arrived") ? 64 : 56} color="#10B981" />
                </Animated.View>
              </View>

              <View style={{ gap: 14, alignItems: "center", marginBottom: 24 }}>
                <Text style={[styles.largeStatusTitle, { color: theme.text }]}>{getStageTitle()}</Text>

                <Text style={[styles.largeStatusSubtitle, { color: theme.textMuted }]}>
                  {stage === "arrived"
                    ? `Destino: ${stopName}`
                    : "Boa viagem. Eu aviso quando estiver perto de descer."}
                </Text>
              </View>
              </View>
            </Animated.View>
          </ScrollView>
        )}

        {/* Fixed Actions for Status Stages */}
        {(stage === "on_bus" || stage === "arrived") && (
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
          <View 
            style={[styles.waitingCardShadow, { bottom: Math.max(insets.bottom, 12) + 6 }]} 
            pointerEvents="box-none"
          >
            <LiquidGlassView 
              onLayout={(e) => setBottomCardHeight(e.nativeEvent.layout.height + insets.bottom + 18)}
              disableDefaultStyles
              style={[
                styles.waitingCardContent,
                isDark 
                  ? { backgroundColor: 'rgba(25, 28, 34, 0.55)', borderColor: 'rgba(255, 255, 255, 0.12)' }
                  : { backgroundColor: 'rgba(255, 255, 255, 0.75)', borderColor: 'rgba(255, 255, 255, 0.80)' }
              ]}
              fallbackColor={theme.card}
            >

              {/* Row 1: Header */}
              <View style={styles.waitingHeaderRow}>
                <View style={styles.waitingHeaderLeft}>
                  <View style={[styles.waitingCheckCircle, isDark && styles.waitingCheckCircleDark]}>
                    <Ionicons name="checkmark" size={16} color={isDark ? '#34D399' : '#10B981'} />
                  </View>
                  <Text style={[styles.waitingTitle, { color: theme.text }]}>Previsão</Text>
                </View>

                <View style={styles.waitingHeaderRight}>
                  <Text style={[styles.waitingGiantCountdown, { color: isDark ? '#0A84FF' : '#007AFF' }]} adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1}>
                    {displayCountdownText}
                  </Text>
                  <Text style={[styles.waitingPredictionText, { color: theme.textMuted }]}>
                    {predictedArrivalHour}
                  </Text>
                </View>
              </View>

              {/* Row 2: Mini Card Interno do Ônibus */}
              <View style={[styles.waitingInnerCard, isDark ? styles.waitingInnerCardDark : styles.waitingInnerCardLight]}>
                {/* Chip da Linha */}
                <View style={[styles.waitingLineChip, isDark ? styles.waitingLineChipDark : styles.waitingLineChipLight]}>
                  <Text style={[styles.waitingLineChipText, { color: isDark ? '#60A5FA' : '#007AFF' }]}>
                    Linha {busLine}
                  </Text>
                </View>

                {/* Destino / Itinerário */}
                <View style={styles.waitingDestContainer}>
                  <Text style={[styles.waitingDestTitle, { color: theme.text }]}>
                    {lineDetails || "Parque dos Girassóis"}
                  </Text>
                </View>

                {/* Endereço da Parada com Pino */}
                <View style={styles.waitingStopAddressRow}>
                  <Ionicons name="location-sharp" size={14} color={isDark ? '#60A5FA' : '#007AFF'} style={{ marginRight: 4, marginTop: 1 }} />
                  <Text style={[styles.waitingStopAddressText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                    {stopDisplayName}
                  </Text>
                </View>

                {/* Via / Instrução */}
                {(direction && direction !== "--" || activeTransitStep?.via) && (
                  <Text style={[styles.waitingViaDetailText, { color: theme.textMuted }]}>
                    Via {direction && direction !== "--" ? direction : (activeTransitStep?.via || "Santos Dumont")}
                  </Text>
                )}
              </View>

              {/* Row 3: Ações e Botões Inferiores (Thumb Zone) */}
              <View style={styles.waitingActionsCol}>
                {/* Botão Primário: Notificação */}
                <Pressable
                  onPress={handleToggleReminder}
                  accessibilityRole="button"
                  accessibilityLabel={isBusReminderSet ? "Cancelar alerta de 2 minutos" : "Me notificar 2 minutos antes"}
                  style={({ pressed }) => [
                    styles.waitingPrimaryBtn,
                    isBusReminderSet
                      ? { backgroundColor: "transparent", borderWidth: 2, borderColor: isDark ? '#EF4444' : '#DC2626' }
                      : { backgroundColor: isDark ? '#0A84FF' : '#007AFF', borderWidth: 2, borderColor: 'transparent' },
                    pressed && { opacity: 0.85 }
                  ]}
                >
                  <Text style={[
                    styles.waitingPrimaryBtnText,
                    isBusReminderSet && { color: isDark ? '#EF4444' : '#DC2626' }
                  ]}>
                    {isBusReminderSet ? "Cancelar Alerta" : "Notificar 2 min antes"}
                  </Text>
                </Pressable>

                {/* Botões Secundários Agrupados na mesma linha */}
                <View style={{ flexDirection: "row", gap: 8, alignItems: 'stretch' }}>
                  <Pressable
                    onPress={handleEnteredBus}
                    accessibilityRole="button"
                    accessibilityLabel="Já entrei no ônibus"
                    style={({ pressed }) => [
                      styles.waitingSecondaryBtn,
                      isDark ? styles.waitingSecondaryBtnDark : styles.waitingSecondaryBtnLight,
                      pressed && { opacity: 0.75 },
                      { flex: 1 }
                    ]}
                  >
                    <Text style={[styles.waitingSecondaryBtnText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                      Já entrei no ônibus
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleListenStatus}
                    accessibilityRole="button"
                    accessibilityLabel="Ouvir status da linha em voz alta"
                    style={({ pressed }) => [
                      styles.waitingSecondaryBtn,
                      isDark ? styles.waitingSecondaryBtnDark : styles.waitingSecondaryBtnLight,
                      pressed && { opacity: 0.75 },
                      { width: 56, paddingVertical: 0, justifyContent: 'center', alignItems: 'center' }
                    ]}
                  >
                    <Ionicons 
                      name="volume-high-outline" 
                      size={26} 
                      color={isDark ? '#FFFFFF' : '#111827'} 
                    />
                  </Pressable>
                </View>
              </View>

            </LiquidGlassView>
          </View>
        )}

        {/* Bottom Card for Walking Stage */}

        {/* Floating Bottom Card for Walking Stage (Design Ref: Opção 2) */}
        {(stage === "walking") && (
          <View 
            style={[styles.floatingBottomCardShadow, { bottom: Math.max(insets.bottom, 12) + 6 }]} 
            pointerEvents="box-none"
          >
            <LiquidGlassView 
              onLayout={(e) => setBottomCardHeight(e.nativeEvent.layout.height + insets.bottom + 18)}
              disableDefaultStyles
              style={[
                styles.floatingBottomCardContent, 
                { 
                  backgroundColor: isDark ? 'rgba(25, 28, 34, 0.55)' : 'rgba(255, 255, 255, 0.75)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.80)',
                }
              ]}
              fallbackColor={theme.card}
            >

              {/* Linha 1: Ponto / Destino + Previsão de Chegada */}
              <View style={styles.floatingCardHeaderRow}>
                <View style={styles.floatingStopNameGroup}>
                  <Ionicons name="location" size={18} color="#2563EB" style={{ marginRight: 6 }} />
                  <View style={{ flex: 1 }}>
                    <MarqueeText
                      style={[styles.floatingStopNameText, { color: theme.text }]}
                      speed={32}
                      delay={1400}
                    >
                      {stopDisplayName}
                    </MarqueeText>
                  </View>
                </View>
                {!isWalkingOnly && (
                  <View style={[styles.floatingArrivalPill, isDark && { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
                    <Ionicons name="time-outline" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                    <Text style={[styles.floatingArrivalPillText, isDark && { color: '#60A5FA' }]}>
                      {formattedBusArrival}
                    </Text>
                  </View>
                )}
              </View>

              {/* Linha 2: Linha + Destino + Status */}
              {!isWalkingOnly && (
                <View style={styles.floatingCardMiddleRow}>
                  <View style={styles.floatingBusInfoGroup}>
                    <View style={styles.floatingBusLineBadge}>
                      <Text style={styles.floatingBusLineBadgeText}>{busLine}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <MarqueeText
                        style={[styles.floatingBusDestText, { color: theme.textMuted }]}
                        speed={28}
                        delay={1800}
                      >
                        {lineDetails || busLine}
                      </MarqueeText>
                    </View>
                  </View>
                  <View style={styles.floatingStatusGroup}>
                    <View 
                      style={[
                        styles.floatingStatusDot, 
                        { backgroundColor: showBusArrivalWarning ? '#F59E0B' : '#10B981' }
                      ]} 
                    />
                    <Text 
                      style={[
                        styles.floatingStatusText, 
                        { color: showBusArrivalWarning ? '#D97706' : '#059669' }
                      ]}
                    >
                      {showBusArrivalWarning ? 'Pode adiantar' : 'No horário'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Linha 3: Botões de Ação lado a lado */}
              <View style={styles.floatingCardActionsRow}>
                <PrimaryButton 
                  title={getPrimaryButtonTitle()} 
                  onPress={() => {
                    logUserInteraction({
                      component: "PrimaryButton",
                      label: getPrimaryButtonTitle(),
                      fileOrScreen: "app/navegando.tsx",
                      action: "Avançar estágio de navegação",
                    });
                    handleStageTransition();
                  }} 
                  style={styles.floatingMainButton} 
                  accessibilityLabel={getPrimaryButtonTitle()}
                />
                <Pressable
                  onPress={() => {
                    logUserInteraction({
                      component: "NavigatingVoiceButton",
                      label: "Ouvir caminho",
                      fileOrScreen: "app/navegando.tsx",
                      action: "Tocar instrução por voz",
                    });
                    speakControlled(formattedInstruction.speechText, true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Ouvir instrução de caminho por voz"
                  style={({ pressed }) => [
                    styles.floatingVoiceIconButton,
                    isDark && { backgroundColor: 'rgba(37, 99, 235, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' },
                    pressed && { opacity: 0.7 }
                  ]}
                >
                  <Ionicons name="volume-high" size={24} color="#2563EB" />
                </Pressable>
              </View>

            </LiquidGlassView>
          </View>
        )}
      </View>

      
      {/* ON BUS FULL SCREEN OVERLAY */}
      {stage === "on_bus" && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? theme.background : "transparent", zIndex: 999, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }]}>
            {!isDark && <BackgroundGradient />}
            {/* Header */}
            <View style={styles.onBusHeader}>
              <Pressable onPress={handleSair} style={[styles.onBusHeaderPill, { backgroundColor: theme.card }]}>
                <Ionicons name="chevron-back" size={18} color="#2563EB" />
                <Text style={[styles.onBusHeaderPillText, { color: theme.text }]}>Voltar</Text>
              </Pressable>
              
              <Pressable style={[styles.onBusHeaderPill, { backgroundColor: theme.card }]} onPress={() => speakControlled("Você já está a bordo da Linha. Boa viagem!", true)}>
                <Ionicons name="volume-high" size={18} color="#2563EB" />
                <Text style={[styles.onBusHeaderPillText, { color: "#2563EB" }]}>Ouvir</Text>
              </Pressable>
            </View>

            {/* Content */}
            <View style={styles.onBusContent}>

              <View style={[styles.onBusBadge, { backgroundColor: isDark ? theme.card : "#FFFFFF" }]}>
                <Ionicons name="bus" size={16} color="#2563EB" />
                <Text style={[styles.onBusBadgeText, { color: isDark ? theme.text : "#0F172A" }]}>EMBARQUE CONFIRMADO</Text>
              </View>

              <Text style={[styles.onBusGiantTitle, { color: theme.text }]}>Boa viagem!</Text>
              
              <Text style={[styles.onBusDescription, { color: theme.textMuted }]}>
                Você já está a bordo da <Text style={{ fontWeight: "800", color: theme.text }}>Linha {busLine}</Text>. O RotaBus guiou seus passos com segurança até o ponto.
              </Text>

              <View style={[styles.onBusFeedbackBox, { backgroundColor: theme.card, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
                <Text style={[styles.onBusFeedbackTitle, { color: theme.text }]}>Como foi o trajeto a pé até o ponto?</Text>
                <Text style={[styles.onBusFeedbackSubtitle, { color: theme.textMuted }]}>Sua avaliação calibra a precisão dos alertas.</Text>
                
                <View style={styles.onBusFeedbackOptions}>
                  <Pressable 
                    style={[styles.onBusFeedbackOption, onBusFeedback === "facil" && styles.onBusFeedbackOptionSelected, { backgroundColor: onBusFeedback === "facil" ? (isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF") : "transparent", borderColor: onBusFeedback === "facil" ? "#93C5FD" : (isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9") }]} 
                    onPress={() => setOnBusFeedback("facil")}
                  >
                    <Text style={styles.onBusFeedbackEmoji}>😊</Text>
                    <Text style={[styles.onBusFeedbackOptionText, { color: theme.text }]}>Fácil</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.onBusFeedbackOption, onBusFeedback === "tranquilo" && styles.onBusFeedbackOptionSelected, { backgroundColor: onBusFeedback === "tranquilo" ? (isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF") : "transparent", borderColor: onBusFeedback === "tranquilo" ? "#93C5FD" : (isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9") }]} 
                    onPress={() => setOnBusFeedback("tranquilo")}
                  >
                    <Text style={styles.onBusFeedbackEmoji}>👌</Text>
                    <Text style={[styles.onBusFeedbackOptionText, { color: theme.text }]}>Tranquilo</Text>
                  </Pressable>
                  <Pressable 
                    style={[styles.onBusFeedbackOption, onBusFeedback === "dificil" && styles.onBusFeedbackOptionSelected, { backgroundColor: onBusFeedback === "dificil" ? (isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF") : "transparent", borderColor: onBusFeedback === "dificil" ? "#93C5FD" : (isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9") }]} 
                    onPress={() => setOnBusFeedback("dificil")}
                  >
                    <Text style={styles.onBusFeedbackEmoji}>😓</Text>
                    <Text style={[styles.onBusFeedbackOptionText, { color: theme.text }]}>Difícil</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={{ paddingHorizontal: 16 }}>
              <View 
                style={[
                  styles.waitingCardContent,
                  isDark 
                    ? { backgroundColor: theme.card, borderColor: 'rgba(255, 255, 255, 0.1)' }
                    : { backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.05)' },
                  { padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8 }
                ]}
              >
                <View style={styles.waitingSecondaryRow}>
                  <Pressable
                    onPress={() => router.replace("/inicio")}
                    style={({ pressed }) => [
                      styles.waitingSecondaryBtn,
                      isDark ? styles.waitingSecondaryBtnDark : styles.waitingSecondaryBtnLight,
                      { backgroundColor: '#007AFF', borderColor: '#007AFF' },
                      pressed && { opacity: 0.75 },
                      { flex: 1, shadowColor: "#007AFF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
                    ]}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={[styles.waitingSecondaryBtnText, { color: '#FFFFFF' }]}>
                      Concluir navegação
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => speakControlled("Você já está a bordo da Linha. Boa viagem!", true)}
                    accessibilityRole="button"
                    accessibilityLabel="Ouvir aviso de boa viagem"
                    style={({ pressed }) => [
                      styles.waitingSecondaryBtn,
                      isDark ? styles.waitingSecondaryBtnDark : styles.waitingSecondaryBtnLight,
                      pressed && { opacity: 0.75 },
                      { width: 56, paddingVertical: 0, justifyContent: 'center', alignItems: 'center' }
                    ]}
                  >
                    <Ionicons 
                      name="volume-high-outline" 
                      size={26} 
                      color={isDark ? '#FFFFFF' : '#111827'} 
                    />
                  </Pressable>
                </View>
              </View>
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
  instructionTextContent: { flex: 1, overflow: "hidden" },
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

  // Novos Estilos do Card Flutuante (Walking - Opção 2)
  floatingBottomCardShadow: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 95,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  floatingBottomCardContent: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
  },
  floatingCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  floatingStopNameGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    overflow: "hidden",
  },
  floatingStopNameText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  floatingArrivalPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  floatingArrivalPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  floatingCardMiddleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  floatingBusInfoGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
    overflow: "hidden",
  },
  floatingBusLineBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  floatingBusLineBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  floatingBusDestText: {
    fontSize: 14,
    fontWeight: "600",
  },
  floatingStatusGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  floatingStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  floatingStatusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  floatingCardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  floatingMainButton: {
    flex: 1,
    height: 52,
    borderRadius: 100,
  },
  floatingVoiceIconButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },

  // Top Bar Live Pill Estilos
  topBarLiveGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topBarGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  topBarLiveBusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  topBarBullet: {
    fontSize: 14,
    marginHorizontal: 1,
  },
  topBarLiveCountdownText: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },

  // Novos Estilos do Card Flutuante (Waiting Bus - Alta Fidelidade)
  waitingCardShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  waitingCardContent: {
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  waitingHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  waitingHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  waitingCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  waitingCheckCircleDark: {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  waitingTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  waitingHeaderRight: {
    alignItems: "flex-end",
    marginLeft: 8,
    flex: 1,
    flexShrink: 1,
  },
  waitingGiantCountdown: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 26,
    textAlign: "right",
  },
  waitingPredictionText: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  waitingInnerCard: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
  },
  waitingInnerCardLight: {
    backgroundColor: "rgba(243, 244, 246, 0.75)",
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  waitingInnerCardDark: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  waitingLineChip: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  waitingLineChipLight: {
    backgroundColor: "#E0EDFF",
  },
  waitingLineChipDark: {
    backgroundColor: "rgba(10, 132, 255, 0.18)",
  },
  waitingLineChipText: {
    fontSize: 13,
    fontWeight: "800",
  },
  waitingDestContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  waitingDestTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  waitingStopAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  waitingStopAddressText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  waitingViaDetailText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 6,
  },
  waitingActionsCol: {
    gap: 10,
  },
  waitingPrimaryBtn: {
    minHeight: 52,
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  waitingPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
  },
  waitingSecondaryBtn: {
    minHeight: 52,
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  waitingSecondaryBtnLight: {
    backgroundColor: "rgba(243, 244, 246, 0.85)",
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  waitingSecondaryBtnDark: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  waitingSecondaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
  },
  waitingAudioBtn: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  waitingAudioBtnText: {
    fontSize: 14,
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
  onBusHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  onBusHeaderPillText: {
    fontSize: 15,
    fontWeight: "700",
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  onBusBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
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
    width: "100%",
    padding: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  onBusFeedbackTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  onBusFeedbackSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  onBusFeedbackOptions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "space-between",
  },
  onBusFeedbackOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  onBusFeedbackOptionSelected: {
    borderWidth: 1,
  },
  onBusFeedbackEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  onBusFeedbackOptionText: {
    fontSize: 14,
    fontWeight: "700",
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
    fontSize: 16,
    fontWeight: "700",
  }

});
