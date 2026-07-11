import { StyleSheet, View } from "react-native";

import { useThemeColors } from "../theme/colors";

type Props = {
  currentIndex: number;
  total: number;
};

export function OnboardingPagination({ currentIndex, total }: Props) {
  const theme = useThemeColors();

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Página ${currentIndex + 1} de ${total}`}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            { backgroundColor: index === currentIndex ? theme.primary : theme.border },
            index === currentIndex && styles.activeDot,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  activeDot: {
    width: 24,
  },
});
