import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome6,
} from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { BottomVoiceMicButton } from "../src/components/BottomVoiceMicButton";
import { VoiceVisualizer } from "../src/components/VoiceVisualizer";
import { useVoiceConversationLoop } from "../src/hooks/useVoiceConversationLoop";
import { useThemeColors } from "../src/theme/colors";
import { journeyService } from "../src/services/journey.service";
import { sessionService } from "../src/services/session.service";
import { vibrationService } from "../src/services/vibration.service";
import { stopListening } from "../src/services/speech.service";
import { isConnected } from "../src/utils/network";
import { parseJsonParam } from "../src/utils/helpers";
import { layout } from "../src/theme/layout";
import type {
  VoiceLoopStatus,
  VoiceRecognitionIssue,
} from "../src/hooks/useVoiceConversationLoop";
import type { VoiceVisualizerState } from "../src/components/VoiceVisualizer";

function getSingleParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value)
    ? String(value[0] || fallback)
    : String(value || fallback);
}

function parseRequiredCoordinate(value: string) {
  if (!value || value === "null" || value === "undefined") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Mapeia VoiceLoopStatus para VoiceVisualizerState.
 */
function toVisualizerState(status: VoiceLoopStatus): VoiceVisualizerState {
  if (status === "speaking") return "speaking";
  if (status === "listening") return "listening";
  if (status === "processing") return "processing";
  return "idle";
}

/**
 * ConfirmDestinationScreen — tela de confirmação de destino único ou seleção de sugestões.
 *
 * Layout voice-first:
 *  1. Topo fixo: Voltar + Ajuda
 *  2. Conteúdo principal:
 *     - VoiceVisualizer compacto (reflete estado de fala/escuta)
 *     - Título
 *     - Card do destino único OU carrossel de sugestões
 *  3. Rodapé fixo:
 *     - [Buscar rota para este lugar] (apenas destino único)
 *     - [Outro destino] | [🎤 Microfone compacto]
 *     - Texto helper do microfone
 */
export default function ConfirmDestinationScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  const isSmallHeight = height < 740;
  const screenHorizontalPadding = isSmallHeight
    ? layout.screenHorizontalPaddingSmall
    : layout.screenHorizontalPadding;
  const carouselCardWidth = Math.max(280, width - screenHorizontalPadding * 2);

  const latitude = getSingleParam(params.latitude);
  const longitude = getSingleParam(params.longitude);
  const destination = getSingleParam(params.destination);
  const address = getSingleParam(params.address);
  const city = getSingleParam(params.city, "Uberaba - MG");
  const confirmationQuestion = getSingleParam(params.confirmationQuestion);
  const backendMode = getSingleParam(params.mode);
  const voiceMode = getSingleParam(params.voiceMode) === "true";

  const [sessionId] = useState(getSingleParam(params.sessionId));
  const [speechText] = useState(getSingleParam(params.speechText));
  const [displayData] = useState<any>(
    params.displayData ? JSON.parse(String(params.displayData)) : null,
  );
  const [conversationState] = useState(getSingleParam(params.conversationState));
  const [isLoadingCommand, setIsLoadingCommand] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceLoopStatus>("idle");
  const [voiceErrorMessage, setVoiceErrorMessage] = useState("");
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);

  const rawOptions = parseJsonParam<any[]>(params.options, []);
  const options = (
    rawOptions.length > 0 ? rawOptions : displayData?.items || []
  ).map((item: any, index: number) => {
    const rawMatch = rawOptions[index] || {};
    return {
      ...item,
      lat: item.lat ?? rawMatch.lat ?? null,
      lng: item.lng ?? rawMatch.lng ?? null,
      id: item.id ?? rawMatch.id ?? String(index),
    };
  });

  const bestOption = useMemo(() => options[0] || {}, [options]);
  const isGeneric = bestOption.isGenericCityResult;
  const confidence = bestOption.confidence || "high";
  const showSuggestions =
    conversationState === "WAITING_DESTINATION_SELECTION" ||
    backendMode === "suggestions" ||
    (isGeneric && options.length > 1) ||
    confidence === "low";
  const selectedSuggestion =
    selectedOptionIndex !== null ? options[selectedOptionIndex] : null;
  const isChoosingSuggestion = showSuggestions && !selectedSuggestion;

  const displayDestination =
    displayData?.title || destination || bestOption.name || "Destino informado";

  const getDestinationIcon = (name: string, addr: string) => {
    const text = (name + " " + addr).toLowerCase();
    if (
      text.includes("hospital") ||
      text.includes("upa") ||
      text.includes("saúde") ||
      text.includes("clínica")
    ) {
      return { name: "hospital", type: "FontAwesome6" as const };
    }
    if (/\d+/.test(name) || /\d+/.test(addr)) {
      return { name: "home", type: "Ionicons" as const };
    }
    if (name.length > 5 && !addr.includes(",")) {
      return { name: "map", type: "Ionicons" as const };
    }
    return { name: "location", type: "Ionicons" as const };
  };

  const getPlaceTypeLabel = (name: string, addr: string) => {
    const text = `${name} ${addr}`.toLowerCase();

    if (
      text.includes("hospital") ||
      text.includes("upa") ||
      text.includes("saúde") ||
      text.includes("clínica")
    ) {
      return "Saúde";
    }

    if (/\d+/.test(name) || /\d+/.test(addr)) {
      return "Endereço";
    }

    return "Local";
  };

  const getAddressDetails = (addr: string) => {
    const parts = addr
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      main: parts.slice(0, 2).join(", ") || addr || "Endereço não informado",
      area: parts.slice(2).join(", "),
    };
  };

  const getSuggestionsSpeech = (items: any[]) => {
    if (!items || items.length === 0) return "Encontrei algumas opções. Qual delas você quer?";
    const maxOptions = 3;
    const ordinals = ["Primeira", "Segunda", "Terceira"];
    let speech = "Encontrei algumas opções. ";
    items.slice(0, maxOptions).forEach((item, index) => {
      speech += `${ordinals[index]}: ${item.name}. `;
    });
    speech += "Qual você quer?";
    return speech;
  };

  const activeDestinationName =
    selectedSuggestion?.name || displayDestination;
  const activeDestinationAddress =
    selectedSuggestion?.address || address;
  const activeDestination = selectedSuggestion || bestOption;
  const activeDestinationIcon = getDestinationIcon(
    activeDestinationName,
    activeDestinationAddress,
  );
  const activeAddressDetails = getAddressDetails(activeDestinationAddress || "");
  const activeHasCoordinates =
    parseRequiredCoordinate(String(activeDestination?.lat ?? "")) !== null &&
    parseRequiredCoordinate(String(activeDestination?.lng ?? "")) !== null;

  const voiceText =
    selectedSuggestion
      ? `Destino selecionado: ${selectedSuggestion.name}. Este é o destino correto?`
      : speechText ||
        (showSuggestions
          ? getSuggestionsSpeech(options)
          : confirmationQuestion ||
            `Destino encontrado: ${displayDestination}, ${address}. É para este lugar que você quer ir?`);

  const isVoiceSpeaking = voiceMode && voiceStatus === "speaking";
  const isVoiceProcessing = voiceMode && voiceStatus === "processing";
  const isActionDisabled = isLoadingCommand || isVoiceSpeaking || isVoiceProcessing;
  const bottomActionsReservedSpace = isChoosingSuggestion
    ? (isSmallHeight ? 112 : 124)
    : (isSmallHeight ? 164 : 178);

  const navigateWithSelectedDestination = useCallback(
    (selected: any) => {
      const originLat = parseRequiredCoordinate(latitude);
      const originLng = parseRequiredCoordinate(longitude);
      const destLat = parseRequiredCoordinate(String(selected.lat ?? ""));
      const destLng = parseRequiredCoordinate(String(selected.lng ?? ""));

      if (originLat === null || originLng === null) {
        console.warn("[ConfirmDestination] Origem ausente antes de escolher horário", {
          latitude,
          longitude,
        });
        vibrationService.error();
        Alert.alert(
          "Localização de origem ausente",
          "Não consegui identificar sua localização atual. Volte ao início e tente novamente.",
          [{ text: "OK", onPress: () => router.replace("/inicio") }],
        );
        return;
      }

      if (destLat === null || destLng === null) {
        console.warn(
          "[ConfirmDestination] Destino sem coordenadas antes de escolher horário",
          { selected },
        );
        vibrationService.error();
        Alert.alert(
          "Localização não encontrada",
          "Não consegui confirmar a localização desse destino. Tente escolher outra opção.",
          [{ text: "OK" }],
        );
        return;
      }

      router.push({
        pathname: "/escolher-horario",
        params: {
          latitude: String(originLat),
          longitude: String(originLng),
          destination: selected.name || displayDestination,
          destinationLat: String(destLat),
          destinationLng: String(destLng),
          selectedDestination: JSON.stringify(selected),
          sessionId,
          voiceMode: voiceMode ? "true" : "false",
        },
      });
    },
    [displayDestination, latitude, longitude, sessionId, voiceMode],
  );

  const handleSelectSuggestion = useCallback(
    (option: any, index: number) => {
      if (!option) {
        return;
      }

      vibrationService.selection();
      setCurrentSuggestionIndex(index);
      setSelectedOptionIndex(index);
      setVoiceErrorMessage("");
    },
    [],
  );

  /**
   * Confirma o destino e navega para escolher horário.
   * Mesma lógica usada pelo botão E pelo comando de voz "sim".
   */
  const handleConfirmDestination = useCallback(
    async (option?: any) => {
      const selected = option || selectedSuggestion || bestOption;

      if (showSuggestions && !selectedSuggestion && !option) {
        vibrationService.light();
        setVoiceErrorMessage("Escolha uma opção antes de confirmar.");
        return;
      }

      if (!selected || Object.keys(selected).length === 0) {
        vibrationService.error();
        Alert.alert(
          "Destino não encontrado",
          "Não recebi os dados do destino. Escolha outro destino e tente novamente.",
        );
        return;
      }

      setIsLoadingCommand(true);

      if (option || selectedSuggestion) {
        vibrationService.selection();
      } else {
        vibrationService.success();
      }

      try {
        navigateWithSelectedDestination(selected);
      } finally {
        setIsLoadingCommand(false);
      }
    },
    [bestOption, navigateWithSelectedDestination, selectedSuggestion, showSuggestions],
  );

  const handleRejectSelectedSuggestion = useCallback(() => {
    vibrationService.light();
    setSelectedOptionIndex(null);
    setVoiceErrorMessage("");
  }, []);

  /**
   * Cancela e volta para a home para buscar outro destino.
   * Mesma lógica usada pelo botão E pelo comando de voz "não".
   */
  const handleChangeDestination = useCallback(async () => {
    setIsLoadingCommand(true);
    vibrationService.light();
    try {
      const connected = await isConnected();
      const activeSessionId = sessionId || sessionService.getSessionId();
      if (connected && activeSessionId) {
        await journeyService.executeCommand({
          sessionId: activeSessionId,
          command: "CANCEL",
        });
      }
    } catch (err) {
      console.log("[ConfirmDestination] Erro ao executar cancelamento no backend:", err);
    } finally {
      setIsLoadingCommand(false);
      sessionService.clearSessionId();
      router.replace({
        pathname: "/inicio",
        params: {
          latitude,
          longitude,
        },
      });
    }
  }, [latitude, longitude, sessionId]);

  /**
   * Loop de voz orquestrado.
   * Interpreta CONFIRM → handleConfirmDestination (mesmo handler do botão).
   * Interpreta CANCEL_THEN_ASK_DESTINATION → handleChangeDestination (mesmo handler do botão).
   */
  const { startLoop, stopAll } = useVoiceConversationLoop({
    onIntent: async (intent) => {
      setVoiceErrorMessage("");

      switch (intent.type) {
        case "CONFIRM":
          if (showSuggestions && !selectedSuggestion) {
            vibrationService.light();
            setVoiceErrorMessage("Escolha uma opção antes de confirmar.");
            void startLoop("Escolha uma opção primeiro. Qual destino você quer?");
            break;
          }

          await handleConfirmDestination();
          break;
        case "CANCEL_THEN_ASK_DESTINATION":
          if (selectedSuggestion) {
            handleRejectSelectedSuggestion();
            break;
          }

          await handleChangeDestination();
          break;
        case "SELECT_OPTION":
          if (options[intent.optionIndex]) {
            handleSelectSuggestion(options[intent.optionIndex], intent.optionIndex);
          } else {
            vibrationService.light();
            void startLoop("Não encontrei essa opção. Qual você deseja?");
          }
          break;
        case "CANCEL":
          router.replace("/inicio");
          break;
        case "DESTINATION_TEXT":
          // Usuário falou um novo destino → volta para home com busca
          void stopAll();
          router.replace({
            pathname: "/inicio",
            params: {
              latitude,
              longitude,
              searchText: intent.text,
              voiceMode: voiceMode ? "true" : "false",
            },
          });
          break;
      }
    },
    onStatusChange: (nextStatus) => {
      setVoiceStatus(nextStatus);

      if (nextStatus === "listening" || nextStatus === "processing") {
        setVoiceErrorMessage("");
      }

      // A tela não exibe transcrição visual; mantém apenas o estado de voz.
    },
    onTranscript: (_text, isFinal) => {
      if (!isFinal) {
        setVoiceErrorMessage("");
      }
    },
    onRecognitionIssue: (issue: VoiceRecognitionIssue) => {
      setVoiceErrorMessage(issue.message);
    },
    maxSilentRetries: 0,
  });

  useEffect(() => {
    if (!voiceMode) {
      return;
    }

    if (isChoosingSuggestion) {
      void startLoop(voiceText, { autoListenAfterSpeech: false });
    } else {
      void startLoop(voiceText);
    }
    return () => {
      void stopAll();
    };
  }, [isChoosingSuggestion, voiceMode, voiceText, startLoop, stopAll]);

  // ── Labels do botão microfone ─────────────────────────────────────────────

  /** Label compacto exibido dentro do botão mic */
  function getCompactMicLabel() {
    if (voiceStatus === "speaking") return "Aguarde";
    if (voiceStatus === "listening") return "Ouvindo";
    if (voiceStatus === "processing") return "Entendendo";
    if (voiceStatus === "error") return "Tentar";
    return "Responder";
  }

  /** Label de acessibilidade do botão mic */
  function getMicAccessibilityLabel() {
    if (voiceStatus === "speaking") return "Aguarde a assistente";
    if (voiceStatus === "listening") return "Estou ouvindo";
    if (voiceStatus === "processing") return "Entendendo...";
    if (voiceStatus === "error") return "Tocar para tentar novamente";
    return "Responder por voz";
  }

  /** Texto helper abaixo da barra de ações */
  function getMicHelperText() {
    if (voiceErrorMessage) {
      return "Não consegui ouvir. Toque para tentar novamente.";
    }

    if (isChoosingSuggestion) {
      return "Diga o número da opção ou toque no card.";
    }

    return "Diga sim ou não.";
  }

  // ── Handlers do microfone ─────────────────────────────────────────────────

  function handleMicPressIn() {
    if (
      voiceStatus === "speaking" ||
      voiceStatus === "processing" ||
      voiceStatus === "listening"
    ) {
      return;
    }

    vibrationService.light();
    setVoiceErrorMessage("");
    void startLoop();
  }

  function handleMicPressOut() {
    if (voiceStatus === "listening") {
      stopListening();
    }
  }

  const handleHelp = () => {
    router.push("/ajuda");
  };

  return (
    <View style={styles.screen}>
      {/* ─── TOP BAR ─── */}
      <View style={[styles.fixedHeader, { top: insets.top + 8 }]}>
        <BackButton label="Voltar" accessibilityLabel="Voltar para a tela anterior" />
        <Pressable
          style={styles.helpButton}
          onPress={handleHelp}
          accessibilityLabel="Abrir ajuda"
          accessibilityRole="button"
        >
          <Ionicons name="help-circle-outline" size={28} color={theme.primary} />
        </Pressable>
      </View>

      {/* ─── CONTEÚDO PRINCIPAL ─── */}
      <View
        style={[
          styles.mainContentWrapper,
          {
            paddingTop: insets.top + (isSmallHeight ? 60 : 72),
            paddingBottom: insets.bottom + bottomActionsReservedSpace,
          },
        ]}
      >
        <Animated.View
          entering={FadeIn.duration(600)}
          style={[
            styles.content,
            {
              paddingHorizontal: screenHorizontalPadding,
            },
          ]}
          >
          {/* ── VOICE VISUALIZER compacto ── */}
          {(voiceMode || showSuggestions) && (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={[
                styles.visualizerWrapper,
                isChoosingSuggestion && styles.suggestionVisualizerWrapper,
              ]}
            >
              <VoiceVisualizer
                state={toVisualizerState(voiceStatus)}
                size="compact"
              />
            </Animated.View>
          )}

          {/* ── HERO: título compacto ── */}
          <View
            style={[
              styles.heroArea,
              {
                marginBottom: isSmallHeight ? 10 : 14,
              },
            ]}
          >
            <Text
              style={[
                styles.heroTitle,
                { color: "#000" },
                {
                  fontSize: isSmallHeight ? 28 : 32,
                  lineHeight: isSmallHeight ? 32 : 36,
                },
              ]}
              maxFontSizeMultiplier={1.2}
            >
              Destinos encontrados
            </Text>
          </View>

          {isChoosingSuggestion ? (
            /* ── CARROSSEL DE SUGESTÕES ── */
            <View style={styles.suggestionsCarouselWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={carouselCardWidth + 12}
                decelerationRate="fast"
                contentContainerStyle={styles.suggestionsCarouselContent}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const nextIndex = Math.round(offsetX / (carouselCardWidth + 12));
                  setCurrentSuggestionIndex(
                    Math.max(0, Math.min(nextIndex, options.length - 1)),
                  );
                }}
                accessibilityLabel="Destinos encontrados em carrossel"
              >
                {options.map((option: any, index: number) => {
                  const isCurrent = index === currentSuggestionIndex;
                  const optionIcon = getDestinationIcon(option.name, option.address);
                  const addressDetails = getAddressDetails(option.address || "");
                  const hasCoordinates =
                    parseRequiredCoordinate(String(option.lat ?? "")) !== null &&
                    parseRequiredCoordinate(String(option.lng ?? "")) !== null;

                  return (
                    <Animated.View
                      key={option.id || index}
                      entering={FadeInUp.delay(index * 100).duration(400)}
                      style={{ width: carouselCardWidth }}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.suggestionCard,
                          styles.carouselSuggestionCard,
                          isCurrent && styles.suggestionCardCurrent,
                          {
                            minHeight: isSmallHeight ? 262 : 286,
                            padding: isSmallHeight ? 14 : 16,
                            borderColor: isCurrent ? theme.primary : "#E5E7EB",
                          },
                          (pressed || isActionDisabled) && {
                            opacity: 0.6,
                            transform: [{ scale: 0.98 }],
                          },
                        ]}
                        disabled={isActionDisabled}
                        onPress={() => handleSelectSuggestion(option, index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Selecionar ${index + 1}: ${option.name}, ${option.address}`}
                      >
                        <View style={styles.suggestionCardTopRow}>
                          <View
                            style={[
                              styles.optionNumberBadge,
                              { backgroundColor: isCurrent ? theme.primary : theme.primaryLight },
                            ]}
                          >
                            <Text
                              style={[
                                styles.optionNumberText,
                                { color: isCurrent ? theme.white : theme.primary },
                              ]}
                            >
                              {index + 1}
                            </Text>
                          </View>
                          <Text style={styles.optionCountText}>
                            Opção {index + 1} de {options.length}
                          </Text>
                          <Ionicons name="checkmark-circle-outline" size={26} color={theme.primary} />
                        </View>

                        <View style={styles.suggestionPlaceHeader}>
                          <View
                            style={[
                              styles.suggestionIcon,
                              styles.suggestionIconLarge,
                              { backgroundColor: theme.primaryLight },
                              { width: isSmallHeight ? 62 : 68, height: isSmallHeight ? 62 : 68 },
                            ]}
                          >
                            {optionIcon.type === "FontAwesome6" ? (
                              <FontAwesome6
                                name={optionIcon.name as any}
                                size={isSmallHeight ? 28 : 32}
                                color={theme.primary}
                              />
                            ) : (
                              <Ionicons
                                name={optionIcon.name as any}
                                size={isSmallHeight ? 32 : 36}
                                color={theme.primary}
                              />
                            )}
                          </View>

                          <View style={styles.suggestionText}>
                            <Text
                              style={[
                                styles.suggestionName,
                                {
                                  fontSize: isSmallHeight ? 22 : 25,
                                  lineHeight: isSmallHeight ? 26 : 29,
                                },
                              ]}
                              numberOfLines={2}
                            >
                              {option.name}
                            </Text>
                            <Text style={styles.suggestionTypeLabel}>
                              {getPlaceTypeLabel(option.name || "", option.address || "")}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.suggestionDetailsPanel}>
                          <View style={styles.detailRow}>
                            <Ionicons name="location-outline" size={20} color={theme.primary} />
                            <View style={styles.detailTextGroup}>
                              <Text style={styles.detailLabel}>Endereço</Text>
                              <Text style={styles.detailValue} numberOfLines={1}>
                                {addressDetails.main}
                              </Text>
                            </View>
                          </View>

                          {!!addressDetails.area && (
                            <View style={styles.detailRow}>
                              <Ionicons name="business-outline" size={20} color={theme.primary} />
                              <View style={styles.detailTextGroup}>
                                <Text style={styles.detailLabel}>Região</Text>
                                <Text style={styles.detailValue} numberOfLines={1}>
                                  {addressDetails.area}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>

                        <View style={styles.suggestionChipsRow}>
                          <View style={styles.infoChip}>
                            <Ionicons name="map-outline" size={14} color={theme.primary} />
                            <Text style={styles.infoChipText} numberOfLines={1}>
                              {city}
                            </Text>
                          </View>
                          <View style={styles.infoChip}>
                            <Ionicons
                              name={hasCoordinates ? "navigate-circle-outline" : "alert-circle-outline"}
                              size={14}
                              color={theme.primary}
                            />
                            <Text style={styles.infoChipText} numberOfLines={1}>
                              {hasCoordinates ? "Localização encontrada" : "Localização pendente"}
                            </Text>
                          </View>
                        </View>

                      </Pressable>
                    </Animated.View>
                  );
                })}
              </ScrollView>
              {options.length > 1 && (
                <View style={styles.carouselDots}>
                  {options.map((option: any, index: number) => (
                    <View
                      key={option.id || index}
                      style={[
                        styles.carouselDot,
                        index === currentSuggestionIndex && {
                          backgroundColor: theme.primary,
                          width: 18,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            /* ── CARD ÚNICO DE DESTINO ── */
            <Animated.View
              entering={FadeInUp.delay(200).duration(600).springify()}
              style={[
                styles.suggestionCard,
                styles.selectedDestinationCard,
                {
                  padding: isSmallHeight ? 14 : 16,
                  borderColor: theme.primary,
                },
              ]}
            >
              <View style={styles.suggestionPlaceHeader}>
                <View
                  style={[
                    styles.suggestionIcon,
                    styles.suggestionIconLarge,
                    { backgroundColor: theme.primaryLight },
                    { width: isSmallHeight ? 62 : 68, height: isSmallHeight ? 62 : 68 },
                  ]}
                >
                  {activeDestinationIcon.type === "FontAwesome6" ? (
                    <FontAwesome6
                      name={activeDestinationIcon.name as any}
                      size={isSmallHeight ? 28 : 32}
                      color={theme.primary}
                    />
                  ) : (
                    <Ionicons
                      name={activeDestinationIcon.name as any}
                      size={isSmallHeight ? 32 : 36}
                      color={theme.primary}
                    />
                  )}
                </View>
                <View style={styles.suggestionText}>
                  <Text
                    style={[
                      styles.suggestionName,
                      {
                        fontSize: isSmallHeight ? 22 : 25,
                        lineHeight: isSmallHeight ? 26 : 29,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {activeDestinationName}
                  </Text>
                  <Text style={styles.suggestionTypeLabel}>
                    {getPlaceTypeLabel(activeDestinationName, activeDestinationAddress || "")}
                  </Text>
                </View>
              </View>

              <View style={styles.suggestionDetailsPanel}>
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={20} color={theme.primary} />
                  <View style={styles.detailTextGroup}>
                    <Text style={styles.detailLabel}>Endereço</Text>
                    <Text
                      style={styles.detailValue}
                      numberOfLines={selectedSuggestion ? 1 : 2}
                    >
                      {activeAddressDetails.main}
                    </Text>
                  </View>
                </View>

                {!!activeAddressDetails.area && (
                  <View style={styles.detailRow}>
                    <Ionicons name="business-outline" size={20} color={theme.primary} />
                    <View style={styles.detailTextGroup}>
                      <Text style={styles.detailLabel}>Região</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>
                        {activeAddressDetails.area}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.suggestionChipsRow}>
                <View style={styles.infoChip}>
                  <Ionicons name="map-outline" size={14} color={theme.primary} />
                  <Text style={styles.infoChipText} numberOfLines={1}>
                    {city}
                  </Text>
                </View>
                <View style={styles.infoChip}>
                  <Ionicons
                    name={activeHasCoordinates ? "navigate-circle-outline" : "alert-circle-outline"}
                    size={14}
                    color={theme.primary}
                  />
                  <Text style={styles.infoChipText} numberOfLines={1}>
                    {activeHasCoordinates ? "Localização encontrada" : "Localização pendente"}
                  </Text>
                </View>
              </View>

              {/* Badge de confiança média */}
              {!selectedSuggestion && confidence === "medium" && (
                <>
                  <View style={[styles.divider, { backgroundColor: "#F0F0F0" }]} />
                  <View style={[styles.statusBox, styles.statusBoxWarning]}>
                    <Ionicons name="alert-circle" size={20} color={theme.warning} />
                    <View style={styles.statusTextContainer}>
                      <Text style={[styles.statusTitle, { color: theme.warning }]}>
                        Confira com atenção
                      </Text>
                      <Text style={styles.statusDesc}>
                        Encontrei um endereço parecido.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </Animated.View>
          )}

        </Animated.View>
      </View>

      {/* ─── BARRA DE AÇÕES FIXA ─── */}
      <View
        style={[
          styles.fixedBottomActions,
          {
            paddingTop: isChoosingSuggestion ? 16 : 12,
            paddingBottom: insets.bottom + (isChoosingSuggestion ? 16 : 12),
            paddingHorizontal: isSmallHeight
              ? layout.screenHorizontalPaddingSmall
              : layout.screenHorizontalPadding,
            gap: isChoosingSuggestion ? 12 : 8,
          },
        ]}
      >
        {/* Botão primário: apenas no modo destino único */}
        {!isChoosingSuggestion && (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: theme.primary,
                height: !isChoosingSuggestion || isSmallHeight
                  ? layout.primaryButtonHeightSmall
                  : layout.primaryButtonHeight,
              },
              (pressed || isActionDisabled) && { opacity: 0.6 },
            ]}
            disabled={isActionDisabled}
            onPress={() => handleConfirmDestination()}
            accessibilityRole="button"
            accessibilityLabel="Confirmar destino e buscar rota"
          >
            {isLoadingCommand ? (
              <ActivityIndicator size="small" color={theme.white} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="navigation-variant"
                  size={24}
                  color={theme.white}
                  style={styles.buttonIconLeft}
                />
                <Text style={[styles.primaryButtonText, { color: theme.white }]}>
                  Buscar rota para este lugar
                </Text>
              </>
            )}
          </Pressable>
        )}

        {/* Linha secundária: Outro destino | Microfone */}
        <View
          style={[
            styles.secondaryVoiceRow,
            {
              height: !isChoosingSuggestion || isSmallHeight
                ? layout.primaryButtonHeightSmall
                : layout.primaryButtonHeight,
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.secondaryInlineButton,
              (pressed || isActionDisabled) && { opacity: 0.6 },
            ]}
            disabled={isActionDisabled}
            onPress={selectedSuggestion ? handleRejectSelectedSuggestion : handleChangeDestination}
            accessibilityRole="button"
            accessibilityLabel={
              selectedSuggestion
                ? "Voltar para as opções de destino"
                : showSuggestions
                  ? "Escolher outro destino"
                : "Alterar destino. Digitar outro endereço."
            }
          >
            <Ionicons
              name={selectedSuggestion ? "list" : showSuggestions ? "search" : "pencil"}
              size={20}
              color={theme.primary}
              style={styles.buttonIconLeft}
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.secondaryButtonText,
                styles.secondaryButtonTextCompact,
                { color: theme.primary },
              ]}
            >
              {selectedSuggestion ? "Outras opções" : "Outro destino"}
            </Text>
          </Pressable>

          <View style={styles.secondaryVoiceDivider} />

          {/* Botão mic compacto — halo pulsante quando listening */}
          <BottomVoiceMicButton
            status={voiceStatus}
            label={getCompactMicLabel()}
            mode="hold"
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
            accessibilityLabel={getMicAccessibilityLabel()}
            compact
            tone="primary"
          />
        </View>

        {/* Texto helper abaixo da barra */}
        <Text style={styles.bottomMicHelper}>{getMicHelperText()}</Text>
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
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 50,
  },
  helpButton: {
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
  mainContentWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  // VoiceVisualizer compacto no topo do conteúdo
  visualizerWrapper: {
    alignItems: "center",
    marginBottom: 8,
    marginTop: 4,
  },
  suggestionVisualizerWrapper: {
    marginTop: 0,
    marginBottom: 0,
  },
  heroArea: {
    alignItems: "center",
  },
  heroIconCircle: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTitle: {
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  mainCard: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: layout.cardBorderRadius,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  destIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  destTextContainer: {
    flex: 1,
  },
  destinationName: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 4,
  },
  addressDetails: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
  },
  cityDetails: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  divider: {
    height: 1,
    width: "100%",
    marginBottom: 20,
  },
  statusBox: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  statusBoxWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.06)",
  },
  statusTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  statusDesc: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  fixedBottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
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
  secondaryVoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: layout.buttonBorderRadius,
    borderWidth: 1,
    borderColor: "#EEE",
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryVoiceDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 6,
  },
  suggestionsCarouselWrapper: {
    width: "100%",
    marginBottom: 12,
  },
  suggestionsCarouselContent: {
    gap: 12,
    paddingBottom: 4,
  },
  suggestionCard: {
    backgroundColor: "white",
    borderRadius: layout.cardBorderRadius,
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: "#EEE",
    gap: 14,
  },
  carouselSuggestionCard: {
    minHeight: 286,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  suggestionCardCurrent: {
    shadowColor: "#2563EB",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
    transform: [{ scale: 1 }],
  },
  selectedDestinationCard: {
    width: "100%",
    marginBottom: 18,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  suggestionCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  optionNumberBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  optionNumberText: {
    fontSize: 20,
    fontWeight: "900",
  },
  optionCountText: {
    flex: 1,
    color: "#64748B",
    fontSize: 16,
    fontWeight: "800",
  },
  carouselDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  carouselDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
  },
  suggestionIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionIconLarge: {
    borderRadius: 20,
    flexShrink: 0,
  },
  suggestionPlaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
  },
  suggestionTypeLabel: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "800",
  },
  suggestionDetailsPanel: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  detailTextGroup: {
    flex: 1,
  },
  detailLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    color: "#1F2937",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  suggestionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  infoChipText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButton: {
    borderRadius: layout.buttonBorderRadius,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "800",
    marginHorizontal: 8,
  },
  secondaryInlineButton: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
    borderRadius: layout.buttonBorderRadius,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryButtonTextCompact: {
    fontSize: 14,
  },
  bottomMicHelper: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: -4,
    textAlign: "center",
  },
  buttonIconLeft: {
    marginRight: 4,
  },
});
