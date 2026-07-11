import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  interpolate,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

export type VoiceOrbState = 'idle' | 'listening' | 'processing' | 'error';

interface VoiceOrbProps {
  state: VoiceOrbState;
  size?: number;
}

const PulseRing = ({ delay, state, size }: { delay: number; state: VoiceOrbState; size: number }) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (state === 'listening') {
      pulse.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: 2000 }),
          -1,
          false
        )
      );
    } else {
      pulse.value = withTiming(0, { duration: 300 });
    }
  }, [state, delay, pulse]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.2]) }],
      opacity: interpolate(pulse.value, [0, 0.1, 0.8, 1], [0, 0.4, 0.1, 0]),
    };
  });

  return <Animated.View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, animatedStyle]} />;
};

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, size = 120 }) => {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (state === 'listening') {
      scale.value = withRepeat(
        withTiming(1.15, { duration: 800 }),
        -1,
        true
      );
    } else if (state === 'processing') {
      scale.value = withRepeat(
        withTiming(1.1, { duration: 1000 }),
        -1,
        true
      );
      rotation.value = withRepeat(
        withTiming(360, { duration: 3000 }),
        -1,
        false
      );
    } else {
      scale.value = withSpring(1);
      cancelAnimation(rotation);
      rotation.value = 0;
    }
  }, [state, rotation, scale]);

  const mainOrbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotate: `${rotation.value}deg` }
      ],
      backgroundColor: state === 'error' ? colors.danger : colors.primary,
    };
  });

  return (
    <View style={[styles.container, { width: size * 2.5, height: size * 2.5 }]}>
      {state === 'listening' && (
        <>
          <PulseRing delay={0} state={state} size={size} />
          <PulseRing delay={600} state={state} size={size} />
          <PulseRing delay={1200} state={state} size={size} />
        </>
      )}

      <Animated.View style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }, mainOrbStyle]}>
        {state === 'processing' && (
          <View style={styles.processingGradient} />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orb: {
    backgroundColor: colors.primary,
    elevation: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  processingGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: '50%',
    height: '100%',
    opacity: 0.5,
  },
});
