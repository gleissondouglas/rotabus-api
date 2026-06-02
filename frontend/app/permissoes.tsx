import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { locationService } from "../src/services/location.service";
import { sessionService } from "../src/services/session.service";
import { useThemeColors } from "../src/theme/colors";

export default function PermissionsScreen() {
  const theme = useThemeColors();
  const [isLoading, setIsLoading] = useState(false);

  async function handleAllowPermissions() {
    try {
      setIsLoading(true);

      const hasLocationPermission =
        await locationService.requestLocationPermission();

      if (!hasLocationPermission) {
        Alert.alert(
          "Permissão necessária",
          "Para encontrar o ponto de ônibus mais próximo, o Nuvem precisa acessar sua localização.",
        );

        return;
      }

      const currentLocation = await locationService.getCurrentLocation();

      console.log("Localização atual:", currentLocation);

      await sessionService.setHasSeenPermissions(true);

      router.push({
        pathname: "/inicio",
        params: {
          latitude: String(currentLocation.latitude),
          longitude: String(currentLocation.longitude),
        },
      });
    } catch (error) {
      console.log("Erro completo em permissões:", error);

      Alert.alert(
        "Erro",
        "Não foi possível acessar sua localização. Tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScreenContainer withPadding={false} style={{ backgroundColor: "#F6F8FA" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topBar}>
          <BackButton />
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: "#000" }]}>Precisamos da sua permissão</Text>
            <Text style={[styles.subtitle, { color: "#666" }]}>
              Para te ajudar nas rotas, o Nuvem precisa acessar alguns recursos do seu celular.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.permissionItem}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(59, 130, 246, 0.08)" }]}>
                <MaterialCommunityIcons name="microphone" size={24} color={theme.primary} />
              </View>
              <View style={styles.permissionTextBox}>
                <Text style={[styles.permissionTitle, { color: "#000" }]}>Microfone</Text>
                <Text style={[styles.permissionDescription, { color: "#666" }]}>
                  Para ouvir o destino que você falar.
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={28} color="#10B981" />
            </View>

            <View style={[styles.divider, { backgroundColor: "#F0F0F0" }]} />

            <View style={styles.permissionItem}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(59, 130, 246, 0.08)" }]}>
                <MaterialCommunityIcons name="map-marker" size={24} color={theme.primary} />
              </View>
              <View style={styles.permissionTextBox}>
                <Text style={[styles.permissionTitle, { color: "#000" }]}>Localização</Text>
                <Text style={[styles.permissionDescription, { color: "#666" }]}>
                  Para encontrar o ponto mais próximo.
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={28} color="#10B981" />
            </View>

            <View style={[styles.divider, { backgroundColor: "#F0F0F0" }]} />

            <View style={styles.permissionItem}>
              <View style={[styles.iconContainer, { backgroundColor: "rgba(59, 130, 246, 0.08)" }]}>
                <MaterialCommunityIcons name="bell" size={24} color={theme.primary} />
              </View>
              <View style={styles.permissionTextBox}>
                <Text style={[styles.permissionTitle, { color: "#000" }]}>Notificações</Text>
                <Text style={[styles.permissionDescription, { color: "#666" }]}>
                  Para avisar quando o ônibus chegar.
                </Text>
              </View>
              <Text style={[styles.optional, { color: "#94A3B8" }]}>Opcional</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <PrimaryButton
              title="Permitir e continuar"
              onPress={handleAllowPermissions}
              isLoading={isLoading}
              style={styles.button}
            />

            <View style={styles.ttsWrapper}>
              <ListenOptionsButton textToSpeak="O Nuvem precisa de permissão para usar o microfone, a localização e as notificações. Toque em permitir e continuar." />
            </View>

            <Text style={[styles.note, { color: "#94A3B8" }]}>
              Você pode alterar essas permissões depois nas configurações do celular.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 20,
    gap: 32,
    marginTop: 8,
  },
  header: {
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },
  card: {
    padding: 24,
    borderRadius: 32,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTextBox: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  permissionDescription: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  optional: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  footer: {
    alignItems: "center",
    gap: 24,
  },
  button: {
    width: "100%",
    height: 64,
    borderRadius: 32,
  },
  ttsWrapper: {
    opacity: 0.8,
  },
  note: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
    paddingHorizontal: 20,
  },
});
