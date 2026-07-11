import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { OnboardingPagination } from "../src/onboarding/OnboardingPagination";
import { OnboardingSlide } from "../src/onboarding/OnboardingSlide";
import { onboardingSlides } from "../src/onboarding/onboardingSlides";
import { completeOnboarding } from "../src/services/onboardingStorage";
import { speak, stopSpeaking } from "../src/services/speech.service";
import { layout } from "../src/theme/layout";
import { useThemeColors } from "../src/theme/colors";

export default function OnboardingScreen() {
  const theme = useThemeColors();
  const { height, fontScale } = useWindowDimensions();
  const compact = height < 720 || fontScale > 1.15;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const slide = onboardingSlides[currentIndex];
  const isLastSlide = currentIndex === onboardingSlides.length - 1;

  useEffect(() => {
    stopSpeaking();
  }, [currentIndex]);

  useEffect(() => () => {
    stopSpeaking();
  }, []);

  async function finishOnboarding() {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await stopSpeaking();
      await completeOnboarding();
      router.replace("/");
    } finally {
      setIsCompleting(false);
    }
  }

  function goNext() {
    if (!isLastSlide) setCurrentIndex((index) => index + 1);
  }

  function goBack() {
    if (currentIndex > 0) setCurrentIndex((index) => index - 1);
  }

  async function listenToSlide() {
    await stopSpeaking();
    await speak(`${slide.title}. ${slide.description}`);
  }

  return (
    <ScreenContainer backgroundColor={theme.background} withPadding={false}>
      <View style={[styles.screen, compact && styles.screenCompact]}>
        <View style={styles.topBar}>
          <View style={styles.topSpacer} />
          <Pressable
            onPress={finishOnboarding}
            disabled={isCompleting}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Pular apresentação"
          >
            <Text style={[styles.skipText, { color: theme.primary }]}>Pular</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={compact}
          bounces={compact}
        >
          <OnboardingSlide slide={slide} compact={compact} onListen={listenToSlide} />
        </ScrollView>

        <OnboardingPagination currentIndex={currentIndex} total={onboardingSlides.length} />

        <View style={styles.actions}>
          {currentIndex > 0 && (
            <Pressable
              onPress={goBack}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: theme.card, borderColor: theme.border },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Voltar para página anterior"
            >
              <Text style={[styles.secondaryText, { color: theme.primaryDark }]}>Voltar</Text>
            </Pressable>
          )}
          <PrimaryButton
            title={isLastSlide ? "Começar" : "Próximo"}
            onPress={isLastSlide ? finishOnboarding : goNext}
            isLoading={isCompleting}
            accessibilityLabel={isLastSlide ? "Finalizar apresentação e começar" : "Ir para próxima página"}
            style={styles.primaryButton}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: layout.screenHorizontalPadding,
    paddingTop: 4,
    paddingBottom: 4,
  },
  screenCompact: {
    paddingHorizontal: layout.screenHorizontalPaddingSmall,
  },
  topBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
  },
  topSpacer: {
    flex: 1,
  },
  skipButton: {
    minWidth: 64,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 16,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  scrollContentCompact: {
    justifyContent: "flex-start",
    paddingVertical: 8,
  },
  actions: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    flexDirection: "row",
    gap: 12,
    paddingTop: 4,
  },
  secondaryButton: {
    flex: 1,
    minHeight: layout.primaryButtonHeightSmall,
    borderWidth: 1,
    borderRadius: layout.buttonBorderRadius,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryText: {
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    width: undefined,
    minHeight: layout.primaryButtonHeightSmall,
    borderRadius: layout.buttonBorderRadius,
  },
  pressed: {
    opacity: 0.65,
  },
});
