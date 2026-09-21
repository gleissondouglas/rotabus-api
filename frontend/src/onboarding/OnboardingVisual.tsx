import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { LiquidGlassView } from "../components/LiquidGlassView";
import { useThemeColors } from "../theme/colors";
import { OnboardingVisualType } from "./onboardingSlides";

type Props = {
  type: OnboardingVisualType;
  compact?: boolean;
};

export function OnboardingVisual({ type, compact = false }: Props) {
  const theme = useThemeColors();

  if (type === "assistant" || type === "route") {
    return (
      <View style={[styles.busContainer, compact && styles.busContainerCompact]}>
        {/* Placeholder para a ilustração do ônibus. Quando o asset real estiver disponível, substitua o Ionicons abaixo pelo componente <Image /> correspondente. */}
        <Ionicons name="bus" size={compact ? 120 : 180} color={theme.primary} />
      </View>
    );
  }

  if (type === "input") {
    return (
      <View style={[styles.inputVisual, compact && styles.inputVisualCompact]}>
        <View style={styles.actionColumn}>
          <LiquidGlassView style={styles.actionBubble} intensity={50} fallbackColor={theme.card} disableDefaultStyles>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(255, 255, 255, 0.4)", borderRadius: 46 }]} />
            <Ionicons name="mic" size={compact ? 28 : 34} color={theme.primary} />
          </LiquidGlassView>
          <Text style={[styles.actionLabel, { color: theme.text }]}>Falar</Text>
        </View>

        <View style={styles.actionColumn}>
          <LiquidGlassView style={styles.actionBubble} intensity={50} fallbackColor={theme.card} disableDefaultStyles>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(255, 255, 255, 0.4)", borderRadius: 46 }]} />
            <Ionicons name="pencil" size={compact ? 26 : 32} color={theme.primary} />
          </LiquidGlassView>
          <Text style={[styles.actionLabel, { color: theme.text }]}>Digitar</Text>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  busContainer: {
    width: "100%",
    minHeight: 188,
    alignItems: "center",
    justifyContent: "center",
  },
  busContainerCompact: {
    minHeight: 142,
  },
  inputVisual: {
    flexDirection: "row",
    gap: 40,
    justifyContent: "center",
    minHeight: 188,
    alignItems: "center",
  },
  inputVisualCompact: {
    minHeight: 142,
  },
  actionColumn: {
    alignItems: "center",
    gap: 16,
  },
  actionBubble: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});

