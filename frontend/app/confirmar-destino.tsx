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
} from "react-native";
import { Ionicons, FontAwesome6 } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { BottomVoiceMicButton } from "../src/components/BottomVoiceMicButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
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

function toVisualizerState(status: VoiceLoopStatus): VoiceVisualizerState {
  if (status === "speaking") return "speaking";
  if (status === "listening") return "listening";
  if (status === "processing") return "processing";
  return "idle";
}

export default function ConfirmDestinationScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  const isSmallHeight = height < 740;
  const screenHorizontalPadding = isSmallHeight
    ? layout.screenHorizontalPaddingSmall
    : layout.screenHorizontalPadding;
  const carouselCardWidth = width - screenHorizontalPadding * 2 - 48; // 48 = paddingHorizontal 24*2
  const cardMinHeight = height > 800 ? 380 : height > 700 ? 340 : 300;

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

  const activeDestinationName = selectedSuggestion?.name || displayDestination;
  const activeDestinationAddress = selectedSuggestion?.address || address;
  const activeDestination = selectedSuggestion || bestOption;
  const activeDestinationIcon = getDestinationIcon(activeDestinationName, activeDestinationAddress);
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

  const navigateWithSelectedDestination = useCallback(
    (selected: any) => {
      const originLat = parseRequiredCoordinate(latitude);
      const originLng = parseRequiredCoordinate(longitude);
      const destLat = parseRequiredCoordinate(String(selected.lat ?? ""));
      const destLng = parseRequiredCoordinate(String(selected.lng ?? ""));

      if (originLat === null || originLng === null) {
        vibrationService.error();
        Alert.alert(
          "Localização de origem ausente",
          "Não consegui identificar sua localização atual. Volte ao início e tente novamente.",
          [{ text: "OK", onPress: () => router.replace("/inicio") }],
        );
        return;
      }

      if (destLat === null || destLng === null) {
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
      if (!option) return;
      vibrationService.selection();
      setCurrentSuggestionIndex(index);
      setSelectedOptionIndex(index);
      setVoiceErrorMessage("");
    },
    [],
  );

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
      console.log("[ConfirmDestination] Erro ao cancelar no backend:", err);
    } finally {
      setIsLoadingCommand(false);
      sessionService.clearSessionId();
      router.replace({
        pathname: "/inicio",
        params: { latitude, longitude },
      });
    }
  }, [latitude, longitude, sessionId]);

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
    },
    onTranscript: (_text, isFinal) => {
      if (!isFinal) setVoiceErrorMessage("");
    },
    onRecognitionIssue: (issue: VoiceRecognitionIssue) => {
      setVoiceErrorMessage(issue.message);
    },
    maxSilentRetries: 0,
  });

  useEffect(() => {
    if (!voiceMode) return;
    if (isChoosingSuggestion) {
      void startLoop(voiceText, { autoListenAfterSpeech: false });
    } else {
      void startLoop(voiceText);
    }
    return () => { void stopAll(); };
  }, [isChoosingSuggestion, voiceMode, voiceText, startLoop, stopAll]);

  function getCompactMicLabel() {
    if (voiceStatus === "speaking") return "Aguarde";
    if (voiceStatus === "listening") return "Ouvindo";
    if (voiceStatus === "processing") return "Entendendo";
    if (voiceStatus === "error") return "Tentar";
    return "Responder";
  }

  function getMicAccessibilityLabel() {
    if (voiceStatus === "speaking") return "Aguarde a assistente";
    if (voiceStatus === "listening") return "Estou ouvindo";
    if (voiceStatus === "processing") return "Entendendo...";
    if (voiceStatus === "error") return "Tocar para tentar novamente";
    return "Responder por voz";
  }

  function getMicHelperText() {
    if (voiceErrorMessage) {
      return "Não consegui ouvir. Toque para tentar novamente.";
    }
    if (isChoosingSuggestion) {
      return "Diga o número da opção ou toque no card.";
    }
    return "Diga sim ou não.";
  }

  function handleMicPressIn() {
    if (voiceStatus === "speaking" || voiceStatus === "processing" || voiceStatus === "listening") return;
    vibrationService.light();
    setVoiceErrorMessage("");
    void startLoop();
  }

  function handleMicPressOut() {
    if (voiceStatus === "listening") stopListening();
  }

  const handleHelp = () => router.push("/ajuda");

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* TOP BAR — idêntico ao de melhor-rota */}
      <View style={[styles.fixedHeader, { top: insets.top + 12 }]}>
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

      {/* SCROLL — idêntico ao de melhor-rota */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 70,
            paddingBottom: insets.bottom + 172, // Ajustado para gap de ~24px dos botões
          },
        ]}
      >
        <Animated.View 
          entering={FadeIn.duration(400)} 
          style={[styles.content, { flex: 1 }]}
        >

          {/* Título + subtítulo — alinhado à esquerda, igual à rota pronta */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: "#000" }]} maxFontSizeMultiplier={1.2}>
              {showSuggestions ? "Destinos encontrados" : "Destino encontrado"}
            </Text>
            <Text style={[styles.subtitle, { color: "#666" }]} maxFontSizeMultiplier={1.1}>
              {isChoosingSuggestion
                ? `${options.length} ${options.length === 1 ? "opção" : "opções"} para escolher`
                : `Para ${activeDestinationName}`}
            </Text>
          </View>

          {/* VoiceVisualizer — apenas em modo voz */}
          {voiceMode && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.visualizerWrapper}>
              <VoiceVisualizer state={toVisualizerState(voiceStatus)} size="compact" />
            </Animated.View>
          )}

          {isChoosingSuggestion ? (
            /* ── CARROSSEL ── */
            <View style={[styles.carouselWrapper, { flex: 1 }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={carouselCardWidth + 12}
                decelerationRate="fast"
                contentContainerStyle={styles.carouselContent}
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
                      entering={FadeInUp.delay(index * 80).duration(300)}
                      style={{ width: carouselCardWidth }}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.destCard,
                          { minHeight: cardMinHeight },
                          isCurrent && styles.destCardActive,
                          (pressed || isActionDisabled) && { opacity: 0.7, transform: [{ scale: 0.99 }] },
                        ]}
                        disabled={isActionDisabled}
                        onPress={() => handleSelectSuggestion(option, index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Selecionar ${index + 1}: ${option.name}, ${option.address}`}
                      >
                        {/* Contador */}
                        <View style={styles.cardTopRow}>
                          <View
                            style={[
                              styles.numberBadge,
                              { backgroundColor: isCurrent ? theme.primary : theme.primaryLight },
                            ]}
                          >
                            <Text style={[styles.numberBadgeText, { color: isCurrent ? "#fff" : theme.primary }]}>
                              {index + 1}
                            </Text>
                          </View>
                          <Text style={styles.cardCountText}>
                            Opção {index + 1} de {options.length}
                          </Text>
                          {isCurrent && (
                            <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                          )}
                        </View>

                        {/* Ícone + nome */}
                        <View style={styles.cardPlaceRow}>
                          <View style={[styles.placeIconBox, { backgroundColor: theme.primaryLight }]}>
                            {optionIcon.type === "FontAwesome6" ? (
                              <FontAwesome6 name={optionIcon.name as any} size={20} color={theme.primary} />
                            ) : (
                              <Ionicons name={optionIcon.name as any} size={22} color={theme.primary} />
                            )}
                          </View>
                          <View style={styles.placeTextBox}>
                            <Text style={styles.placeName} numberOfLines={2}>
                              {option.name}
                            </Text>
                            <Text style={styles.placeType}>
                              {getPlaceTypeLabel(option.name || "", option.address || "")}
                            </Text>
                          </View>
                        </View>

                        {/* Detalhes */}
                        <View style={styles.cardDetails}>
                          <View style={styles.cardDetailRow}>
                            <Ionicons name="location-outline" size={16} color={theme.primary} />
                            <Text style={styles.cardDetailText} numberOfLines={1}>
                              {addressDetails.main}
                            </Text>
                          </View>
                          {!!addressDetails.area && (
                            <View style={styles.cardDetailRow}>
                              <Ionicons name="business-outline" size={16} color={theme.primary} />
                              <Text style={styles.cardDetailText} numberOfLines={1}>
                                {addressDetails.area}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Chips */}
                        <View style={styles.chipsRow}>
                          <View style={styles.chip}>
                            <Ionicons name="map-outline" size={13} color={theme.primary} />
                            <Text style={styles.chipText} numberOfLines={1}>{city}</Text>
                          </View>
                          <View style={styles.chip}>
                            <Ionicons
                              name={hasCoordinates ? "navigate-circle-outline" : "alert-circle-outline"}
                              size={13}
                              color={theme.primary}
                            />
                            <Text style={styles.chipText} numberOfLines={1}>
                              {hasCoordinates ? "Localização ok" : "Pendente"}
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
                  {options.map((_: any, index: number) => (
                    <View
                      key={index}
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
            /* ── CARD ÚNICO — mesmo estilo compactSummary da rota pronta ── */
            <Animated.View
              entering={FadeInUp.delay(150).duration(400)}
              style={[styles.destCard, { minHeight: cardMinHeight, flex: 1 }]}
            >
              <View style={styles.cardPlaceRow}>
                <View style={[styles.placeIconBox, { backgroundColor: theme.primaryLight }]}>
                  {activeDestinationIcon.type === "FontAwesome6" ? (
                    <FontAwesome6 name={activeDestinationIcon.name as any} size={20} color={theme.primary} />
                  ) : (
                    <Ionicons name={activeDestinationIcon.name as any} size={22} color={theme.primary} />
                  )}
                </View>
                <View style={styles.placeTextBox}>
                  <Text style={styles.placeName} numberOfLines={2}>
                    {activeDestinationName}
                  </Text>
                  <Text style={styles.placeType}>
                    {getPlaceTypeLabel(activeDestinationName, activeDestinationAddress || "")}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDetails}>
                <View style={styles.cardDetailRow}>
                  <Ionicons name="location-outline" size={16} color={theme.primary} />
                  <Text style={styles.cardDetailText} numberOfLines={2}>
                    {activeAddressDetails.main}
                  </Text>
                </View>
                {!!activeAddressDetails.area && (
                  <View style={styles.cardDetailRow}>
                    <Ionicons name="business-outline" size={16} color={theme.primary} />
                    <Text style={styles.cardDetailText} numberOfLines={1}>
                      {activeAddressDetails.area}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Ionicons name="map-outline" size={13} color={theme.primary} />
                  <Text style={styles.chipText} numberOfLines={1}>{city}</Text>
                </View>
                <View style={styles.chip}>
                  <Ionicons
                    name={activeHasCoordinates ? "navigate-circle-outline" : "alert-circle-outline"}
                    size={13}
                    color={theme.primary}
                  />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {activeHasCoordinates ? "Localização ok" : "Pendente"}
                  </Text>
                </View>
              </View>

              {!selectedSuggestion && confidence === "medium" && (
                <View style={[styles.statusBox, styles.statusBoxWarning]}>
                  <Ionicons name="alert-circle" size={18} color={theme.warning} />
                  <Text style={[styles.statusDesc, { color: theme.warning, marginLeft: 8 }]}>
                    Confira o endereço com atenção.
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

        </Animated.View>
      </ScrollView>

      {/* BOTÕES FIXOS — idêntico ao rodapé da rota pronta */}
      <View style={[styles.fixedBottomActions, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          title={isChoosingSuggestion ? "Confirmar destino" : "Buscar rota para este lugar"}
          onPress={() => {
            if (isChoosingSuggestion) {
              const currentOption = options[currentSuggestionIndex];
              if (currentOption) {
                handleSelectSuggestion(currentOption, currentSuggestionIndex);
                handleConfirmDestination(currentOption);
              }
            } else {
              handleConfirmDestination();
            }
          }}
          isLoading={isLoadingCommand}
          disabled={isActionDisabled}
          style={styles.mainButton}
          accessibilityLabel={
            isChoosingSuggestion ? "Confirmar destino selecionado" : "Buscar rota para este lugar"
          }
        />

        <View style={styles.secondaryWrapper}>
          {voiceMode && (
            <View style={{ alignItems: "center", marginBottom: 12 }}>
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
              <Text style={styles.bottomMicHelper}>{getMicHelperText()}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              (pressed || isActionDisabled) && { opacity: 0.7 },
            ]}
            onPress={selectedSuggestion ? handleRejectSelectedSuggestion : handleChangeDestination}
            disabled={isActionDisabled}
            accessibilityRole="button"
            accessibilityLabel={selectedSuggestion ? "Ver outras opções" : "Buscar outro destino"}
          >
            <Text style={styles.secondaryBtnText}>
              {selectedSuggestion ? "Outras opções" : "Outro destino"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── Layout base ────────────────────────────────────────────────────
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

  // ─── ScrollView (idêntico ao padrão de melhor-rota) ─────────────────
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 24,
    gap: 24,
  },

  // ─── Header à esquerda (igual melhor-rota) ──────────────────────────
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

  // ─── VoiceVisualizer ────────────────────────────────────────────────
  visualizerWrapper: {
    alignItems: "center",
    marginBottom: 4,
  },

  // ─── Carrossel ──────────────────────────────────────────────────────
  carouselWrapper: {
    width: "100%",
  },
  carouselContent: {
    gap: 12,
    paddingBottom: 4,
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

  // ─── Card (igual compactSummary da melhor-rota) ─────────────────────
  destCard: {
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
  destCardActive: {
    shadowColor: "#2563EB",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderColor: "rgba(37,99,235,0.15)",
  },

  // ─── Linha contador ─────────────────────────────────────────────────
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  numberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  numberBadgeText: {
    fontSize: 17,
    fontWeight: "900",
  },
  cardCountText: {
    flex: 1,
    color: "#64748B",
    fontSize: 15,
    fontWeight: "700",
  },

  // ─── Ícone + nome ────────────────────────────────────────────────────
  cardPlaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  placeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  placeTextBox: {
    flex: 1,
  },
  placeName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
    lineHeight: 22,
  },
  placeType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },

  // ─── Detalhes de endereço ────────────────────────────────────────────
  cardDetails: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  cardDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardDetailText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 18,
  },

  // ─── Chips ───────────────────────────────────────────────────────────
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(37,99,235,0.07)",
  },
  chipText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "700",
  },

  // ─── Badge ───────────────────────────────────────────────────────────
  statusBox: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  statusBoxWarning: {
    backgroundColor: "rgba(245,158,11,0.06)",
  },
  statusDesc: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },

  // ─── Rodapé fixo (idêntico ao de melhor-rota) ────────────────────────
  fixedBottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    paddingTop: 16,
    paddingHorizontal: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
  },
  mainButton: {
    borderRadius: 32,
  },
  secondaryWrapper: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  secondaryBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
  },
  secondaryBtnText: {
    color: "#3730A3",
    fontSize: 16,
    fontWeight: "700",
  },
  bottomMicHelper: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
    marginTop: 8,
  },
});
