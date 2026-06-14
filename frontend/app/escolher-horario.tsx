import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
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
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { TextField } from "../src/components/TextField";
import { useVoiceConversationLoop } from "../src/hooks/useVoiceConversationLoop";
import type { VoiceLoopStatus } from "../src/hooks/useVoiceConversationLoop";
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
  const voiceMode = String(params.voiceMode || "") === "true";

  const [mode, setMode] = useState<TimeMode>("NOW");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateText, setDateText] = useState(getTodayDateText());
  const [timeText, setTimeText] = useState(getCurrentTimeText());
  const [voiceStatus, setVoiceStatus] = useState<VoiceLoopStatus>("idle");

  const dateOptions = getNext7Days();

  function handleTimeTextChange(text: string) {
    const clean = text.replace(/[^0-9]/g, "");
    if (clean.length <= 2) {
      setTimeText(clean);
    } else {
      const hh = clean.substring(0, 2);
      const mm = clean.substring(2, 4);
      setTimeText(`${hh}:${mm}`);
    }
  }

  function handleQuickTime(minutesToAdd: number) {
    vibrationService.light();
    const now = new Date();
    const future = new Date(now.getTime() + minutesToAdd * 60 * 1000);
    const year = future.getFullYear();
    const month = String(future.getMonth() + 1).padStart(2, "0");
    const day = String(future.getDate()).padStart(2, "0");
    setDateText(`${year}-${month}-${day}`);
    setTimeText(`${String(future.getHours()).padStart(2, "0")}:${String(future.getMinutes()).padStart(2, "0")}`);
  }

  function adjustTime(minutesDiff: number) {
    try {
      vibrationService.light();
      const [hoursStr, minutesStr] = timeText.split(":");
      let hours = parseInt(hoursStr, 10);
      let minutes = parseInt(minutesStr, 10);
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        const now = new Date();
        hours = now.getHours();
        minutes = now.getMinutes();
      }

      let totalMinutes = hours * 60 + minutes + minutesDiff;
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
      }
      totalMinutes = totalMinutes % (24 * 60);

      const finalHours = Math.floor(totalMinutes / 60);
      const finalMinutes = totalMinutes % 60;

      const pad = (n: number) => String(n).padStart(2, "0");
      setTimeText(`${pad(finalHours)}:${pad(finalMinutes)}`);
    } catch (e) {
      console.log("Erro ao ajustar hora:", e);
    }
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
      voiceMode: voiceMode ? "true" : "false",
      timeType: type,
      dateTime,
    };
  }

  const { startLoop, stopAll } = useVoiceConversationLoop({
    onIntent: async (intent) => {
      const timeIntent = parseVoiceTimeIntent(intent.transcript);
      
      switch (timeIntent.type) {
        case "NOW":
          handleGoNow();
          break;
        case "DEPARTURE_TIME":
          validateAndNavigate("DEPARTURE", timeIntent.date, timeIntent.time);
          break;
        case "ARRIVAL_TIME":
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
    onStatusChange: setVoiceStatus,
  });

  useEffect(() => {
    if (!voiceMode) {
      return;
    }

    void startLoop(screenMessage);
    return () => {
      void stopAll();
    };
  }, [screenMessage, startLoop, stopAll, voiceMode]);

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
            paddingBottom: insets.bottom + 120
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

          {voiceMode && voiceStatus === "listening" && (
            <View
              style={styles.voiceHintCard}
              accessible={true}
              accessibilityLabel="Você pode responder por voz. Diga agora ou informe um horário."
            >
              <Ionicons name="mic" size={18} color={theme.primary} />
              <Text style={styles.voiceHintText}>
                {'Você pode dizer: "agora", "hoje às oito" ou "amanhã às nove".'}
              </Text>
            </View>
          )}

          <View style={[styles.optionsContainer, { gap: isSmallHeight ? layout.cardGapSmall : layout.cardGap }]}>
            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding },
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
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
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
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
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
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

      {/* TTS HELP FIXED AT BOTTOM */}
      <View style={[styles.bottomTtsContainer, { bottom: insets.bottom + 16 }]}>
         <ListenOptionsButton 
            textToSpeak={screenMessage} 
            accessibilityLabel="Ouvir as opções de horário"
          />
      </View>

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

                <View style={styles.timeInputRow}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      label="Escolha o horário"
                      placeholder="Ex: 10:30"
                      value={timeText}
                      onChangeText={handleTimeTextChange}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                  <View style={styles.timeAdjustmentColumn}>
                    <Text style={styles.adjustmentLabel}>Ajustar</Text>
                    <View style={styles.timeAdjustmentRow}>
                      <Pressable
                        onPress={() => adjustTime(-10)}
                        style={styles.adjustBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Diminuir dez minutos"
                      >
                        <Ionicons name="remove" size={20} color="#475569" />
                      </Pressable>
                      <Pressable
                        onPress={() => adjustTime(10)}
                        style={styles.adjustBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Aumentar dez minutos"
                      >
                        <Ionicons name="add" size={20} color="#475569" />
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Text style={styles.formLabelSmall}>Opções rápidas de horário</Text>
                <View style={styles.quickTimeContainer}>
                  <Pressable
                    onPress={() => handleQuickTime(0)}
                    style={styles.quickTimeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Definir para agora"
                  >
                    <Text style={[styles.quickTimeText, { color: theme.primary }]}>Agora</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleQuickTime(30)}
                    style={styles.quickTimeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Definir para daqui trinta minutos"
                  >
                    <Text style={[styles.quickTimeText, { color: theme.primary }]}>+30 min</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleQuickTime(60)}
                    style={styles.quickTimeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Definir para daqui uma hora"
                  >
                    <Text style={[styles.quickTimeText, { color: theme.primary }]}>+1h</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleQuickTime(120)}
                    style={styles.quickTimeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Definir para daqui duas horas"
                  >
                    <Text style={[styles.quickTimeText, { color: theme.primary }]}>+2h</Text>
                  </Pressable>
                </View>
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
  voiceHintCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E0ECFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  voiceHintText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    color: "#475569",
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
  bottomTtsContainer: {
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
  timeInputRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
    marginTop: 8,
  },
  timeAdjustmentColumn: {
    alignItems: "center",
    gap: 4,
  },
  adjustmentLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  timeAdjustmentRow: {
    flexDirection: "row",
    gap: 6,
  },
  adjustBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  quickTimeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  quickTimeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minWidth: 60,
    alignItems: "center",
  },
  quickTimeText: {
    fontSize: 14,
    fontWeight: "800",
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
