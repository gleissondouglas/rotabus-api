import { speak } from "../services/speech.service";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/colors";
import { logUserInteraction } from "../utils/devLogger";

type ListenOptionsButtonProps = {
  textToSpeak?: string;
  onPress?: () => void;
  label?: string;
  accessibilityLabel?: string;
  style?: ViewStyle | ViewStyle[];
};

export function ListenOptionsButton({
  textToSpeak,
  onPress,
  label = "Ouvir opções",
  accessibilityLabel,
  style,
}: ListenOptionsButtonProps) {
  const theme = useThemeColors();
  const isDark = theme.background === "#0F172A";

  function handlePress() {
    logUserInteraction({
      component: "<ListenOptionsButton />",
      label: accessibilityLabel || label,
      fileOrScreen: "src/components/ListenOptionsButton.tsx",
      action: "Falar orientações da tela (TTS)",
      details: textToSpeak ? { text: textToSpeak } : undefined,
    });

    if (onPress) {
      onPress();
      return;
    }

    speak(
      textToSpeak ||
        "Você está usando o RotaBus. Use os botões da tela para continuar.",
    );
  }

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.button, 
        { 
          backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9",
          borderRadius: 100,
        },
        style,
        pressed && { opacity: 0.7 }
      ]} 
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
    >
      <Ionicons name="volume-high-outline" size={20} color={theme.primary} />
      <Text style={[styles.text, { color: theme.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 64,
    paddingHorizontal: 24,
    marginTop: 8,
    gap: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
});
