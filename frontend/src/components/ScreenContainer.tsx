import { useFocusEffect } from "expo-router";
import { ReactNode, useCallback } from "react";
import { StyleSheet, View, ViewStyle, StatusBar , useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { stopSpeaking } from "../services/speech.service";
import { useThemeColors } from "../theme/colors";

type ScreenContainerProps = {
  children: ReactNode;
  style?: ViewStyle;
  withPadding?: boolean;
  backgroundColor?: string;
};

export function ScreenContainer({ 
  children, 
  style, 
  withPadding = true,
  backgroundColor
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();
  const colorScheme = useColorScheme();

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopSpeaking();
      };
    }, []),
  );

  return (
    <View 
      style={[
        styles.container, 
        { 
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingLeft: Math.max(insets.left, 16),
          paddingRight: Math.max(insets.right, 16),
          backgroundColor: backgroundColor || theme.background,
        },
        style
      ]}
    >
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <View style={[styles.inner, withPadding && styles.withPadding]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  withPadding: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
