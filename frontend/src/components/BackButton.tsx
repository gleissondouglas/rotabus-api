import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme/colors";

type BackButtonProps = {
  label?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function BackButton({ label = "Voltar", onPress, accessibilityLabel }: BackButtonProps) {
  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }

    router.back();
  }

  return (
    <Pressable 
      style={styles.button} 
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
    >
      <Ionicons name="chevron-back" size={24} color={colors.text} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 12, // slightly bigger touch target
    paddingRight: 24,
    marginLeft: -4,
  },

  text: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
});
