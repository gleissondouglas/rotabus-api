import { BackgroundGradient } from "../src/components/BackgroundGradient";
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
          "Para encontrar o ponto de ônibus mais próximo, o RotaBus precisa acessar sua localização.",
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
    <View style={{ flex: 1 }}>
      <BackgroundGradient />
      <ScreenContainer withPadding={false} backgroundColor="transparent">
      <View style={styles.topBar}>
        <BackButton />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Precisamos da sua permissão</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Para te ajudar nas rotas, o RotaBus precisa acessar alguns recursos do seu celular.
            </Text>
          </View>

          <View style={styles.cardContent}>
            
            <View style={[styles.permissionCard, { backgroundColor: theme.card }]}>
              <View style={[styles.iconContainer, { backgroundColor: theme.primary + "1A" }]}>
                <Ionicons name="mic" size={24} color={theme.primary} />
              </View>
              <View style={styles.permissionTextBox}>
                <Text style={[styles.permissionTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>Microfone</Text>
                <Text style={[styles.permissionDescription, { color: theme.textMuted }]}>
                  Para ouvir o destino que você falar.
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={26} color="#10B981" />
            </View>

            <View style={[styles.permissionCard, { backgroundColor: theme.card }]}>
              <View style={[styles.iconContainer, { backgroundColor: theme.primary + "1A" }]}>
                <Ionicons name="location" size={24} color={theme.primary} />
              </View>
              <View style={styles.permissionTextBox}>
                <Text style={[styles.permissionTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>Localização</Text>
                <Text style={[styles.permissionDescription, { color: theme.textMuted }]}>
                  Para encontrar o ponto mais próximo de você.
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={26} color="#10B981" />
            </View>

            <View style={[styles.permissionCard, { backgroundColor: theme.card }]}>
              <View style={[styles.iconContainer, { backgroundColor: theme.primary + "1A" }]}>
                <Ionicons name="notifications" size={24} color={theme.primary} />
              </View>
              <View style={styles.permissionTextBox}>
                <Text style={[styles.permissionTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>Notificações</Text>
                <Text style={[styles.permissionDescription, { color: theme.textMuted }]}>
                  Para avisar quando o ônibus chegar e a hora de descer.
                </Text>
              </View>
              <View style={[styles.optionalPill, { borderColor: theme.border }]}>
                <Text style={[styles.optional, { color: theme.textMuted }]}>OPCIONAL</Text>
              </View>
            </View>

          </View>

          <View style={styles.footer}>
            <PrimaryButton
              title="Permitir e continuar"
              onPress={handleAllowPermissions}
              isLoading={isLoading}
              style={styles.button}
            />

            <View style={[styles.ttsWrapper, { borderColor: theme.primary + "33" }]}>
              <ListenOptionsButton textToSpeak="O RotaBus precisa de permissão para usar o microfone, a localização e as notificações. Toque em permitir e continuar." />
            </View>

            <Text style={[styles.note, { color: theme.textMuted }]}>
              Você pode alterar essas permissões depois nas configurações do celular.
            </Text>
          </View>
        </View>
      </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 10,
  },
  content: {
    paddingHorizontal: 24,
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
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },
  cardContent: {
    gap: 16,
  },
  permissionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16, // squircle shape
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTextBox: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  permissionDescription: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  optionalPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  optional: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: "center",
    gap: 20,
  },
  button: {
    width: "100%",
    height: 56,
    borderRadius: 28,
  },
  ttsWrapper: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden", // ensures the button inside respects radius if needed
  },
  note: {
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
    paddingHorizontal: 20,
    lineHeight: 18,
    opacity: 0.9,
  },
});
