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
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { TextField } from "../src/components/TextField";
import { useAutoSpeak } from "../src/hooks/useAutoSpeak";
import { useThemeColors } from "../src/theme/colors";
import { layout } from "../src/theme/layout";
import { vibrationService } from "../src/services/vibration.service";
import {
  buildLocalDateTimeFromInputs,
  formatLocalDateTimeWithOffset,
  getCurrentTimeText,
  getTodayDateText,
} from "../src/utils/date-time";

type TimeMode = "NOW" | "DEPARTURE" | "ARRIVAL";

export default function ChooseTimeScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const isSmallHeight = height < 740;
  const isVerySmallHeight = height < 680;

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const destination = String(params.destination || "");
  const destinationLat = String(params.destinationLat || "");
  const destinationLng = String(params.destinationLng || "");

  const [mode, setMode] = useState<TimeMode>("NOW");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateText, setDateText] = useState(getTodayDateText());
  const [timeText, setTimeText] = useState(getCurrentTimeText());

  const screenMessage =
    "Quando você quer ir? Toque em agora para buscar imediatamente, ou escolha outro horário de saída ou chegada.";

  useAutoSpeak(screenMessage);

  function handleGoNow() {
    vibrationService.selection();
    const now = new Date();
    const dateTime = formatLocalDateTimeWithOffset(now);

    router.push({
      pathname: "/processando",
      params: {
        latitude,
        longitude,
        destination,
        destinationLat,
        destinationLng,
        timeType: "DEPARTURE",
        dateTime,
      },
    });
  }

  function handleOpenTimeSelector(selectedMode: "DEPARTURE" | "ARRIVAL") {
    vibrationService.light();
    setMode(selectedMode);
    setIsModalOpen(true);
  }

  function handleConfirmCustomTime() {
    try {
      vibrationService.selection();
      const dateTime = buildLocalDateTimeFromInputs(dateText, timeText);
      setIsModalOpen(false);

      router.push({
        pathname: "/processando",
        params: {
          latitude,
          longitude,
          destination,
          destinationLat,
          destinationLng,
          timeType: mode === "ARRIVAL" ? "ARRIVAL" : "DEPARTURE",
          dateTime,
        },
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

  const isCustomMode = mode === "DEPARTURE" || mode === "ARRIVAL";

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
                <TextField
                  label="Data da viagem"
                  placeholder="Ex: 2026-05-10"
                  value={dateText}
                  onChangeText={setDateText}
                  keyboardType="numbers-and-punctuation"
                />

                <TextField
                  label={mode === "DEPARTURE" ? "Hora de saída" : "Hora de chegada"}
                  placeholder="Ex: 10:30"
                  value={timeText}
                  onChangeText={setTimeText}
                  keyboardType="numbers-and-punctuation"
                />
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
