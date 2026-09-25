import { Platform, Pressable, StyleSheet, Text, View, Dimensions, useColorScheme } from "react-native";

import type { VoiceLoopStatus } from "../hooks/useVoiceConversationLoop";
import { BottomVoiceMicButton } from "./BottomVoiceMicButton";
import { LiquidGlassView } from "./LiquidGlassView";
import { AdaptiveIcon } from "./AdaptiveIcon";
import { useThemeColors } from "../theme/colors";
import { logUserInteraction } from "../utils/devLogger";

type BottomActionBarStatus = VoiceLoopStatus | "success";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface BottomActionBarProps {
  status: BottomActionBarStatus;
  micLabel: string;
  onTypeDestination: () => void;
  onMicPress: () => void;
}

export function BottomActionBar({ status, micLabel, onTypeDestination, onMicPress }: BottomActionBarProps) {
  const isTypingDisabled = status === "speaking" || status === "processing" || status === "success";
  const theme = useThemeColors();
  const isDark = useColorScheme() === 'dark';

  function handleTypePress() {
    logUserInteraction({
      component: "<BottomActionBar (Botão Digitar)>",
      label: "Digitar destino",
      fileOrScreen: "src/components/BottomActionBar.tsx",
      action: "Abrir digitação de destino",
    });
    onTypeDestination();
  }

  return (
    <LiquidGlassView 
      style={[
        styles.pill,
        isDark 
          ? { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#131A26' } 
          : { borderColor: 'rgba(255,255,255,0.9)' }
      ]} 
      fallbackColor={theme.card}
    >
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.typeButton, pressed && styles.typeButtonPressed, isTypingDisabled && styles.typeButtonDisabled]}
          onPress={handleTypePress}
          disabled={isTypingDisabled}
          accessibilityLabel="Digitar destino"
          accessibilityRole="button"
        >
          <AdaptiveIcon iosSymbol="pencil" fallbackFamily="Ionicons" fallbackName="pencil" size={20} color={theme.text} />
          <Text style={[styles.typeText, { color: theme.text }]} numberOfLines={2}>Digitar{"\n"}destino</Text>
        </Pressable>
        <BottomVoiceMicButton
          status={status}
          label={micLabel}
          compact
          tone="primary"
          onPress={onMicPress}
          accessibilityLabel={micLabel.replace("\n", " ")}
          fileOrScreen="src/components/BottomActionBar.tsx"
        />
      </View>
    </LiquidGlassView>
  );
}

const APPLE_FONT = Platform.select({
  ios: { fontFamily: "System" },
  default: { fontFamily: "System" },
});

const styles = StyleSheet.create({
  pill: { width: SCREEN_WIDTH - 24, height: 76, borderRadius: 38, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 15, overflow: "hidden", borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", height: 76, paddingHorizontal: 6, paddingVertical: 6, gap: 4 },
  typeButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, borderRadius: 32 },
  typeButtonPressed: { opacity: 0.6 },
  typeButtonDisabled: { opacity: 0.4 },
  typeText: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3, lineHeight: 18, ...APPLE_FONT },
});
