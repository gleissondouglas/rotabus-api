import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";

import { useThemeColors } from "../theme/colors";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
};

export function PrimaryButton({
  title,
  onPress,
  isLoading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: PrimaryButtonProps) {
  const theme = useThemeColors();
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: theme.primary },
        isDisabled && styles.buttonDisabled,
        style
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {isLoading ? (
        <ActivityIndicator color={theme.white} />
      ) : (
        <Text 
          style={[styles.text, { color: theme.white }]}
          maxFontSizeMultiplier={1.5}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    flexWrap: "wrap",
  },
});
