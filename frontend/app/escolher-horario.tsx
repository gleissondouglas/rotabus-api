import { router, useLocalSearchParams } from "expo-router";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Modal,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, withSpring, withTiming } from "react-native-reanimated";
import { usePreventDoublePress } from "../src/hooks/usePreventDoublePress";

import { LiquidGlassView } from "../src/components/LiquidGlassView";
import { AdaptiveIcon } from "../src/components/AdaptiveIcon";
import { BackgroundGradient } from "../src/components/BackgroundGradient";
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";

import { BackButton } from "../src/components/BackButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { MarqueeText } from "../src/components/MarqueeText";
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
  const { height, width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isSmallHeight = height < 740;
  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const destination = String(params.destination || "");
  const destinationLat = String(params.destinationLat || "");
  const destinationLng = String(params.destinationLng || "");
  const selectedDestination = String(params.selectedDestination || "");
  const sessionId = String(params.sessionId || "");
  const isVoiceSearch = String(params.isVoiceSearch || "false");

  useAutoSpeakOnce(
    `choose-time-${sessionId || "manual"}-${destination}`,
    `Quando você quer ir? Escolha o horário da viagem até ${destination}.`,
    isVoiceSearch === "true"
  );


  const [mode, setMode] = useState<TimeMode>("NOW");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateText, setDateText] = useState(getTodayDateText());
  const [timeText, setTimeText] = useState(getCurrentTimeText());
  const isActionDisabled = false;

  const scrollViewRef = useRef<ScrollView>(null);

  const dateOptions = getNext7Days();
  const startHour = mode === "ARRIVAL" ? 6 : 4;

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    const isToday = dateText === getTodayDateText();
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = startHour; i < 24; i++) {
      const hr = String(i).padStart(2, "0");
      const subSlots = [`${hr}:00`, `${hr}:15`, `${hr}:30`, `${hr}:45`];
      
      for (const slot of subSlots) {
        if (isToday) {
          const [h, m] = slot.split(':').map(Number);
          if (h * 60 + m >= currentTotalMinutes) {
            slots.push(slot);
          }
        } else {
          slots.push(slot);
        }
      }
    }
    
    // Garantir que exista ao menos uma opção caso seja tarde da noite
    if (slots.length === 0) {
      slots.push("23:45");
    }
    
    return slots;
  }, [startHour, dateText]);

  useEffect(() => {
    if (isModalOpen) {
      let bestSlot = timeText;

      // Como o array timeSlots já não tem horários passados quando é "Hoje", 
      // basta verificar se o bestSlot atual ainda é uma opção válida.
      if (!timeSlots.includes(bestSlot)) {
         bestSlot = timeSlots.includes("08:00") && dateText !== getTodayDateText() 
           ? "08:00" 
           : timeSlots[0];
      }
      
      setTimeText(bestSlot);
      
      const index = timeSlots.indexOf(bestSlot);
      if (index !== -1 && scrollViewRef.current) {
        setTimeout(() => {
          // fixed width of 88px + 8px gap = 96px per item
          const itemX = index * 96;
          const centerOffset = itemX - (width / 2) + 44;
          scrollViewRef.current?.scrollTo({ x: Math.max(0, centerOffset), animated: true });
        }, 150); // wait a bit for modal to finish animating in
      }
    }
  }, [isModalOpen, mode, timeSlots, width, dateText, timeText]);


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
      timeType: type,
      dateTime,
      isVoiceSearch,
    };
  }



  const handleGoNow = usePreventDoublePress(async () => {
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
  });

  function handleOpenTimeSelector(selectedMode: "DEPARTURE" | "ARRIVAL") {
    vibrationService.light();
    setMode(selectedMode);
    setIsModalOpen(true);
  }

  const validateAndNavigate = usePreventDoublePress(async (type: "DEPARTURE" | "ARRIVAL", date: string, time: string) => {
    try {
      vibrationService.selection();
      const dateTime = buildLocalDateTimeFromInputs(date, time);
      
      const now = new Date();
      const selectedDate = new Date(dateTime);

      const hour = selectedDate.getHours();

      const minOperationalHour = type === "ARRIVAL" ? 6 : 4;

      if (hour < minOperationalHour || hour > 23) {
        vibrationService.error();
        const alertMsg = type === "ARRIVAL"
          ? "Horário de chegada indisponível. Escolha um horário entre 06:00 e 23:59."
          : "Horário de saída indisponível. Escolha um horário entre 04:00 e 23:59.";

        Alert.alert("Horário fora de operação", alertMsg);
        return;
      }
      
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
  });

  function handleConfirmCustomTime() {
    validateAndNavigate(mode === "ARRIVAL" ? "ARRIVAL" : "DEPARTURE", dateText, timeText);
    setIsModalOpen(false);
  }



  return (
    <View style={styles.screen}>
      <BackgroundGradient />
      {/* Top Bar (Floating Glass Pill) */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topBarInner} pointerEvents="box-none">
          <BackButton accessibilityLabel="Voltar para a tela anterior" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: insets.top + (isSmallHeight ? 48 : 56),
            paddingBottom: insets.bottom + 150
          }
        ]}
      >
        <Animated.View 
          entering={FadeInUp.duration(400)} 
          style={[styles.content, { paddingHorizontal: isSmallHeight ? layout.screenHorizontalPaddingSmall : layout.screenHorizontalPadding, gap: isSmallHeight ? layout.sectionGapSmall : layout.sectionGap }]}
        >
          <View style={[styles.header, { gap: isSmallHeight ? 8 : 12 }]}>

            <Text style={[
              styles.title, 
              { color: theme.text },
              { fontSize: isSmallHeight ? layout.titleFontSizeSmall : layout.titleFontSize }
            ]} maxFontSizeMultiplier={1.2}>Quando você quer ir?</Text>
            <View style={{ width: '100%', alignItems: 'center' }}>
              <Text 
                style={[
                  styles.subtitle, 
                  { color: theme.textMuted, textAlign: "center" },
                  { fontSize: isSmallHeight ? layout.subtitleFontSizeSmall : layout.subtitleFontSize }
                ]} 
                maxFontSizeMultiplier={1.1}
              >
                Escolha o horário da viagem até
              </Text>
              <View style={{ width: '100%', alignItems: 'center', marginTop: 2 }}>
                <MarqueeText
                  style={[
                    styles.bold,
                    { color: theme.primary, textAlign: 'center' },
                    { fontSize: isSmallHeight ? layout.subtitleFontSizeSmall + 1 : layout.subtitleFontSize + 1 }
                  ]}
                  speed={32}
                  delay={1400}
                >
                  {destination}
                </MarqueeText>
              </View>
            </View>
          </View>


          <View style={[styles.optionsContainer, { gap: isSmallHeight ? layout.cardGapSmall : layout.cardGap }]}>
            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding, backgroundColor: theme.card, borderColor: theme.border },
                (pressed || isActionDisabled) && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
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
                <AdaptiveIcon 
                  iosSymbol="clock.fill"
                  fallbackFamily="MaterialCommunityIcons"
                  fallbackName="clock-fast" 
                  size={isSmallHeight ? 24 : 28} 
                  color={theme.primary} 
                />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[
                  styles.optionTitle, 
                  { color: theme.text },
                  { fontSize: isSmallHeight ? layout.cardTitleFontSizeSmall : layout.cardTitleFontSize }
                ]} maxFontSizeMultiplier={1.2}>Agora</Text>
                <Text style={[
                  styles.optionDescription, 
                  { color: theme.textMuted },
                  { fontSize: isSmallHeight ? layout.cardSubtitleFontSizeSmall : layout.cardSubtitleFontSize }
                ]} maxFontSizeMultiplier={1.1}>
                  Buscar o próximo ônibus.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.textMuted} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding, backgroundColor: theme.card, borderColor: theme.border },
                (pressed || isActionDisabled) && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
              disabled={isActionDisabled}
              onPress={() => handleOpenTimeSelector("DEPARTURE")}
              accessibilityRole="button"
              accessibilityLabel="Outro horário. Escolha dia e hora de saída."
            >
              <View style={[
                styles.iconBox, 
                { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                { width: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  height: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  borderRadius: 14 }
              ]}>
                <AdaptiveIcon 
                  iosSymbol="calendar.badge.clock"
                  fallbackFamily="MaterialCommunityIcons"
                  fallbackName="calendar-clock" 
                  size={isSmallHeight ? 24 : 28} 
                  color={theme.primary} 
                />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[
                  styles.optionTitle, 
                  { color: theme.text },
                  { fontSize: isSmallHeight ? layout.cardTitleFontSizeSmall : layout.cardTitleFontSize }
                ]} maxFontSizeMultiplier={1.2}>Outro horário</Text>
                <Text style={[
                  styles.optionDescription, 
                  { color: theme.textMuted },
                  { fontSize: isSmallHeight ? layout.cardSubtitleFontSizeSmall : layout.cardSubtitleFontSize }
                ]} maxFontSizeMultiplier={1.1}>
                  Escolha dia e hora.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.textMuted} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding, backgroundColor: theme.card, borderColor: theme.border },
                (pressed || isActionDisabled) && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
              disabled={isActionDisabled}
              onPress={() => handleOpenTimeSelector("ARRIVAL")}
              accessibilityRole="button"
              accessibilityLabel="Chegada prevista. Defina a hora que quer chegar."
            >
              <View style={[
                styles.iconBox, 
                { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                { width: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  height: isSmallHeight ? layout.cardIconSizeSmall : layout.cardIconSize, 
                  borderRadius: 14 }
              ]}>
                <AdaptiveIcon 
                  iosSymbol="flag.checkered"
                  fallbackFamily="MaterialCommunityIcons"
                  fallbackName="flag-checkered" 
                  size={isSmallHeight ? 24 : 28} 
                  color={theme.primary} 
                />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[
                  styles.optionTitle, 
                  { color: theme.text },
                  { fontSize: isSmallHeight ? layout.cardTitleFontSizeSmall : layout.cardTitleFontSize }
                ]} maxFontSizeMultiplier={1.2}>Chegar até um horário</Text>
                <Text style={[
                  styles.optionDescription, 
                  { color: theme.textMuted },
                  { fontSize: isSmallHeight ? layout.cardSubtitleFontSizeSmall : layout.cardSubtitleFontSize }
                ]} maxFontSizeMultiplier={1.1}>
                  Defina a hora de chegada.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.textMuted} />
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>


      {/* TIME SELECTOR MODAL */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <LiquidGlassView style={StyleSheet.absoluteFill} fallbackColor="rgba(0,0,0,0.6)" />
        <Pressable style={styles.modalOverlay} onPress={() => setIsModalOpen(false)}>
          <Pressable onPress={() => { /* Impede fechamento ao clicar no conteúdo */ }}>
            <Animated.View entering={PopMenuEntering} style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
               <View style={[styles.modalIconBg, { backgroundColor: theme.primaryLight }]}>
                  <AdaptiveIcon 
                    iosSymbol={mode === "DEPARTURE" ? "calendar" : "flag"}
                    fallbackFamily="Ionicons"
                    fallbackName={mode === "DEPARTURE" ? "calendar-outline" : "flag-outline"} 
                    size={28} 
                    color={theme.primary} 
                  />
               </View>
               <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {mode === "DEPARTURE" ? "Horário de saída" : "Horário de chegada"}
               </Text>
               <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                  {mode === "DEPARTURE" ? "Escolha quando você quer sair." : "Escolha quando quer chegar ao destino."}
               </Text>
            </View>

            <View style={styles.formGrid}>
                <Text style={[styles.formLabel, { color: theme.text }]}>Escolha um dia nos próximos 7 dias</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dateChipsContainer}
                >
                  {dateOptions.map((opt: { dateText: string; label: string; dayNum: number }) => {
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
                          { backgroundColor: theme.background, borderColor: theme.border },
                          isSelected && [styles.dateChipActive, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${opt.label === 'Hoje' ? 'Hoje' : opt.label === 'Amanhã' ? 'Amanhã' : opt.label}, dia ${opt.dayNum}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={[styles.dateChipLabel, { color: theme.textMuted }, isSelected && { color: theme.primary }]}>
                          {opt.label}
                        </Text>
                        <Text style={[styles.dateChipDay, { color: theme.text }, isSelected && { color: theme.primary }]}>
                          {opt.dayNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.formLabel, { color: theme.text }]}>Escolha o horário</Text>
                <ScrollView 
                  ref={scrollViewRef}
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
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderColor: 'transparent' },
                          isSelected && [styles.timeChipActive, { borderColor: theme.primary, backgroundColor: theme.primaryLight }]
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Horário ${slot}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={[styles.timeChipText, { color: theme.text }, isSelected && { color: theme.primary }]}>
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
        </Pressable>
      </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: layout.screenHorizontalPadding,
    gap: layout.sectionGap,
  },
  header: {
    alignItems: "center",
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
    borderWidth: 1,
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
    justifyContent: "center",
    padding: layout.screenHorizontalPaddingSmall,
  },
  modalContent: {
    borderRadius: 32,
    padding: 24,
    paddingTop: 32,
    gap: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
  },
  modalHeader: {
    alignItems: "center",
    gap: 12,
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
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
  },
  formGrid: {
    gap: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  formLabelSmall: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 2,
  },
  dateChipsContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  dateChip: {
    width: 72,
    height: 80,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dateChipActive: {
    borderWidth: 2,
  },
  dateChipLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  dateChipDay: {
    fontSize: 22,
    fontWeight: "900",
  },
  timeChip: {
    height: 52,
    width: 96,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipActive: {
    borderWidth: 2,
  },
  timeChipText: {
    fontSize: 17,
    fontWeight: "800",
  },
  modalActions: {
    gap: 8,
    marginTop: 8,
  },
  modalConfirmBtn: {
    height: 56,
    borderRadius: 100,
  },
  modalCancelBtn: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "800",
  },
});

const PopMenuEntering = () => {
  'worklet';
  return {
    initialValues: {
      opacity: 0,
      transform: [{ scale: 0.9 }, { translateY: 30 }],
    },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [
        { scale: withSpring(1, { damping: 22, stiffness: 220 }) },
        { translateY: withSpring(0, { damping: 22, stiffness: 220 }) },
      ],
    },
  };
};
