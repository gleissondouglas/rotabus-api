import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { speak } from "../services/speech.service";
import { colors } from "../theme/colors";

type ListenOptionsButtonProps = {
  textToSpeak?: string;
  onPress?: () => void;
  label?: string;
  accessibilityLabel?: string;
};

export function ListenOptionsButton({
  textToSpeak,
  onPress,
  label = "Ouvir opções",
  accessibilityLabel,
}: ListenOptionsButtonProps) {
  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }

    speak(
      textToSpeak ||
        "Você está usando o Nuvem. Use os botões da tela para continuar.",
    );
  }

  return (
    <Pressable 
      style={styles.button} 
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
    >
      <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0, 122, 255, 0.05)",
  },

  text: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
});
