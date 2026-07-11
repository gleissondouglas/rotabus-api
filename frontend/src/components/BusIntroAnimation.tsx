import React, { useEffect } from 'react';
import { StyleSheet, Text, Dimensions, View, Pressable } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence, 
  withDelay, 
  runOnJS,
  FadeIn,
  Easing
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface BusIntroAnimationProps {
  onFinish: () => void;
}

export function BusIntroAnimation({ onFinish }: BusIntroAnimationProps) {
  const colors = useThemeColors();
  const busTranslateX = useSharedValue(-width / 2 - 100);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    busTranslateX.value = withSequence(
      withTiming(0, { 
        duration: 800, 
        easing: Easing.out(Easing.back(1.5)) 
      }),
      withDelay(600, withTiming(width, { 
        duration: 600, 
        easing: Easing.in(Easing.exp) 
      }))
    );

    scale.value = withSequence(
      withTiming(1, { duration: 800 }),
      withDelay(600, withTiming(1.2, { duration: 600 }))
    );

    opacity.value = withDelay(1700, withTiming(0, { duration: 300 }, () => {
      runOnJS(onFinish)();
    }));
  }, [busTranslateX, onFinish, opacity, scale]);

  const animatedBusStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: busTranslateX.value },
      { scale: scale.value }
    ],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View 
      style={[styles.container, { backgroundColor: colors.background }, animatedContainerStyle]} 
      entering={FadeIn.duration(400)}
    >
      <Pressable style={styles.skipArea} onPress={onFinish}>
        <View style={styles.content}>
          <Animated.View style={[styles.busContainer, { backgroundColor: colors.primaryLight }, animatedBusStyle]}>
            <MaterialCommunityIcons name="bus-side" size={80} color={colors.primary} />
          </Animated.View>
          <Text style={[styles.text, { color: colors.text }]}>Olá, vamos começar</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 24,
  },
  busContainer: {
    padding: 24,
    borderRadius: 40,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  text: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
});
