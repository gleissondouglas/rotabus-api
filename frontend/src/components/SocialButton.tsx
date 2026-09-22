import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/colors";

type SocialProvider = "apple" | "google";

interface SocialButtonProps {
  provider: SocialProvider;
  onPress: () => void;
}

import { useColorScheme } from "react-native";

export function SocialButton({ provider, onPress }: SocialButtonProps) {
  const theme = useThemeColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  
  const isApple = provider === "apple";
  const label = isApple ? "Continuar com a Apple" : "Continuar com o Google";
  const iconName = isApple ? "logo-apple" : "logo-google";
  
  const backgroundColor = isApple ? (isDark ? "#FFFFFF" : "#000000") : theme.card;
  const textColor = isApple ? (isDark ? "#000000" : "#FFFFFF") : theme.text;
  const borderColor = isApple ? "transparent" : theme.border;

  // A cor do ícone
  // Para Google, como o Ionicons usa 1 cor apenas, usamos a cor do texto ou azul padrão para dar destaque se necessário.
  // Vou deixar a cor do texto para manter o design clean.
  
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={iconName} size={20} color={textColor} style={styles.icon} />
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
});
