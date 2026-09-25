import { BackgroundGradient } from "../src/components/BackgroundGradient";
import { LiquidGlassView } from "../src/components/LiquidGlassView";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";
import { useAccessibility } from "../src/contexts/AccessibilityContext";
import { useThemeColors } from "../src/theme/colors";

export default function AccessibilityScreen() {
  const {
    slowVoice,
    autoRead,
    vibration,
    updateSettings,
  } = useAccessibility();

  const theme = useThemeColors();
  const insets = useSafeAreaInsets();

  const screenMessage =
    "Você está na tela de acessibilidade. Aqui você pode configurar voz mais lenta, leitura automática das telas e vibração.";

  useAutoSpeakOnce("acessibilidade", screenMessage);

  return (
    <View style={{ flex: 1 }}>
      <BackgroundGradient />
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <BackButton />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
      >
        <Animated.View entering={FadeInUp.duration(600)} style={styles.content}>
          <View style={styles.textHeader}>
            <Text style={[styles.title, { color: theme.text }]}>Acessibilidade</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Personalize voz e avisos para sua navegação.
            </Text>
          </View>

          <LiquidGlassView style={styles.card} fallbackColor={theme.card}>
            <View style={styles.option}>
              <View style={styles.optionTextBox}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>Voz mais lenta</Text>
                <Text style={[styles.optionDescription, { color: theme.textMuted }]}>
                  Faz a assistente falar com mais calma e clareza.
                </Text>
              </View>

              <Switch
                value={slowVoice}
                onValueChange={(val) => updateSettings({ slowVoice: val })}
                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.option}>
              <View style={styles.optionTextBox}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>
                  Leitura automática
                </Text>
                <Text style={[styles.optionDescription, { color: theme.textMuted }]}>
                  A assistente narra as telas ao entrar nelas.
                </Text>
              </View>

              <Switch
                value={autoRead}
                onValueChange={(val) => updateSettings({ autoRead: val })}
                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.option}>
              <View style={styles.optionTextBox}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>Vibração</Text>
                <Text style={[styles.optionDescription, { color: theme.textMuted }]}>
                  Usa vibração para avisos e confirmações.
                </Text>
              </View>

              <Switch
                value={vibration}
                onValueChange={(val) => updateSettings({ vibration: val })}
                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
              />
            </View>
          </LiquidGlassView>

          <View style={styles.footer}>
            <Text style={[styles.note, { color: theme.textMuted }]}>
              Suas preferências são salvas automaticamente.
            </Text>

            <View style={styles.ttsWrapper}>
              <ListenOptionsButton textToSpeak={screenMessage} />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    gap: 32,
    paddingHorizontal: 20,
  },

  textHeader: {
    alignItems: "center",
    gap: 8,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 17,
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 24,
  },

  card: {
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },

  optionTextBox: {
    flex: 1,
  },

  optionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },

  optionDescription: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },

  divider: {
    height: 1,
  },

  footer: {
    alignItems: "center",
    gap: 24,
  },

  note: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },

  ttsWrapper: {
    opacity: 0.8,
  },
});
