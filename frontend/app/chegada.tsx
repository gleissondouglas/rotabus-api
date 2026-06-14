import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons, FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";

import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { colors, useThemeColors } from "../src/theme/colors";
import { useAutoSpeak } from "../src/hooks/useAutoSpeak";
import { formatBusWaitingTimeToFriendlyTextShort } from "../src/utils/date-time";

export default function ArrivalScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const destination = String(params.destination || "seu destino");
  const busLine = String(params.busLine || "--");
  const busName = String(params.busName || "");
  const direction = String(params.direction || "--");
  const stopName = String(params.stopName || "ponto indicado");
  const beAtStopDateTime = String(params.beAtStopDateTime || "");

  const busLabel = busName ? `${busLine}, ${busName}` : busLine;
  const arrivalMessage = `Você chegou ao ponto ${stopName}. Agora aguarde o ônibus linha ${busLabel}, sentido ${direction}. Confira o número do ônibus antes de embarcar. Tenha uma ótima viagem.`;

  useAutoSpeak(arrivalMessage);

  function handleFinish() {
    router.replace({
      pathname: "/inicio",
      params: { latitude, longitude },
    });
  }

  return (
    <ScreenContainer withPadding={false} style={{ backgroundColor: "#F6F8FA" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={[styles.successBadge, { backgroundColor: "#DCFCE7" }]}>
            <Ionicons name="checkmark-circle" size={56} color="#10B981" />
          </View>
          <Text style={[styles.title, { color: "#000" }]}>Você chegou!</Text>
          <Text style={[styles.subtitle, { color: "#666" }]}>Agora é só aguardar o ônibus no ponto.</Text>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.infoSection}>
            <Text style={[styles.label, { color: "#94A3B8" }]}>PONTO DE EMBARQUE</Text>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(59, 130, 246, 0.08)" }]}>
                <MaterialCommunityIcons name="bus-stop" size={24} color={theme.primary} />
              </View>
              <Text style={[styles.stopName, { color: "#000" }]}>{stopName}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: "#F0F0F0" }]} />

          <View style={styles.busSection}>
            <Text style={[styles.label, { color: "#94A3B8" }]}>FIQUE ATENTO AO ÔNIBUS</Text>
            
            <View style={[styles.busDisplay, { backgroundColor: "#F0F7FF", borderColor: "#E1EDFF" }]}>
              <Text style={[styles.busNumber, { color: theme.primary }]}>{busLine}</Text>
              {!!busName && <Text style={[styles.busNameText, { color: "#000" }]}>{busName}</Text>}
              {!!direction && direction !== "--" && (
                <Text style={[styles.busDirectionText, { color: "#64748B" }]}>{direction}</Text>
              )}
              {!!beAtStopDateTime && (
                <Text style={[styles.busCountdownText, { color: theme.primary }]}>
                  Próximo ônibus: {formatBusWaitingTimeToFriendlyTextShort(beAtStopDateTime)}
                </Text>
              )}
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor: "#F1F5F9" }]}>
                  <Ionicons name="compass" size={20} color={theme.primary} />
                </View>
                <View style={styles.detailText}>
                  <Text style={[styles.detailLabel, { color: "#94A3B8" }]}>SENTIDO</Text>
                  <Text style={[styles.detailValue, { color: "#000" }]}>{direction}</Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={[styles.detailIcon, { backgroundColor: "rgba(16, 185, 129, 0.08)" }]}>
                  <Ionicons name="location" size={20} color="#10B981" />
                </View>
                <View style={styles.detailText}>
                  <Text style={[styles.detailLabel, { color: "#94A3B8" }]}>DESTINO</Text>
                  <Text style={[styles.detailValue, { color: "#000" }]}>{destination}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.alertBox, { backgroundColor: "#FFFBEB", borderColor: "#FEF3C7" }]}>
          <Ionicons name="information-circle" size={24} color="#F59E0B" />
          <Text style={[styles.alertText, { color: "#92400E" }]}>
            Confira sempre o número da linha na frente do ônibus antes de subir.
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton 
            title="Concluir e voltar" 
            onPress={handleFinish} 
            style={styles.mainButton}
          />
          <View style={styles.ttsWrapper}>
            <ListenOptionsButton textToSpeak={arrivalMessage} />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 32,
    gap: 12,
  },
  successBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: 34,
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
  mainCard: {
    backgroundColor: "white",
    borderRadius: 32,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
    marginBottom: 24,
  },
  infoSection: {
    gap: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stopName: {
    fontSize: 22,
    fontWeight: "900",
    flex: 1,
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    marginVertical: 24,
  },
  busSection: {
    gap: 20,
  },
  busDisplay: {
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
  },
  busNumber: {
    fontSize: 64,
    fontWeight: "900",
    letterSpacing: -1,
  },
  busNameText: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  busDirectionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  busCountdownText: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
  },
  detailsGrid: {
    gap: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  detailIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: 2,
  },
  alertBox: {
    flexDirection: "row",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 1,
  },
  alertText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  actions: {
    gap: 24,
    alignItems: "center",
  },
  mainButton: {
    height: 64,
    borderRadius: 32,
    width: "100%",
  },
  ttsWrapper: {
    opacity: 0.8,
  },
});
