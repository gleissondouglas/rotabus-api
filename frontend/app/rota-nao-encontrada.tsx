import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useAutoSpeak } from "../src/hooks/useAutoSpeak";
import { colors } from "../src/theme/colors";

export default function RouteNotFoundScreen() {
  const params = useLocalSearchParams();

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const destination = String(params.destination || "");
  const message = String(params.message || "Não encontramos uma rota disponível para esse destino no momento.");

  const isDailyLimit = message.toLowerCase().includes("limite") || message.toLowerCase().includes("requisições");

  const screenMessage = isDailyLimit
    ? "O limite de buscas para hoje foi atingido. Por favor, tente novamente amanhã ou mais tarde."
    : `Não consegui encontrar uma rota para ${destination}. ${message}`;

  useAutoSpeak(screenMessage);

  function handleGoHome() {
    router.replace({
      pathname: "/inicio",
      params: { latitude, longitude },
    });
  }

  function handleTryAgain() {
    router.replace({
      pathname: "/digitar-destino",
      params: { latitude, longitude },
    });
  }

  return (
    <ScreenContainer>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BackButton label="Início" onPress={handleGoHome} />

        <View style={styles.content}>
          <View style={[styles.iconContainer, isDailyLimit && styles.iconContainerWarning]}>
            <MaterialCommunityIcons 
              name={isDailyLimit ? "clock-alert" : "map-marker-off"} 
              size={64} 
              color={isDailyLimit ? "#FF9800" : colors.danger} 
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {isDailyLimit ? "Limite atingido" : "Rota não encontrada"}
            </Text>
            
            <View style={styles.messageCard}>
              <Text style={styles.messageText}>{message}</Text>
            </View>

            <Text style={styles.hintText}>
              {isDailyLimit 
                ? "O Nuvem tem um limite diário de buscas. Tente novamente amanhã." 
                : "Você pode tentar digitar o endereço novamente ou escolher outro local próximo."}
            </Text>
          </View>

          <View style={styles.actions}>
            {!isDailyLimit && (
              <PrimaryButton 
                title="Tentar outro destino" 
                onPress={handleTryAgain} 
              />
            )}
            
            <PrimaryButton 
              title="Voltar ao início" 
              onPress={handleGoHome}
              style={isDailyLimit ? undefined : styles.secondaryButton}
            />

            <ListenOptionsButton textToSpeak={screenMessage} />
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
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
    gap: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FFF0F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  iconContainerWarning: {
    backgroundColor: "#FFF8E1",
  },
  textContainer: {
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },
  messageCard: {
    backgroundColor: colors.white,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
  },
  messageText: {
    fontSize: 18,
    color: colors.text,
    textAlign: "center",
    lineHeight: 26,
    fontWeight: "600",
  },
  hintText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  actions: {
    width: "100%",
    gap: 16,
  },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
  },
});
