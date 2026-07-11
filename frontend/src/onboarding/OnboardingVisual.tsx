import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AssistantPresence } from "../components/AssistantPresence";
import { useThemeColors } from "../theme/colors";
import { OnboardingVisualType } from "./onboardingSlides";

type Props = {
  type: OnboardingVisualType;
  compact?: boolean;
};

export function OnboardingVisual({ type, compact = false }: Props) {
  const theme = useThemeColors();

  if (type === "assistant") {
    return (
      <View style={[styles.visualSurface, compact && styles.visualSurfaceCompact, { backgroundColor: theme.primaryLight }]}>
        <AssistantPresence compact={compact} />
      </View>
    );
  }

  if (type === "input") {
    return (
      <View style={[styles.visualSurface, compact && styles.visualSurfaceCompact, styles.inputVisual, { backgroundColor: theme.primaryLight }]}>
        <View style={[styles.actionBubble, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="mic" size={compact ? 25 : 31} color={theme.primary} />
          <Text style={[styles.actionLabel, { color: theme.text }]}>Falar</Text>
        </View>
        <View style={[styles.actionBubble, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <MaterialCommunityIcons name="keyboard-outline" size={compact ? 25 : 31} color={theme.primary} />
          <Text style={[styles.actionLabel, { color: theme.text }]}>Digitar</Text>
        </View>
      </View>
    );
  }

  const steps = [
    { label: "Destino", icon: "map-marker-check-outline" as const },
    { label: "Horário", icon: "clock-outline" as const },
    { label: "Rota", icon: "map-outline" as const },
  ];

  return (
    <View style={[styles.visualSurface, compact && styles.visualSurfaceCompact, styles.routeVisual, { backgroundColor: theme.primaryLight }]}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.routeItemRow}>
          <View style={[styles.routeStep, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MaterialCommunityIcons name={step.icon} size={compact ? 21 : 25} color={theme.primary} />
            <Text style={[styles.routeLabel, { color: theme.text }]}>{step.label}</Text>
          </View>
          {index < steps.length - 1 && (
            <Ionicons name="arrow-forward" size={18} color={theme.primary} accessibilityElementsHidden />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  visualSurface: {
    width: "100%",
    maxWidth: 360,
    minHeight: 188,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  visualSurfaceCompact: {
    minHeight: 142,
    padding: 16,
  },
  inputVisual: {
    flexDirection: "row",
    gap: 14,
  },
  actionBubble: {
    minWidth: 104,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  routeVisual: {
    flexDirection: "row",
  },
  routeItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  routeStep: {
    minWidth: 78,
    minHeight: 76,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  routeLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
});
