import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import { useThemeColors } from "../theme/colors";

interface LiveTranscriptProps {
  /**
   * Texto reconhecido. Se vazio ou undefined, o componente não renderiza.
   */
  transcript: string;
  /**
   * true = texto parcial (usuário ainda está falando)
   * false = texto final confirmado
   */
  isFinal: boolean;
  variant?: "default" | "conversation";
}

/**
 * LiveTranscript — exibe o texto reconhecido pelo usuário na área central da tela.
 * Aparece com animação suave e desaparece quando não há transcrição.
 */
export function LiveTranscript({
  transcript,
  isFinal,
  variant = "default",
}: LiveTranscriptProps) {
  const theme = useThemeColors();

  if (!transcript) {
    return null;
  }

  if (variant === "conversation") {
    return (
      <Animated.Text
        entering={FadeInDown.duration(250)}
        exiting={FadeOutUp.duration(180)}
        style={styles.conversationText}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={isFinal ? `Você disse: ${transcript}` : `Ouvindo: ${transcript}`}
      >
        {isFinal ? `Você disse: ${transcript}` : transcript}
      </Animated.Text>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.container,
        { borderColor: theme.primary + "33" }, // 20% opacity border
      ]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={isFinal ? `Você disse: ${transcript}` : `Ouvindo: ${transcript}`}
    >
      <View
        style={[
          styles.badge,
          { backgroundColor: isFinal ? theme.primary : "rgba(37,99,235,0.08)" },
        ]}
      >
        <Animated.Text
          style={[
            styles.badgeText,
            { color: isFinal ? "white" : theme.primary },
          ]}
        >
          {isFinal ? "Entendi" : "Ouvindo..."}
        </Animated.Text>
      </View>

      <Animated.Text style={styles.transcriptText}>
        {isFinal ? `Você disse: ${transcript}` : transcript}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 24,
    borderRadius: 20,
    backgroundColor: "rgba(37, 99, 235, 0.05)",
    borderWidth: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  transcriptText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#011030",
    textAlign: "center",
    lineHeight: 26,
  },
  conversationText: {
    fontSize: 22,
    fontWeight: "800",
    color: "white",
    lineHeight: 30,
    textAlign: "left",
  },
});
