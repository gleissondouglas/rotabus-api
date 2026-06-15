import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, Alert, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { useVoiceConversationLoop } from "../src/hooks/useVoiceConversationLoop";
import { useThemeColors } from "../src/theme/colors";
import { speak } from "../src/services/speech.service";
import { journeyService } from "../src/services/journey.service";
import { sessionService } from "../src/services/session.service";
import { vibrationService } from "../src/services/vibration.service";
import { isConnected } from "../src/utils/network";
import { parseJsonParam } from "../src/utils/helpers";
import { layout } from "../src/theme/layout";
import type {
  VoiceLoopStatus,
  VoiceRecognitionIssue,
} from "../src/hooks/useVoiceConversationLoop";

function getSingleParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? String(value[0] || fallback) : String(value || fallback);
}

function parseRequiredCoordinate(value: string) {
  if (!value || value === "null" || value === "undefined") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ConfirmDestinationScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const isSmallHeight = height < 740;

  const latitude = getSingleParam(params.latitude);
  const longitude = getSingleParam(params.longitude);
  const destination = getSingleParam(params.destination);
  const address = getSingleParam(params.address);
  const city = getSingleParam(params.city, "Uberaba - MG");
  const confirmationQuestion = getSingleParam(params.confirmationQuestion);
  const backendMode = getSingleParam(params.mode);
  const backendMessage = getSingleParam(params.message, "Encontrei algumas opções");
  const voiceMode = getSingleParam(params.voiceMode) === "true";
  const recognizedText = getSingleParam(params.recognizedText);
  
  const [sessionId] = useState(getSingleParam(params.sessionId));
  const [speechText] = useState(getSingleParam(params.speechText));
  const [displayData] = useState<any>(params.displayData ? JSON.parse(String(params.displayData)) : null);
  const [conversationState] = useState(getSingleParam(params.conversationState));
  const [voiceStatus, setVoiceStatus] = useState<VoiceLoopStatus>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState(recognizedText);
  const [voiceErrorMessage, setVoiceErrorMessage] = useState("");

  const rawOptions = parseJsonParam<any[]>(params.options, []);
  const options = (rawOptions.length > 0 ? rawOptions : (displayData?.items || [])).map((item: any, index: number) => {
    const rawMatch = rawOptions[index] || {};
    return {
      ...item,
      lat: item.lat ?? rawMatch.lat ?? null,
      lng: item.lng ?? rawMatch.lng ?? null,
      id: item.id ?? rawMatch.id ?? String(index),
    };
  });
  
  // Se o backend explicitamente retornou 'suggestions' ou se há heurísticas residuais (ex: versão antiga em cache local)
  const bestOption = useMemo(() => options[0] || {}, [options]);
  const isGeneric = bestOption.isGenericCityResult;
  const confidence = bestOption.confidence || "high";
  const showSuggestions = conversationState === "WAITING_DESTINATION_SELECTION" || backendMode === "suggestions" || (isGeneric && options.length > 1) || confidence === "low";

  const displayDestination = displayData?.title || destination || bestOption.name || "Destino informado";
  
  // Heurística para ícone do destino
  const getDestinationIcon = (name: string, addr: string) => {
    const text = (name + " " + addr).toLowerCase();
    if (text.includes("hospital") || text.includes("upa") || text.includes("saúde") || text.includes("clínica")) {
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

  const destIcon = getDestinationIcon(displayDestination, address);

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

  const voiceText = speechText || (showSuggestions 
    ? getSuggestionsSpeech(options)
    : confirmationQuestion || `Destino encontrado: ${displayDestination}, ${address}. É para este lugar que você quer ir?`);

  const navigateWithSelectedDestination = useCallback((selected: any) => {
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
        [{ text: "OK", onPress: () => router.replace("/inicio") }]
      );
      return;
    }

    if (destLat === null || destLng === null) {
      console.warn("[ConfirmDestination] Destino sem coordenadas antes de escolher horário", {
        selected,
      });
      vibrationService.error();
      Alert.alert(
        "Localização não encontrada",
        "Não consegui confirmar a localização desse destino. Tente escolher outra opção.",
        [{ text: "OK" }]
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
  }, [displayDestination, latitude, longitude, sessionId, voiceMode]);

  const handleConfirmDestination = useCallback(async (option?: any) => {
    const selected = option || bestOption;

    if (!selected || Object.keys(selected).length === 0) {
      vibrationService.error();
      Alert.alert(
        "Destino não encontrado",
        "Não recebi os dados do destino. Escolha outro destino e tente novamente.",
      );
      return;
    }

    setIsLoadingCommand(true);

    if (option) {
      vibrationService.selection();
    } else {
      vibrationService.success();
    }

    try {
      navigateWithSelectedDestination(selected);
    } finally {
      setIsLoadingCommand(false);
    }
  }, [bestOption, navigateWithSelectedDestination]);

  const handleChangeDestination = useCallback(async () => {
    setIsLoadingCommand(true);
    vibrationService.light();
    try {
      const connected = await isConnected();
      const activeSessionId = sessionId || sessionService.getSessionId();
      if (connected && activeSessionId) {
        await journeyService.executeCommand({
          sessionId: activeSessionId,
          command: "CANCEL"
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

  const handleHearDestination = useCallback(async () => {
    setIsLoadingCommand(true);
    vibrationService.selection();
    try {
      const connected = await isConnected();
      const activeSessionId = sessionId || sessionService.getSessionId();
      if (connected && activeSessionId) {
        await journeyService.executeCommand({
          sessionId: activeSessionId,
          command: "REPEAT"
        });
      }
      speak(voiceText);
    } catch (err: any) {
      console.log("[ConfirmDestination] Erro ao executar repetição no backend:", err);
      if (err?.message && (
        err.message.includes("Sessão conversacional não encontrada") ||
        err.message.includes("não encontrada ou expirada")
      )) {
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
  }, [sessionId, voiceText]);

  /**
   * Loop de voz orquestrado para confirmação ou seleção de opções.
   */
  const { startLoop, stopAll } = useVoiceConversationLoop({
    onIntent: async (intent) => {
      setVoiceErrorMessage("");

      switch (intent.type) {
        case "CONFIRM":
          await handleConfirmDestination();
          break;
        case "CANCEL_THEN_ASK_DESTINATION":
          await handleChangeDestination();
          break;
        case "SELECT_OPTION":
          if (options[intent.optionIndex]) {
            await handleConfirmDestination(options[intent.optionIndex]);
          } else {
            vibrationService.light();
            void startLoop("Não encontrei essa opção. Qual você deseja?");
          }
          break;
        case "CANCEL":
          router.replace("/inicio");
          break;
        case "DESTINATION_TEXT":
          // Se o usuário falar um novo destino diretamente, tratamos como uma nova busca
          // Paramos o loop e voltamos para o início com o texto para processar a busca
          void stopAll();
          router.replace({
            pathname: "/inicio",
            params: { 
              latitude, 
              longitude,
              searchText: intent.text,
              voiceMode: voiceMode ? "true" : "false",
            }
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
    onTranscript: (text, isFinal) => {
      if (text) {
        setVoiceTranscript(text);
      }

      if (!isFinal) {
        setVoiceErrorMessage("");
      }
    },
    onRecognitionIssue: (issue: VoiceRecognitionIssue) => {
      if ("transcript" in issue && issue.transcript) {
        setVoiceTranscript(issue.transcript);
      }

      setVoiceErrorMessage(issue.message);
    },
  });

  useEffect(() => {
    if (!voiceMode) {
      return;
    }

    void startLoop(voiceText);
    return () => {
      void stopAll();
    };
  }, [voiceMode, voiceText, startLoop, stopAll]);

  const [isLoadingCommand, setIsLoadingCommand] = useState(false);

  const handleHelp = () => {
    router.push("/ajuda");
  };

  return (
    <View style={styles.screen}>
      {/* TOP BAR */}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: insets.top + (isSmallHeight ? 50 : 70),
            paddingBottom: insets.bottom + (showSuggestions ? 160 : 300) 
          }
        ]}
      >
        <Animated.View 
          entering={FadeIn.duration(600)} 
          style={[styles.content, { paddingHorizontal: isSmallHeight ? layout.screenHorizontalPaddingSmall : layout.screenHorizontalPadding }]}
        >
          {/* HERO AREA */}
          <View style={[styles.heroArea, { marginBottom: isSmallHeight ? layout.sectionGapSmall : layout.sectionGap }]}>
            <View style={[
              styles.heroIconCircle, 
              { backgroundColor: "white" },
              { width: isSmallHeight ? layout.heroIconSizeSmall : layout.heroIconSize, 
                height: isSmallHeight ? layout.heroIconSizeSmall : layout.heroIconSize, 
                borderRadius: (isSmallHeight ? layout.heroIconSizeSmall : layout.heroIconSize) / 2 }
            ]}>
              <Ionicons name={showSuggestions ? "list" : "location"} size={isSmallHeight ? 32 : 40} color={theme.primary} />
            </View>
            <Text style={[
              styles.heroTitle, 
              { color: "#000" },
              { fontSize: isSmallHeight ? layout.titleFontSizeSmall : layout.titleFontSize }
            ]} maxFontSizeMultiplier={1.2}>
              {showSuggestions ? backendMessage : "Destino encontrado"}
            </Text>
            <Text style={[
              styles.heroSubtitle, 
              { color: "#666" },
              { fontSize: isSmallHeight ? layout.subtitleFontSizeSmall : layout.subtitleFontSize }
            ]} maxFontSizeMultiplier={1.1}>
              {showSuggestions ? "Escolha o destino correto abaixo." : "Confira se este é o lugar certo."}
            </Text>
          </View>

          {showSuggestions ? (
            /* SUGGESTIONS LIST */
            <View style={styles.suggestionsList}>
              {options.slice(0, 4).map((option: any, index: number) => (
                <Animated.View 
                  key={option.id || index}
                  entering={FadeInUp.delay(index * 100).duration(400)}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.suggestionCard,
                      { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding },
                      (pressed || isLoadingCommand) && { opacity: 0.6, transform: [{ scale: 0.98 }] }
                    ]}
                    disabled={isLoadingCommand}
                    onPress={() => handleConfirmDestination(option)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ir para ${option.name}, ${option.address}`}
                  >
                    <View style={[
                      styles.suggestionIcon, 
                      { backgroundColor: theme.primaryLight },
                      { width: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                        height: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                        borderRadius: 14 }
                    ]}>
                      {(() => {
                        const icon = getDestinationIcon(option.name, option.address);
                        return icon.type === "FontAwesome6" ? (
                          <FontAwesome6 name={icon.name as any} size={isSmallHeight ? 20 : 24} color={theme.primary} />
                        ) : (
                          <Ionicons name={icon.name as any} size={isSmallHeight ? 24 : 28} color={theme.primary} />
                        );
                      })()}
                    </View>
                    <View style={styles.suggestionText}>
                      <Text style={[
                        styles.suggestionName,
                        { fontSize: isSmallHeight ? layout.cardTitleFontSizeSmall : layout.cardTitleFontSize }
                      ]} numberOfLines={1}>{option.name}</Text>
                      <Text style={[
                        styles.suggestionAddress,
                        { fontSize: isSmallHeight ? layout.cardSubtitleFontSizeSmall : layout.cardSubtitleFontSize }
                      ]} numberOfLines={2}>{option.address}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#CCC" />
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          ) : (
            /* SINGLE DESTINATION CARD */
            <Animated.View entering={FadeInUp.delay(200).duration(600).springify()} style={[styles.mainCard, { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.destIconContainer, { backgroundColor: theme.primaryLight }]}>
                  {destIcon.type === "FontAwesome6" ? (
                    <FontAwesome6 name={destIcon.name as any} size={24} color={theme.primary} />
                  ) : (
                    <Ionicons name={destIcon.name as any} size={28} color={theme.primary} />
                  )}
                </View>
                <View style={styles.destTextContainer}>
                  <Text style={[styles.destinationName, { color: "#000" }]} maxFontSizeMultiplier={1.2}>
                    {displayDestination}
                  </Text>
                  {!!address && (
                    <Text style={[styles.addressDetails, { color: "#666" }]} maxFontSizeMultiplier={1.1}>
                      {address}
                    </Text>
                  )}
                  <Text style={[styles.cityDetails, { color: "#666" }]} maxFontSizeMultiplier={1.1}>
                    {city}
                  </Text>
                </View>
              </View>

              {/* CONFIDENCE STATUS BOX */}
              {confidence === "medium" && (
                <>
                  <View style={[styles.divider, { backgroundColor: "#F0F0F0" }]} />
                  <View style={[styles.statusBox, styles.statusBoxWarning]}>
                    <Ionicons name="alert-circle" size={20} color={theme.warning} />
                    <View style={styles.statusTextContainer}>
                      <Text style={[styles.statusTitle, { color: theme.warning }]}>Confira com atenção</Text>
                      <Text style={styles.statusDesc}>Encontrei um endereço parecido.</Text>
                    </View>
                  </View>
                </>
              )}
            </Animated.View>
          )}

          {!showSuggestions && (
            <View style={styles.questionSection}>
              <Text style={[styles.questionTitle, { color: "#000" }]} maxFontSizeMultiplier={1.2}>
                Este é o destino correto?
              </Text>
            </View>
          )}

          {voiceMode && (
            <View
              style={styles.voiceReplyCard}
              accessible={true}
              accessibilityLabel={
                showSuggestions
                  ? "Responda por voz. Diga primeira, segunda ou terceira opção."
                  : "Responda por voz. Diga sim para buscar a rota ou não para escolher outro destino."
              }
            >
              <View style={[styles.voiceReplyIcon, { backgroundColor: theme.primaryLight }]}>
                <Ionicons
                  name={voiceStatus === "listening" ? "mic" : "volume-high"}
                  size={20}
                  color={theme.primary}
                />
              </View>
              <View style={styles.voiceReplyTextContainer}>
                <Text style={styles.voiceReplyTitle}>
                  {voiceStatus === "listening" ? "Estou ouvindo sua resposta" : "Responda por voz"}
                </Text>
                <Text style={styles.voiceReplyText}>
                  {showSuggestions
                    ? "Diga 'primeira', 'segunda' ou 'terceira' para escolher."
                    : "Diga 'sim' para buscar a rota ou 'não' para escolher outro destino."}
                </Text>
                {!!voiceTranscript && (
                  <Text style={styles.voiceTranscriptText}>
                    Texto entendido: {voiceTranscript}
                  </Text>
                )}
                {!!voiceErrorMessage && (
                  <Text style={styles.voiceErrorText}>{voiceErrorMessage}</Text>
                )}
                {voiceStatus === "error" && (
                  <Pressable
                    style={styles.retryVoiceButton}
                    onPress={() => {
                      vibrationService.light();
                      setVoiceErrorMessage("");
                      void startLoop();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Falar novamente"
                  >
                    <Ionicons name="mic" size={16} color={theme.primary} />
                    <Text style={[styles.retryVoiceText, { color: theme.primary }]}>
                      Falar novamente
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* ACTIONS */}
      <View style={[styles.fixedBottomActions, { paddingBottom: insets.bottom + 16, paddingHorizontal: isSmallHeight ? layout.screenHorizontalPaddingSmall : layout.screenHorizontalPadding }]}>
        {!showSuggestions && (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary, height: isSmallHeight ? layout.primaryButtonHeightSmall : layout.primaryButtonHeight },
              (pressed || isLoadingCommand) && { opacity: 0.6 }
            ]}
            disabled={isLoadingCommand}
            onPress={() => handleConfirmDestination()}
            accessibilityRole="button"
            accessibilityLabel="Confirmar destino e buscar rota"
          >
            {isLoadingCommand ? (
              <ActivityIndicator size="small" color={theme.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="navigation-variant" size={24} color={theme.white} style={styles.buttonIconLeft} />
                <Text style={[styles.primaryButtonText, { color: theme.white }]}>
                  Buscar rota para este lugar
                </Text>
              </>
            )}
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { backgroundColor: "white", borderColor: "#EEE", height: isSmallHeight ? layout.primaryButtonHeightSmall : layout.primaryButtonHeight },
            (pressed || isLoadingCommand) && { opacity: 0.6 }
          ]}
          disabled={isLoadingCommand}
          onPress={handleChangeDestination}
          accessibilityRole="button"
          accessibilityLabel={showSuggestions ? "Escolher outro destino" : "Alterar destino. Digitar outro endereço."}
        >
          <Ionicons name={showSuggestions ? "search" : "pencil"} size={20} color={theme.primary} style={styles.buttonIconLeft} />
          <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
            {showSuggestions ? "Tentar outro destino" : "Escolher outro destino"}
          </Text>
        </Pressable>

        <View style={styles.listenWrapper}>
          <Pressable
            style={({ pressed }) => [
              styles.listenButton,
              { backgroundColor: "rgba(59, 130, 246, 0.08)" },
              (pressed || isLoadingCommand) && { opacity: 0.6 }
            ]}
            disabled={isLoadingCommand}
            onPress={handleHearDestination}
            accessibilityRole="button"
            accessibilityLabel="Ouvir opções ou destino encontrado em voz alta"
          >
            <Ionicons name="volume-high" size={20} color={theme.primary} style={styles.buttonIconLeft} />
            <Text style={[styles.listenButtonText, { color: theme.primary }]}>
              Ouvir destino
            </Text>
          </Pressable>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
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
  heroSubtitle: {
    fontWeight: "600",
    textAlign: "center",
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
    marginBottom: 24,
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
  statusIconContainer: {
    marginRight: 12,
  },
  statusTextContainer: {
    flex: 1,
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
  questionSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  voiceReplyCard: {
    backgroundColor: "white",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E0ECFF",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  voiceReplyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceReplyTextContainer: {
    flex: 1,
    gap: 2,
  },
  voiceReplyTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#011030",
  },
  voiceReplyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    lineHeight: 19,
  },
  voiceTranscriptText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#011030",
    marginTop: 4,
  },
  voiceErrorText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9F1239",
    lineHeight: 18,
    marginTop: 4,
  },
  retryVoiceButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    marginTop: 8,
  },
  retryVoiceText: {
    fontSize: 13,
    fontWeight: "900",
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
  suggestionsList: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  suggestionCard: {
    backgroundColor: "white",
    borderRadius: layout.cardBorderRadius,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEE",
    gap: 12,
  },
  suggestionIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    fontWeight: "800",
    color: "#000",
    marginBottom: 2,
  },
  suggestionAddress: {
    fontWeight: "500",
    color: "#666",
    lineHeight: 18,
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
  secondaryButton: {
    borderRadius: layout.buttonBorderRadius,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "800",
  },
  listenWrapper: {
    alignItems: "center",
  },
  listenButton: {
    height: layout.secondaryButtonHeight,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  listenButtonText: {
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 8,
  },
  buttonIconLeft: {
    marginRight: 4,
  },
});
