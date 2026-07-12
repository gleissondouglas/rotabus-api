import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { useThemeColors } from "../theme/colors";
import type { DestinationCategory } from "../utils/destinationCategory.mapper";

const icons: Record<DestinationCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  health: "hospital-building", pharmacy: "medical-bag", market: "cart-outline", bakery: "bread-slice-outline",
  food: "silverware-fork-knife", education: "school-outline", bus_terminal: "bus-stop-covered",
  bus_stop: "bus-stop", address: "map-marker-outline", residence: "home-variant-outline",
  residential_building: "office-building-outline", lodging: "bed-outline", commerce: "storefront-outline",
  fuel: "gas-station-outline", bank: "bank-outline", religious: "church-outline", park: "tree-outline",
  gym: "dumbbell", police: "shield-account-outline", government: "city-variant-outline",
  station: "train", airport: "airplane", unknown: "map-marker-outline",
};

export function DestinationCategoryIcon({ category, size = "medium" }: { category: DestinationCategory; size?: "medium" | "small" }) {
  const theme = useThemeColors();
  const iconSize = size === "small" ? 20 : 22;
  return (
    <View style={[styles.container, size === "small" && styles.small, { backgroundColor: theme.primaryLight }]} accessibilityElementsHidden>
      <MaterialCommunityIcons name={icons[category]} size={iconSize} color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  small: { width: 44, height: 44, borderRadius: 13 },
});
