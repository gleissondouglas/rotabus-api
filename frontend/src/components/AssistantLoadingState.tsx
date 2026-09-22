import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, useWindowDimensions, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, withSequence, withDelay } from 'react-native-reanimated';
import { useThemeColors } from '../theme/colors';
import { layout } from '../theme/layout';

export interface LoadingStep {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'loading' | 'completed';
}

interface AssistantLoadingStateProps {
  title: string;
  destinationName?: string;
  transcript?: string;
  steps?: LoadingStep[];
}

export const AssistantLoadingState: React.FC<AssistantLoadingStateProps> = ({
  title,
  destinationName,
  transcript,
  steps,
}) => {
  const { height } = useWindowDimensions();
  const isSmallHeight = height < 740;
  const theme = useThemeColors();
  const isDark = useColorScheme() === 'dark';

  // Animação do ônibus saltando levemente
  const busTranslateY = useSharedValue(0);
  
  useEffect(() => {
    busTranslateY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const busAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: busTranslateY.value }]
  }));

  // Animação das linhas pontilhadas (efeito de movimento)
  const dotsTranslateX = useSharedValue(0);
  useEffect(() => {
    dotsTranslateX.value = withRepeat(
      withTiming(-20, { duration: 600, easing: Easing.linear }),
      -1,
      false
    );
  }, []);
  const dotsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dotsTranslateX.value }]
  }));

  return (
    <View style={styles.container}>
      {/* Ônibus animado */}
      <View style={styles.busContainer}>
        <Animated.View style={[styles.busIconWrapper, busAnimatedStyle]}>
          <Ionicons name="bus" size={64} color="#007AFF" />
        </Animated.View>
        <View style={styles.roadContainer}>
          <Animated.View style={[styles.roadLineGroup, dotsAnimatedStyle]}>
            {[...Array(8)].map((_, i) => (
              <View key={i} style={styles.roadDot} />
            ))}
          </Animated.View>
        </View>
      </View>

      <View style={[styles.header, { marginBottom: isSmallHeight ? 12 : 16 }]}>
        <Text style={[styles.title, { fontSize: isSmallHeight ? 24 : 28, color: theme.text }]} maxFontSizeMultiplier={1.4}>{title}</Text>
        
        {destinationName && (
          <View style={[styles.destinationPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }]}>
            <Ionicons name="location" size={16} color="#007AFF" />
            <Text style={[styles.destinationPillText, { color: theme.text }]} maxFontSizeMultiplier={1.2}>
              Destino: <Text style={{ fontWeight: '700' }}>{destinationName}</Text>
            </Text>
          </View>
        )}
      </View>

      {transcript && (
        <View style={[styles.transcriptCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.transcriptLabel, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>
            Você disse:
          </Text>
          <Text style={[styles.transcriptText, { color: theme.primary }]} maxFontSizeMultiplier={1.3}>&quot;{transcript}&quot;</Text>
        </View>
      )}

      {steps && steps.length > 0 && (
        <Animated.View entering={FadeIn.delay(200)} style={[styles.stepsCard, { padding: isSmallHeight ? 16 : 20, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.85)', borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.9)' }]}>
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const isCompleted = step.status === 'completed';
            const isLoading = step.status === 'loading';
            const isPending = step.status === 'pending';
            
            return (
              <View key={step.id} style={styles.stepWrapper}>
                <View style={styles.stepRow}>
                  <View style={styles.iconContainer}>
                    {isCompleted ? (
                      <View style={[styles.circleIcon, { backgroundColor: '#10B981' }]}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    ) : isLoading ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <View style={[styles.pendingDot, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]} />
                    )}
                  </View>
                  <View style={styles.stepTextContainer}>
                    <Text
                      maxFontSizeMultiplier={1.2}
                      style={[
                        styles.stepText,
                        { fontSize: isSmallHeight ? 15 : 16, color: theme.textMuted },
                        isCompleted && { color: theme.text },
                        isLoading && { color: '#007AFF', fontWeight: '800' }]}
                    >
                      {step.label}
                    </Text>
                  </View>
                </View>
                {!isLast && (
                  <View style={[styles.stepLine, { backgroundColor: isCompleted ? '#10B981' : (isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0') }]} />
                )}
              </View>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: 'transparent',
  },
  
  // ─── Animação de ônibus ──────────────────────────────────────────────
  busContainer: {
    alignItems: 'center',
    marginBottom: 20,
    height: 80,
    justifyContent: 'flex-end',
  },
  busIconWrapper: {
    marginBottom: 8,
  },
  roadContainer: {
    width: 120,
    height: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  roadLineGroup: {
    flexDirection: 'row',
    width: 200,
  },
  roadDot: {
    width: 12,
    height: 4,
    backgroundColor: '#93C5FD', // Light blue dash
    borderRadius: 2,
    marginRight: 8,
  },

  header: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  destinationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  destinationPillText: {
    fontSize: 14,
  },

  transcriptCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  transcriptText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  stepsCard: {
    width: '100%',
    borderRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
  },
  stepWrapper: {
    flexDirection: 'column',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center', // change to flex-start se quiser alinhar pelo topo
    gap: 16,
  },
  stepLine: {
    width: 2,
    height: 16,
    marginLeft: 13, // center under the 28px icon container
    marginVertical: 4,
    borderRadius: 1,
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stepTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepText: {
    fontWeight: '700',
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 14,
    fontWeight: '500',
  },
});
