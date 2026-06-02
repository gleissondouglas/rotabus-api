import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  withSequence,
  interpolate,
  FadeIn
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { layout } from '../theme/layout';

export interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed';
}

interface AssistantLoadingStateProps {
  title: string;
  subtitle?: string;
  transcript?: string;
  steps?: LoadingStep[];
}

const RouteAnimation = () => {
  const busPos = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    busPos.value = withRepeat(
      withTiming(1, { duration: 3000 }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const busStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(busPos.value, [0, 1], [-40, 40]) },
      { scaleX: -1 } // Inverter ônibus para parecer que está indo pra direita/frente
    ],
    opacity: interpolate(busPos.value, [0, 0.2, 0.8, 1], [0, 1, 1, 0])
  }));

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }]
  }));

  return (
    <View style={styles.animationContainer}>
      <View style={styles.routeLine} />
      <Animated.View style={[styles.busIcon, busStyle]}>
        <MaterialCommunityIcons name="bus" size={32} color={colors.primary} />
      </Animated.View>
      <Animated.View style={[styles.destPin, pinStyle]}>
        <Ionicons name="location" size={36} color={colors.primary} />
      </Animated.View>
    </View>
  );
};

export const AssistantLoadingState: React.FC<AssistantLoadingStateProps> = ({
  title,
  subtitle,
  transcript,
  steps,
}) => {
  const { height } = useWindowDimensions();
  const isSmallHeight = height < 740;

  return (
    <View style={styles.container}>
      <View style={styles.orbContainer}>
        <RouteAnimation />
      </View>

      <View style={[styles.header, { marginBottom: isSmallHeight ? 24 : 32 }]}>
        <Text style={[styles.title, { fontSize: isSmallHeight ? layout.titleFontSizeSmall : layout.titleFontSize }]} maxFontSizeMultiplier={1.4}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { fontSize: isSmallHeight ? layout.subtitleFontSizeSmall : layout.subtitleFontSize }]} maxFontSizeMultiplier={1.3}>{subtitle}</Text>}
      </View>

      {transcript && (
        <View style={styles.transcriptCard}>
          <Text style={styles.transcriptLabel} maxFontSizeMultiplier={1.2}>
            Você disse:
          </Text>
          <Text style={styles.transcriptText} maxFontSizeMultiplier={1.3}>&quot;{transcript}&quot;</Text>
        </View>
      )}

      {steps && steps.length > 0 && (
        <Animated.View entering={FadeIn.delay(400)} style={[styles.stepsCard, { padding: isSmallHeight ? layout.cardPaddingSmall : layout.cardPadding, borderRadius: layout.cardBorderRadius }]}>
          {steps.map((step) => (
            <View key={step.id} style={[styles.stepItem, { gap: isSmallHeight ? 8 : 12 }]}>
              <View style={styles.iconContainer}>
                {step.status === 'completed' ? (
                  <Ionicons name="checkmark-circle" size={isSmallHeight ? 20 : 22} color={colors.success} />
                ) : step.status === 'loading' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={isSmallHeight ? 18 : 20} color={colors.border} />
                )}
              </View>
              <Text
                maxFontSizeMultiplier={1.2}
                style={[
                  styles.stepText,
                  { fontSize: isSmallHeight ? layout.cardSubtitleFontSizeSmall : layout.cardSubtitleFontSize },
                  step.status === 'completed' && styles.stepTextCompleted,
                  step.status === 'loading' && styles.stepTextActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
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
  animationContainer: {
    width: 200,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  routeLine: {
    position: 'absolute',
    width: 120,
    height: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 2,
    top: '50%',
    left: '20%',
  },
  busIcon: {
    position: 'absolute',
    top: '30%',
  },
  destPin: {
    position: 'absolute',
    right: '15%',
    top: '20%',
  },
  orbContainer: {
    marginBottom: 0,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontWeight: '900',
    color: '#011030',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
    fontWeight: '600',
  },
  transcriptCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'center',
  },
  transcriptText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  stepsCard: {
    width: '100%',
    backgroundColor: 'white',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: colors.textMuted,
    fontWeight: '600',
    flex: 1,
  },
  stepTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  stepTextCompleted: {
    color: colors.success,
  },
});