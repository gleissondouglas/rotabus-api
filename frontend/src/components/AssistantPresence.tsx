import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";

import { useThemeColors } from "../theme/colors";

type AssistantPresenceProps = {
  compact?: boolean;
};

/**
 * Presença visual da assistente Nuvem.
 * Usa somente opacity e transform para manter a animação no driver nativo.
 */
export function AssistantPresence({ compact = false }: AssistantPresenceProps) {
  const theme = useThemeColors();
  const breath = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active || reduceMotion) return;

      animation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(breath, {
              toValue: 1.045,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(breath, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(float, {
              toValue: -4,
              duration: 2200,
              useNativeDriver: true,
            }),
            Animated.timing(float, {
              toValue: 0,
              duration: 2200,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      animation.start();
    });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [breath, float]);

  const size = compact ? 116 : 156;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Assistente Nuvem"
    >
      <Animated.View
        style={[
          styles.halo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.primary,
            transform: [{ scale: breath }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.cloud,
          {
            width: size * 0.72,
            height: size * 0.52,
            transform: [{ translateY: float }, { scale: breath }],
          },
        ]}
      >
        <View style={[styles.cloudBase, { backgroundColor: theme.primary }]} />
        <View style={[styles.cloudBubble, styles.cloudBubbleLeft, { backgroundColor: theme.primary }]} />
        <View style={[styles.cloudBubble, styles.cloudBubbleCenter, { backgroundColor: theme.primary }]} />
        <View style={[styles.cloudBubble, styles.cloudBubbleRight, { backgroundColor: theme.primary }]} />
        <View style={styles.highlight} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    opacity: 0.09,
  },
  cloud: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  cloudBase: {
    position: "absolute",
    bottom: "8%",
    width: "92%",
    height: "48%",
    borderRadius: 999,
  },
  cloudBubble: {
    position: "absolute",
    borderRadius: 999,
  },
  cloudBubbleLeft: {
    left: "5%",
    bottom: "19%",
    width: "40%",
    aspectRatio: 1,
  },
  cloudBubbleCenter: {
    left: "30%",
    top: "2%",
    width: "48%",
    aspectRatio: 1,
  },
  cloudBubbleRight: {
    right: "3%",
    bottom: "17%",
    width: "36%",
    aspectRatio: 1,
  },
  highlight: {
    position: "absolute",
    top: "22%",
    left: "40%",
    width: "22%",
    height: "10%",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.48)",
    transform: [{ rotate: "-12deg" }],
  },
});
