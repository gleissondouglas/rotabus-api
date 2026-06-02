import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useThemeColors } from "../theme/colors";
import { vibrationService } from "../services/vibration.service";

interface VoiceHoldButtonProps {
  onPressIn: () => void;
  onPressOut: () => void;
  isActive: boolean;
}

export const VoiceHoldButton: React.FC<VoiceHoldButtonProps> = ({
  onPressIn,
  onPressOut,
  isActive,
}) => {
  const theme = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(1.2);
    vibrationService.medium();
    onPressIn();
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    onPressOut();
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.pulse, animatedStyle, { backgroundColor: isActive ? theme.primary : theme.primaryLight }]}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.button}
          accessibilityLabel="Segure para falar seu destino"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name={isActive ? "microphone" : "microphone-outline"}
            size={40}
            color={isActive ? "white" : theme.primary}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  pulse: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  button: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
