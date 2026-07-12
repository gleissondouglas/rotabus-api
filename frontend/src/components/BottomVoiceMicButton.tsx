import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

import { useThemeColors } from "../theme/colors";
import type { VoiceLoopStatus } from "../hooks/useVoiceConversationLoop";

type BottomVoiceMicButtonProps = {
  status: VoiceLoopStatus | "success";
  label: string;
  helperText?: string;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  compact?: boolean;
  tone?: "soft" | "primary";
};

export function BottomVoiceMicButton({
  status,
  label,
  helperText,
  disabled = false,
  onPress,
  accessibilityLabel,
  compact = false,
  tone = "soft",
}: BottomVoiceMicButtonProps) {
  const theme = useThemeColors();
  const pulse = useSharedValue(1);
  const isListening = status === "listening";
  const isProcessing = status === "processing" || status === "success";
  const isError = status === "error";
  const isDisabled = disabled || status === "speaking" || isProcessing;
  const isPrimaryTone = tone === "primary";
  const foregroundColor = isError
    ? theme.primary
    : isPrimaryTone || isListening
      ? theme.white
      : theme.primary;

  useEffect(() => {
    if (isListening) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      return;
    }

    pulse.value = withTiming(1, { duration: 300 });
  }, [isListening, pulse]);

  const micAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: isListening
      ? interpolate(pulse.value, [1, 1.04], [0.18, 0.40])
      : 0,
    transform: [{ scale: interpolate(pulse.value, [1, 1.04], [1.04, 1.16]) }],
  }));

  return (
    <View style={[styles.wrapper, compact && styles.compactWrapper]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          compact && styles.compactGlow,
          { backgroundColor: theme.primary },
          glowStyle,
        ]}
      />
      <Animated.View style={[compact && styles.compactAnimatedWrapper, micAnimatedStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            compact && styles.compactButton,
            isPrimaryTone && {
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
            },
            isListening && {
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
              shadowOpacity: 0.45,
              shadowRadius: 18,
              elevation: 8,
            },
            isError && styles.errorButton,
            isError && { borderWidth: 2, borderColor: theme.primary, shadowOpacity: 0.12 },
            (pressed || isDisabled) && { opacity: isListening ? 0.9 : 0.65 },
          ]}
          disabled={isDisabled}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || label}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={foregroundColor} />
          ) : (
            <Ionicons name={isError ? "refresh" : "mic"} size={20} color={foregroundColor} style={styles.icon} />
          )}
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, compact && styles.compactLabel, { color: foregroundColor }]}>
            {label}
          </Text>
        </Pressable>
      </Animated.View>
      {!!helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", minHeight: 74, position: "relative" },
  compactWrapper: { flex: 1, minHeight: 52 },
  compactAnimatedWrapper: { width: "100%" },
  glow: { position: "absolute", top: 0, width: 230, height: 52, borderRadius: 999 },
  compactGlow: { width: "100%" },
  button: { height: 52, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 24, minWidth: 220, backgroundColor: "rgba(59, 130, 246, 0.08)", shadowColor: "#2563EB", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  compactButton: { minWidth: 0, width: "100%", paddingHorizontal: 12 },
  errorButton: { backgroundColor: "#FFFFFF" },
  icon: { marginRight: 8 },
  label: { fontSize: 16, fontWeight: "800" },
  compactLabel: { fontSize: 14 },
  helperText: { color: "#64748B", fontSize: 12, fontWeight: "700", marginTop: 7, textAlign: "center" },
});
