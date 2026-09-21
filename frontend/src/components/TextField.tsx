import React, { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/colors";

interface TextFieldProps extends TextInputProps {
  label?: string;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  iconRight?: React.ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(({ label, style, iconLeft, iconRight, ...props }, ref) => {
  const theme = useThemeColors();
  
  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
      <View style={[
        styles.inputContainer,
        { backgroundColor: theme.card, borderColor: theme.border }
      ]}>
        {iconLeft && (
          <Ionicons name={iconLeft} size={20} color={theme.textMuted} style={styles.iconLeft} />
        )}
        <TextInput
          ref={ref}
          style={[
            styles.input, 
            { color: theme.text }, 
            style
          ]}
          placeholderTextColor={theme.textMuted}
          {...props}
        />
        {iconRight && (
          <View style={styles.iconRight}>
            {iconRight}
          </View>
        )}
      </View>
    </View>
  );
});

TextField.displayName = "TextField";

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    minHeight: 56,
    borderRadius: 28, // pill style
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  iconLeft: {
    marginRight: 12,
  },
  iconRight: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    paddingVertical: 14, // Ensures good touch target
  },
});
