import type { VoiceLoopStatus } from "../hooks/useVoiceConversationLoop";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "../theme/colors";

export function VoiceResponseButton({ status, onPress }: { status: VoiceLoopStatus; onPress: () => void }) {
  const theme = useThemeColors();
  const processing = status === "processing";
  const disabled = status === "listening" || status === "speaking" || processing;
  const isError = status === "error";
  const label = status === "listening" ? "Ouvindo..." : status === "processing" ? "Processando..." : status === "speaking" ? "Falando..." : isError ? "Tentar novamente" : "Responder por voz";
  const icon = status === "error" ? "refresh" : status === "speaking" ? "volume-high" : "mic";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, { borderColor: isError ? theme.warning : theme.primary, backgroundColor: isError ? "#FFFBEB" : theme.white }, (pressed || disabled) && styles.disabled]}
    >
      {processing ? <ActivityIndicator color={theme.primary} /> : <Ionicons name={icon} size={20} color={isError ? theme.warning : theme.primary} />}
      <Text style={[styles.label, { color: isError ? theme.warning : theme.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: "100%", minHeight: 56, borderRadius: 28, borderWidth: 2, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  label: { fontSize: 17, fontWeight: "800" },
  disabled: { opacity: 0.65 },
});
