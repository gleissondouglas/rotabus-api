import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemeColors } from "../theme/colors";
import { OnboardingSlideData } from "./onboardingSlides";
import { OnboardingVisual } from "./OnboardingVisual";

type Props = {
  slide: OnboardingSlideData;
  compact?: boolean;
  onListen: () => void;
};

export function OnboardingSlide({ slide, compact = false, onListen }: Props) {
  const theme = useThemeColors();

  return (
    <View style={styles.container}>
      <OnboardingVisual type={slide.visual} compact={compact} />

      <View style={styles.copy}>
        <Text
          style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}
          maxFontSizeMultiplier={1.45}
        >
          {slide.title}
        </Text>
        <Text style={[styles.description, { color: theme.textMuted }]} maxFontSizeMultiplier={1.55}>
          {slide.description}
        </Text>
        {slide.example && (
          <View style={[styles.example, { backgroundColor: theme.primaryLight }]}>
            <Text style={[styles.exampleText, { color: theme.primaryDark }]} maxFontSizeMultiplier={1.4}>
              “{slide.example}”
            </Text>
          </View>
        )}
        <Pressable
          onPress={onListen}
          style={({ pressed }) => [styles.listenButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Ouvir conteúdo da página: ${slide.title}`}
        >
          <Ionicons name="volume-medium-outline" size={21} color={theme.primary} />
          <Text style={[styles.listenText, { color: theme.primary }]}>Ouvir</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    gap: 24,
  },
  copy: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 32,
  },
  description: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "400",
    textAlign: "center",
  },
  example: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  exampleText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
  },
  listenButton: {
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  listenText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.65,
  },
});
