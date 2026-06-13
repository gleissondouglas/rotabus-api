import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, Alert, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";
import { useThemeColors } from "../src/theme/colors";
import { speak } from "../src/services/speech.service";
import { journeyService } from "../src/services/journey.service";
import { sessionService } from "../src/services/session.service";
import { vibrationService } from "../src/services/vibration.service";
import { isConnected } from "../src/utils/network";
import { parseJsonParam } from "../src/utils/helpers";
import { layout } from "../src/theme/layout";

export default function ConfirmDestinationScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const isSmallHeight = height < 740;

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const destination = String(params.destination || "");
  const address = String(params.address || "");
  const city = String(params.city || "Uberaba - MG");
  const confirmationQuestion = String(params.confirmationQuestion || "");
  const backendMode = String(params.mode || "");
  const backendMessage = String(params.message || "Encontrei algumas opções");
  
  const [sessionId, setSessionId] = useState(String(params.sessionId || ""));
  const [speechText, setSpeechText] = useState(String(params.speechText || ""));
  const [displayData, setDisplayData] = useState<any>(params.displayData ? JSON.parse(String(params.displayData)) : null);
  const [actions, setActions] = useState<string[]>(params.actions ? JSON.parse(String(params.actions)) : []);
  const [conversationState, setConversationState] = useState(String(params.conversationState || ""));

  const options = displayData?.items || parseJsonParam<any[]>(params.options, []);
  
  // Se o backend explicitamente retornou 'suggestions' ou se há heurísticas residuais (ex: versão antiga em cache local)
  const bestOption = options[0] || {};
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

  const voiceText = speechText || (showSuggestions 
    ? "Encontrei algumas opções. Qual delas é o seu destino correto?"
    : confirmationQuestion || `Destino encontrado: ${displayDestination}, ${address}. É para este lugar que você quer ir?`);

  useAutoSpeakOnce(`confirmar-destino-${displayDestination}-${address}`, voiceText);

  const [isLoadingCommand, setIsLoadingCommand] = useState(false);

  async function handleConfirmDestination(option?: any) {
    const selected = option || bestOption;
    const isOptionSelection = !!option;
    
    setIsLoadingCommand(true);
    let sessionExpired = false;

    // Feedback tátil ao tocar
    if (isOptionSelection) {
      vibrationService.selection();
    } else {
      vibrationService.success();
    }

    try {
      const connected = await isConnected();
      if (!connected) {
        Alert.alert(
          "Sem Conexão",
          "Não conseguimos contatar o servidor de voz. Continuando pelo modo clássico.",
          [{ text: "Continuar" }]
        );
      } else {
        const activeSessionId = sessionId || sessionService.getSessionId();
        if (activeSessionId) {
          if (isOptionSelection) {
            const optionIndex = options.indexOf(option);
            const result = await journeyService.executeCommand({
              sessionId: activeSessionId,
              command: "SELECT_OPTION",
              payload: {
                optionIndex: optionIndex >= 0 ? optionIndex : 0,
                optionName: selected.name,
              }
            });
            if (result.speechText) setSpeechText(result.speechText);
            if (result.displayData) setDisplayData(result.displayData);
            if (result.conversationState) setConversationState(result.conversationState);
            if (result.actions) setActions(result.actions);
            if (result.metadata?.sessionId) setSessionId(result.metadata.sessionId);
          } else {
            const result = await journeyService.executeCommand({
              sessionId: activeSessionId,
              command: "CONFIRM"
            });
            if (result.speechText) setSpeechText(result.speechText);
            if (result.displayData) setDisplayData(result.displayData);
            if (result.conversationState) setConversationState(result.conversationState);
            if (result.actions) setActions(result.actions);
            if (result.metadata?.sessionId) setSessionId(result.metadata.sessionId);
          }
        }
      }
    } catch (err: any) {
      console.log("[ConfirmDestination] Erro ao executar comando no backend:", err);
      if (err?.message && (
        err.message.includes("Sessão conversacional não encontrada") ||
        err.message.includes("não encontrada ou expirada")
      )) {
        sessionExpired = true;
        vibrationService.error();
        Alert.alert(
          "Conversa Expirada",
          "Sua conversa expirou. Vamos começar de novo.",
          [{ text: "OK", onPress: () => router.replace("/inicio") }]
        );
      } else {
        Alert.alert(
          "Erro de Rede",
          "Falha ao comunicar com o servidor. Continuando no modo clássico.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setIsLoadingCommand(false);
    }

    if (sessionExpired) {
      return;
    }

    router.push({
      pathname: "/escolher-horario",
      params: {
        latitude,
        longitude,
        destination: selected.name,
        destinationLat: String(selected.lat),
        destinationLng: String(selected.lng),
      },
    });
  }

  async function handleChangeDestination() {
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
  }

  async function handleHearDestination() {
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
  }

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