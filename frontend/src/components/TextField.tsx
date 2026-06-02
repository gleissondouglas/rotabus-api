import React, { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { useThemeColors } from "../theme/colors";

interface TextFieldProps extends TextInputProps {
  label?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(({ label, style, ...props }, ref) => {
  const theme = useThemeColors();
  
  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.text }]}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[
          styles.input, 
          { 
            backgroundColor: theme.card, 
            borderColor: theme.border,
            color: theme.text 
          }, 
          style
        ]}
        placeholderTextColor={theme.textMuted}
        {...props}
      />
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
  input: {
    width: "100%",
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    fontSize: 16,
  },
});
