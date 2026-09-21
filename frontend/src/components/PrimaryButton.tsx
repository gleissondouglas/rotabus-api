import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "../theme/colors";
import { logUserInteraction } from "../utils/devLogger";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  actionDescription?: string;
  fileOrScreen?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
};

export function PrimaryButton({
  title,
  onPress,
  isLoading = false,
  disabled = false,
  style,
  accessibilityLabel,
  actionDescription,
  fileOrScreen,
  iconName,
}: PrimaryButtonProps) {
  const theme = useThemeColors();
  const isDisabled = disabled || isLoading;

  function handlePress() {
    logUserInteraction({
      component: "<PrimaryButton />",
      label: accessibilityLabel || title,
      fileOrScreen: fileOrScreen || "src/components/PrimaryButton.tsx",
      action: actionDescription || "Executou onPress",
    });
    onPress();
  }

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: theme.primary },
        isDisabled && styles.buttonDisabled,
        style
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {isLoading ? (
        <ActivityIndicator color={theme.white} />
      ) : (
        <>
          {iconName && (
            <Ionicons name={iconName} size={20} color={theme.white} style={styles.icon} />
          )}
          <Text 
            style={[styles.text, { color: theme.white }]}
            maxFontSizeMultiplier={1.5}
          >
            {title}
          </Text>
        </>
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
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    flexWrap: "wrap",
  },
});
