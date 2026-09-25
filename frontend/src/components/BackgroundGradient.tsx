import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../theme/colors';

export function BackgroundGradient() {
  const theme = useThemeColors();
  const scheme = useColorScheme();

  const gradientColors = scheme === 'dark'
    ? ['#0D1B2E', '#0F172A', theme.background] as const
    : ['#C8D9F4', '#DDE9F9', '#EEF3FF'] as const;

  return (
    <LinearGradient 
      colors={gradientColors} 
      locations={[0, 0.4, 1]}
      style={StyleSheet.absoluteFillObject} 
    />
  );
}
