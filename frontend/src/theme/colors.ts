import { useColorScheme } from 'react-native';
import { useAccessibility } from '../contexts/AccessibilityContext';

const palette = {
  blue500: "#3B82F6",
  blue600: "#2563EB",
  blue700: "#1D4ED8",
  blue800: "#1E40AF",
  blue50: "#EEF4FF",
  
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1E293B",
  gray900: "#0F172A",
  
  white: "#FFFFFF",
  black: "#000000",
  
  red500: "#EF4444",
  red700: "#B91C1C",
  green500: "#10B981",
  green700: "#047857",
  amber500: "#F59E0B",
  deepBlue: "#011030",
};

export const colors = {
  primary: palette.blue600,
  primaryDark: palette.blue800,
  primaryLight: palette.blue50,
  background: "#F8FAFF",
  deepBackground: palette.deepBlue,
  card: palette.white,
  white: palette.white,
  text: palette.gray800,
  textMuted: palette.gray600,
  border: "#E0EAFF",
  danger: palette.red500,
  success: palette.green500,
  warning: palette.amber500,
};

const lightTheme = { ...colors };

const darkTheme = {
  primary: "#3B82F6",
  primaryDark: palette.blue500,
  primaryLight: "#1E293B",
  background: palette.gray900,
  card: palette.gray800,
  white: palette.white,
  text: palette.gray50,
  textMuted: palette.gray400,
  border: palette.gray700,
  danger: "#FB7185",
  success: "#34D399",
  warning: "#FBBF24",
};

// High contrast variations
const highContrastLightTheme = {
  ...lightTheme,
  primary: palette.blue800,
  primaryDark: "#000000",
  text: "#000000",
  textMuted: "#333333",
  border: "#000000",
  background: "#FFFFFF",
  danger: palette.red700,
  success: palette.green700,
  warning: "#B45309",
};

const highContrastDarkTheme = {
  ...darkTheme,
  primary: "#60A5FA",
  primaryDark: "#FFFFFF",
  text: "#FFFFFF",
  textMuted: "#E2E8F0",
  border: "#FFFFFF",
  background: "#000000",
  card: "#000000",
  danger: "#FDA4AF",
  success: "#86EFAC",
  warning: "#FCD34D",
};

export function useThemeColors() {
  const scheme = useColorScheme();
  
  // Use a fallback in case AccessibilityProvider is not mounted yet
  let highContrast = false;
  try {
    const context = useAccessibility();
    highContrast = context?.highContrast || false;
  } catch {
    // ignore
  }

  if (scheme === 'dark') {
    return highContrast ? highContrastDarkTheme : darkTheme;
  }
  return highContrast ? highContrastLightTheme : lightTheme;
}
