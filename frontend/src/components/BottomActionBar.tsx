import { Pressable, StyleSheet, Text, View, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { VoiceLoopStatus } from "../hooks/useVoiceConversationLoop";
import { BottomVoiceMicButton } from "./BottomVoiceMicButton";

/** Superset do VoiceLoopStatus incluindo 'success', usado apenas na home. */
type BottomActionBarStatus = VoiceLoopStatus | "success";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface BottomActionBarProps {
  /**
   * Status atual do loop de voz, usado para refletir estado no botão mic.
   */
  status: BottomActionBarStatus;
  /**
   * Label dinâmico exibido no botão de microfone.
   */
  micLabel: string;
  /**
   * Callback ao pressionar o botão de digitar.
   */
  onTypeDestination: () => void;
  /**
   * Callback ao iniciar pressão no botão de microfone.
   */
  onMicPressIn: () => void;
  /**
   * Callback ao soltar o botão de microfone.
   */
  onMicPressOut: () => void;
}

/**
 * BottomActionBar — barra de ações fixa na parte inferior da tela home.
 * Contém o botão de digitar destino (esquerda) e o botão de voz (direita).
 */
export function BottomActionBar({
  status,
  micLabel,
  onTypeDestination,
  onMicPressIn,
  onMicPressOut,
}: BottomActionBarProps) {
  const isTypingDisabled =
    status === "speaking" || status === "processing" || status === "success";

  return (
    <View style={styles.pill}>
      <View style={styles.row}>
        {/* Botão de digitar destino */}
        <Pressable
          style={({ pressed }) => [
            styles.typeButton,
            pressed && styles.typeButtonPressed,
            isTypingDisabled && styles.typeButtonDisabled,
          ]}
          onPress={onTypeDestination}
          disabled={isTypingDisabled}
          accessibilityLabel="Digitar destino"
          accessibilityRole="button"
        >
          <Ionicons name="pencil" size={20} color="#011030" />
          <Text style={styles.typeText}>Digitar destino</Text>
        </Pressable>

        {/* Divisor vertical */}
        <View style={styles.divider} />

        {/* Botão de microfone com halo pulsante */}
        <BottomVoiceMicButton
          status={status}
          label={micLabel}
          compact
          tone="primary"
          mode="hold"
          onPressIn={onMicPressIn}
          onPressOut={onMicPressOut}
          accessibilityLabel={micLabel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: SCREEN_WIDTH - 24,
    height: 88,
    borderRadius: 44,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 88,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 8,
    borderRadius: 36,
  },
  typeButtonPressed: {
    opacity: 0.6,
  },
  typeButtonDisabled: {
    opacity: 0.4,
  },
  typeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#011030",
    letterSpacing: -0.3,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 4,
  },
});
