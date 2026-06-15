import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";

import { useThemeColors } from "../theme/colors";

export type VoiceVisualizerState =
  | "idle"
  | "speaking"
  | "listening"
  | "processing";

interface VoiceVisualizerProps {
  state: VoiceVisualizerState;
  size?: "compact" | "large";
}

// Configuração de cada barra: altura máxima e delay de animação
// para criar o efeito de onda orgânico
const BAR_CONFIGS = [
  { maxHeight: 18, delay: 0 },
  { maxHeight: 34, delay: 100 },
  { maxHeight: 26, delay: 200 },
  { maxHeight: 42, delay: 60 },
  { maxHeight: 28, delay: 160 },
  { maxHeight: 36, delay: 80 },
  { maxHeight: 20, delay: 220 },
];

const MIN_HEIGHT = 6;
const COMPACT_BAR_WIDTH = 4;
const LARGE_BAR_WIDTH = 10;
const COMPACT_BAR_GAP = 5;
const LARGE_BAR_GAP = 12;
const ANIMATION_DURATION_SPEAKING = 520;
const ANIMATION_DURATION_LISTENING = 280;
const ANIMATION_DURATION_PROCESSING = 780;

interface BarProps {
  maxHeight: number;
  delay: number;
  state: VoiceVisualizerState;
  color: string;
  size: "compact" | "large";
}

function Bar({ maxHeight, delay, state, color, size }: BarProps) {
  const height = useSharedValue(MIN_HEIGHT);
  const isLarge = size === "large";
  const minHeight = isLarge ? 18 : MIN_HEIGHT;
  const scaledMaxHeight = isLarge ? maxHeight * 2.15 : maxHeight;

  useEffect(() => {
    if (state === "speaking") {
      const speechPeak = scaledMaxHeight * 0.85;
      const speechLow = minHeight + (isLarge ? 8 : 0);
      height.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(speechPeak, { duration: ANIMATION_DURATION_SPEAKING }),
            withTiming(speechLow, { duration: ANIMATION_DURATION_SPEAKING }),
          ),
          -1,
          false,
        ),
      );
      return;
    }

    if (state === "listening") {
      const listenPeak = scaledMaxHeight;
      const listenLow = minHeight + (isLarge ? 4 : 2);
      height.value = withDelay(
        delay / 2,
        withRepeat(
          withSequence(
            withTiming(listenPeak, { duration: ANIMATION_DURATION_LISTENING }),
            withTiming(listenLow, {
              duration: ANIMATION_DURATION_LISTENING,
            }),
          ),
          -1,
          false,
        ),
      );
      return;
    }

    if (state === "processing") {
      const processingPeak = minHeight + (isLarge ? 16 : 8);
      height.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(processingPeak, { duration: ANIMATION_DURATION_PROCESSING }),
            withTiming(minHeight, { duration: ANIMATION_DURATION_PROCESSING }),
          ),
          -1,
          true,
        ),
      );
      return;
    }

    // idle — recolhe suavemente para a altura mínima
    height.value = withTiming(minHeight, { duration: 400 });
  }, [state, scaledMaxHeight, minHeight, delay, height, isLarge]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: isLarge ? LARGE_BAR_WIDTH : COMPACT_BAR_WIDTH,
          borderRadius: (isLarge ? LARGE_BAR_WIDTH : COMPACT_BAR_WIDTH) / 2,
          minHeight,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

/**
 * VoiceVisualizer — barrinhas de áudio animadas que refletem o estado da assistente.
 * Estados: idle | speaking | listening | processing
 */
export function VoiceVisualizer({ state, size = "compact" }: VoiceVisualizerProps) {
  const theme = useThemeColors();

  // Cor das barrinhas muda conforme o estado
  const barColor = state === "idle" ? "rgba(37, 99, 235, 0.28)" : theme.primary;

  return (
    <View
      style={[
        styles.container,
        size === "large" && styles.largeContainer,
        { gap: size === "large" ? LARGE_BAR_GAP : COMPACT_BAR_GAP },
      ]}
      accessibilityLabel={
        state === "speaking"
          ? "Assistente falando"
          : state === "listening"
            ? "Ouvindo você"
            : state === "processing"
              ? "Processando"
              : "Assistente em espera"
      }
      accessibilityRole="image"
    >
      {BAR_CONFIGS.map((config, index) => (
        <Bar
          key={index}
          maxHeight={config.maxHeight}
          delay={config.delay}
          state={state}
          color={barColor}
          size={size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
  },
  largeContainer: {
    height: 128,
  },
  bar: {
    minHeight: MIN_HEIGHT,
  },
});
