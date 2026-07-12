import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";

import { BackButton } from "../src/components/BackButton";
import { BottomVoiceMicButton } from "../src/components/BottomVoiceMicButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { useVoiceConversationLoop } from "../src/hooks/useVoiceConversationLoop";
import type { VoiceLoopStatus, VoiceRecognitionIssue } from "../src/hooks/useVoiceConversationLoop";
import { useThemeColors } from "../src/theme/colors";
import { layout } from "../src/theme/layout";
import { vibrationService } from "../src/services/vibration.service";
import {
  buildLocalDateTimeFromInputs,
  formatLocalDateTimeWithOffset,
  getCurrentTimeText,
  getTodayDateText,
  getNext7Days,
} from "../src/utils/date-time";
import { parseVoiceTimeIntent } from "../src/utils/voiceTimeParser";
import { getInteractionMode } from "../src/types/interaction.types";

type TimeMode = "NOW" | "DEPARTURE" | "ARRIVAL";

function parseRequiredCoordinate(value: string) {
  if (!value || value === "null" || value === "undefined") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ChooseTimeScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const isSmallHeight = height < 740;
  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const destination = String(params.destination || "");
  const destinationLat = String(params.destinationLat || "");
  const destinationLng = String(params.destinationLng || "");
  const selectedDestination = String(params.selectedDestination || "");
  const sessionId = String(params.sessionId || "");
  const interactionMode = getInteractionMode(params.interactionMode);
  const isVoiceMode = interactionMode === "voice";

  const [mode, setMode] = useState<TimeMode>("NOW");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateText, setDateText] = useState(getTodayDateText());
  const [timeText, setTimeText] = useState(getCurrentTimeText());
  const [voiceStatus, setVoiceStatus] = useState<VoiceLoopStatus>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceErrorMessage, setVoiceErrorMessage] = useState("");
  const isActionDisabled = voiceStatus === "speaking" || voiceStatus === "processing";

  const dateOptions = getNext7Days();

  const timeSlots = [];
  for (let i = 0; i < 24; i++) {
    const hr = String(i).padStart(2, "0");
    timeSlots.push(`${hr}:00`);
    timeSlots.push(`${hr}:30`);
  }

  const screenMessage = "Você quer sair agora ou escolher outro horário?";

  function buildProcessingParams(type: "DEPARTURE" | "ARRIVAL", dateTime: string) {
    const originLat = parseRequiredCoordinate(latitude);
    const originLng = parseRequiredCoordinate(longitude);
    const destLat = parseRequiredCoordinate(destinationLat);
    const destLng = parseRequiredCoordinate(destinationLng);

    if (!destination || originLat === null || originLng === null || destLat === null || destLng === null) {
      console.warn("[ChooseTime] Dados obrigatórios ausentes antes de processando", {
        latitude,
        longitude,
        destination,
        destinationLat,
        destinationLng,
      });
      vibrationService.error();
      Alert.alert(
        "Dados da rota incompletos",
        "Não consegui manter a localização do destino. Escolha o destino novamente.",
        [{ text: "OK", onPress: () => router.replace({ pathname: "/inicio", params: { latitude, longitude } }) }]
      );
      return null;
    }

    return {
      latitude: String(originLat),
      longitude: String(originLng),
      destination,
      destinationLat: String(destLat),
      destinationLng: String(destLng),
      selectedDestination,
      sessionId,
      interactionMode,
      timeType: type,
      dateTime,
    };
  }

  const { startLoop, stopListeningAndSubmit } = useVoiceConversationLoop({
    onIntent: async (intent) => {
      setVoiceErrorMessage("");
      const timeIntent = parseVoiceTimeIntent(intent.transcript);
      
      switch (timeIntent.type) {
        case "NOW":
          handleGoNow();
          break;
        case "DEPARTURE_TIME":
          setDateText(timeIntent.date);
          setTimeText(timeIntent.time);
          validateAndNavigate("DEPARTURE", timeIntent.date, timeIntent.time);
          break;
        case "ARRIVAL_TIME":
          setDateText(timeIntent.date);
          setTimeText(timeIntent.time);
          validateAndNavigate("ARRIVAL", timeIntent.date, timeIntent.time);
          break;
        case "REPEAT":
          void startLoop(screenMessage);
          break;
        case "CANCEL":
          vibrationService.light();
          router.replace("/inicio");
          break;
        case "UNKNOWN":
          vibrationService.error();
          void startLoop("Não entendi o horário. Você pode dizer, por exemplo: sair agora, hoje às oito ou amanhã às nove.");
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
    maxSilentRetries: 0,
  });

  function handleGoNow() {
    vibrationService.selection();
    const now = new Date();
    const dateTime = formatLocalDateTimeWithOffset(now);
    const navigationParams = buildProcessingParams("DEPARTURE", dateTime);

    if (!navigationParams) {
      return;
    }

    router.push({
      pathname: "/processando",
      params: navigationParams,
    });
  }

  function handleOpenTimeSelector(selectedMode: "DEPARTURE" | "ARRIVAL") {
    vibrationService.light();
    setMode(selectedMode);
    setIsModalOpen(true);
  }

  function validateAndNavigate(type: "DEPARTURE" | "ARRIVAL", date: string, time: string) {
    try {
      vibrationService.selection();
      const dateTime = buildLocalDateTimeFromInputs(date, time);
      
      const now = new Date();
      const selectedDate = new Date(dateTime);
      
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOf7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000 + 23 * 59 * 60 * 1000 + 59 * 1000);

      if (selectedDate.getTime() < startOfToday.getTime() || selectedDate.getTime() > endOf7Days.getTime()) {
        vibrationService.error();
        Alert.alert(
          "Atenção",
          "Só consigo buscar ônibus para os próximos 7 dias. Escolha uma data mais próxima."
        );
        return;
      }

      const navigationParams = buildProcessingParams(type, dateTime);

      if (!navigationParams) {
        return;
      }

      router.push({
        pathname: "/processando",
        params: navigationParams,
      });
    } catch (error) {
      vibrationService.error();
      Alert.alert(
        "Atenção",
        error instanceof Error
          ? error.message
          : "Informe uma data e um horário válidos.",
      );
    }
  }

  function handleConfirmCustomTime() {
    validateAndNavigate(mode === "ARRIVAL" ? "ARRIVAL" : "DEPARTURE", dateText, timeText);
    setIsModalOpen(false);
  }

  function getMicLabel() {
    if (voiceStatus === "speaking") {
      return "Aguarde a assistente";
    }

    if (voiceStatus === "listening") {
      return "Parar e enviar";
    }

    if (voiceStatus === "processing") {
      return "Entendendo...";
    }

    if (voiceStatus === "error") {
      return "Tocar para tentar novamente";
    }

    return "Responder por voz";
  }

  function getMicHelperText() {
    if (voiceErrorMessage) {
      return "Não consegui ouvir. Toque para tentar novamente.";
    }

    if (voiceStatus === "speaking") {
      return "O microfone será liberado ao fim da fala.";
    }

    if (voiceStatus === "processing") {
      return "Interpretando seu horário.";
    }

    return "Diga agora, hoje às oito ou amanhã às nove";
  }

  function handleMicPress() {
    if (voiceStatus === "listening") {
      void stopListeningAndSubmit();
      return;
    }

    if (voiceStatus === "speaking" || voiceStatus === "processing") {
      return;
    }

    vibrationService.light();
    setVoiceErrorMessage("");
    void startLoop();
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.fixedHeader, { top: insets.top + 8 }]}>
        <BackButton accessibilityLabel="Voltar para a tela anterior" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: insets.top + (isSmallHeight ? 50 : 70),
            paddingBottom: insets.bottom + 150
          }
        ]}
      >
        <Animated.View 
          entering={FadeInUp.duration(400)} 
          style={[styles.content, { paddingHorizontal: isSmallHeight ? layout.screenHorizontalPaddingSmall : layout.screenHorizontalPadding, gap: isSmallHeight ? layout.sectionGapSmall : layout.sectionGap }]}
        >
          <View style={[styles.header, { gap: isSmallHeight ? 8 : 12 }]}>
            <View style={[
              styles.heroIconCircle, 
              { backgroundColor: "white" },
              { width: isSmallHeight ? layout.heroIconSizeSmall : layout.heroIconSize, 
                height: isSmallHeight ? layout.heroIconSizeSmall : layout.heroIconSize, 
                borderRadius: (isSmallHeight ? layout.heroIconSizeSmall : layout.heroIconSize) / 2 }
            ]}>
              <Ionicons name="time" size={isSmallHeight ? 32 : 40} color={theme.primary} />
            </View>
            <Text style={[
              styles.title, 
              { color: "#000" },
              { fontSize: isSmallHeight ? layout.titleFontSizeSmall : layout.titleFontSize }
            ]} maxFontSizeMultiplier={1.2}>Quando você quer ir?</Text>
            <Text 
              style={[
                styles.subtitle, 
                { color: "#666" },
                { fontSize: isSmallHeight ? layout.subtitleFontSizeSmall : layout.subtitleFontSize }
              ]} 
              maxFontSizeMultiplier={1.1}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              Escolha o horário da viagem até <Text style={[styles.bold, { color: theme.primary }]}>{destination}</Text>.
            </Text>
          </View>

          {isVoiceMode && (!!voiceTranscript || !!voiceErrorMessage) && (
            <View
              style={styles.voiceFeedback}
              accessible={true}
              accessibilityLiveRegion="polite"
            >
              {!!voiceTranscript && (
                <Text style={styles.voiceTranscriptText}>
                  Entendi: {voiceTranscript}
                </Text>
              )}
              {!!voiceErrorMessage && (
                <Text style={styles.voiceErrorText}>{voiceErrorMessage}</Text>
              )}
            </View>
          )}

          <View style={[styles.optionsContainer, { gap: isSmallHeight ? layout.cardGapSmall : layout.cardGap }]}>
            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding },
                (pressed || isActionDisabled) && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
              disabled={isActionDisabled}
              onPress={handleGoNow}
              accessibilityRole="button"
              accessibilityLabel="Agora. Buscar o próximo ônibus imediatamente."
            >
              <View style={[
                styles.iconBox, 
                { backgroundColor: theme.primaryLight },
                { width: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  height: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  borderRadius: 14 }
              ]}>
                <MaterialCommunityIcons 
                  name="clock-fast" 
                  size={isSmallHeight ? 24 : 28} 
                  color={theme.primary} 
                />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[
                  styles.optionTitle, 
                  { color: "#000" },
                  { fontSize: isSmallHeight ? layout.cardTitleFontSizeSmall : layout.cardTitleFontSize }
                ]} maxFontSizeMultiplier={1.2}>Agora</Text>
                <Text style={[
                  styles.optionDescription, 
                  { color: "#666" },
                  { fontSize: isSmallHeight ? layout.cardSubtitleFontSizeSmall : layout.cardSubtitleFontSize }
                ]} maxFontSizeMultiplier={1.1}>
                  Buscar o próximo ônibus.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#CCC" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding },
                (pressed || isActionDisabled) && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
              disabled={isActionDisabled}
              onPress={() => handleOpenTimeSelector("DEPARTURE")}
              accessibilityRole="button"
              accessibilityLabel="Outro horário. Escolha dia e hora de saída."
            >
              <View style={[
                styles.iconBox, 
                { backgroundColor: "white", borderWidth: 1, borderColor: "#F1F5F9" },
                { width: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  height: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  borderRadius: 14 }
              ]}>
                <MaterialCommunityIcons 
                  name="calendar-clock" 
                  size={isSmallHeight ? 24 : 28} 
                  color={theme.primary} 
                />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[
                  styles.optionTitle, 
                  { color: "#000" },
                  { fontSize: isSmallHeight ? layout.cardTitleFontSizeSmall : layout.cardTitleFontSize }
                ]} maxFontSizeMultiplier={1.2}>Outro horário</Text>
                <Text style={[
                  styles.optionDescription, 
                  { color: "#666" },
                  { fontSize: isSmallHeight ? layout.cardSubtitleFontSizeSmall : layout.cardSubtitleFontSize }
                ]} maxFontSizeMultiplier={1.1}>
                  Escolha dia e hora.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#CCC" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding },
                (pressed || isActionDisabled) && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
              disabled={isActionDisabled}
              onPress={() => handleOpenTimeSelector("ARRIVAL")}
              accessibilityRole="button"
              accessibilityLabel="Chegada prevista. Defina a hora que quer chegar."
            >
              <View style={[
                styles.iconBox, 
                { backgroundColor: "white", borderWidth: 1, borderColor: "#F1F5F9" },
                { width: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  height: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  borderRadius: 14 }
              ]}>
                <MaterialCommunityIcons 
                  name="flag-checkered" 
                  size={isSmallHeight ? 24 : 28} 
                  color={theme.primary} 
                />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[
                  styles.optionTitle, 
                  { color: "#000" },
                  { fontSize: isSmallHeight ? layout.cardTitleFontSizeSmall : layout.cardTitleFontSize }
                ]} maxFontSizeMultiplier={1.2}>Chegar até um horário</Text>
                <Text style={[
                  styles.optionDescription, 
                  { color: "#666" },
                  { fontSize: isSmallHeight ? layout.cardSubtitleFontSizeSmall : layout.cardSubtitleFontSize }
                ]} maxFontSizeMultiplier={1.1}>
                  Defina a hora de chegada.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#CCC" />
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      {isVoiceMode && (
        <View
          style={[
            styles.bottomVoiceContainer,
            { bottom: insets.bottom + 16 },
          ]}
        >
          <BottomVoiceMicButton
            status={voiceStatus}
            label={getMicLabel()}
            helperText={getMicHelperText()}
            onPress={handleMicPress}
            accessibilityLabel={getMicLabel()}
          />
        </View>
      )}

      {/* TIME SELECTOR MODAL */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeIn.duration(300)} style={styles.modalContent}>
            <View style={styles.modalHeader}>
               <View style={[styles.modalIconBg, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons 
                    name={mode === "DEPARTURE" ? "calendar" : "flag"} 
                    size={28} 
                    color={theme.primary} 
                  />
               </View>
               <Text style={styles.modalTitle}>
                  {mode === "DEPARTURE" ? "Horário de saída" : "Horário de chegada"}
               </Text>
               <Text style={styles.modalSubtitle}>
                  {mode === "DEPARTURE" ? "Escolha quando você quer sair." : "Escolha quando quer chegar ao destino."}
               </Text>
            </View>

            <View style={styles.formGrid}>
                <Text style={styles.formLabel}>Escolha um dia nos próximos 7 dias</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dateChipsContainer}
                >
                  {dateOptions.map((opt) => {
                    const isSelected = dateText === opt.dateText;
                    return (
                      <Pressable
                        key={opt.dateText}
                        onPress={() => {
                          vibrationService.light();
                          setDateText(opt.dateText);
                        }}
                        style={[
                          styles.dateChip,
                          isSelected && [styles.dateChipActive, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${opt.label === 'Hoje' ? 'Hoje' : opt.label === 'Amanhã' ? 'Amanhã' : opt.label}, dia ${opt.dayNum}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={[styles.dateChipLabel, isSelected && { color: theme.primary }]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.dateChipDay, isSelected && { color: theme.primary }]}>
                          {opt.dayNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={styles.formLabel}>Escolha o horário</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dateChipsContainer}
                >
                  {timeSlots.map((slot) => {
                    const isSelected = timeText === slot;
                    return (
                      <Pressable
                        key={slot}
                        onPress={() => {
                          vibrationService.light();
                          setTimeText(slot);
                        }}
                        style={[
                          styles.timeChip,
                          isSelected && [styles.timeChipActive, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Horário ${slot}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={[styles.timeChipText, isSelected && { color: theme.primary }]}>
                          {slot}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
            </View>

            <View style={styles.modalActions}>
               <PrimaryButton 
                  title="Confirmar horário" 
                  onPress={handleConfirmCustomTime} 
                  style={styles.modalConfirmBtn}
               />
               <Pressable 
                style={styles.modalCancelBtn} 
                onPress={() => setIsModalOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Voltar e não alterar horário"
               >
                  <Text style={[styles.modalCancelText, { color: theme.primary }]}>Voltar</Text>
               </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
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
    zIndex: 50,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: layout.screenHorizontalPadding,
    gap: layout.sectionGap,
  },
  header: {
    alignItems: "center",
  },
  heroIconCircle: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
  },
  bold: {
    fontWeight: "800",
  },
  optionsContainer: {
  },
  voiceFeedback: {
    alignItems: "center",
    paddingHorizontal: 12,
    marginTop: -4,
    marginBottom: -4,
  },
  voiceTranscriptText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#011030",
    textAlign: "center",
  },
  voiceErrorText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9F1239",
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: layout.cardBorderRadius,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  optionCardActive: {
    borderColor: "rgba(59, 130, 246, 0.1)",
    backgroundColor: "#F0F7FF",
    borderWidth: 1.5,
  },
  iconBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontWeight: "800",
  },
  optionDescription: {
    fontWeight: "500",
    lineHeight: 18,
  },
  bottomVoiceContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: layout.screenHorizontalPadding,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: layout.cardBorderRadius,
    padding: layout.cardPadding,
    gap: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  modalHeader: {
    alignItems: "center",
    gap: 8,
  },
  modalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#011030",
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
  },
  formGrid: {
    gap: 12,
  },
  formLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  formLabelSmall: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
    marginBottom: 2,
  },
  dateChipsContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  dateChip: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dateChipActive: {
    borderWidth: 2,
  },
  dateChipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  dateChipDay: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  timeChip: {
    height: 72,
    minWidth: 72,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipActive: {
    borderWidth: 2,
  },
  timeChipText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  modalActions: {
    gap: 8,
  },
  modalConfirmBtn: {
    height: layout.primaryButtonHeightSmall,
    borderRadius: layout.buttonBorderRadius,
  },
  modalCancelBtn: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});
