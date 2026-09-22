import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View, ScrollView, Pressable } from "react-native";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";
import { useThemeColors } from "../src/theme/colors";
import { LiquidGlassView } from "../src/components/LiquidGlassView";
import { AdaptiveIcon } from "../src/components/AdaptiveIcon";
import { BackgroundGradient } from "../src/components/BackgroundGradient";

export default function RouteNotFoundScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");
  const destination = String(params.destination || "");
  const message = String(params.message || "Não encontramos uma rota disponível para esse destino no momento.");
  const isVoiceSearch = String(params.isVoiceSearch || "false");

  const isDailyLimit = message.toLowerCase().includes("limite") || message.toLowerCase().includes("requisições");
  const isConnectionError = 
    message.toLowerCase().includes("conexão") || 
    message.toLowerCase().includes("internet") || 
    message.toLowerCase().includes("servidor") || 
    message.toLowerCase().includes("rede") || 
    message.toLowerCase().includes("enotfound") ||
    message.toLowerCase().includes("timeout");

  const screenMessage = isDailyLimit
    ? "O limite de buscas para hoje foi atingido. Por favor, tente novamente amanhã ou mais tarde."
    : isConnectionError
    ? "Não foi possível conectar aos serviços de mapas. Verifique sua conexão com a internet e tente novamente."
    : `Não consegui encontrar uma rota para ${destination}. ${message}`;

  useAutoSpeakOnce(`not-found-${destination}`, screenMessage, isVoiceSearch === "true");

  function handleGoHome() {
    router.replace({
      pathname: "/inicio",
      params: { latitude, longitude },
    });
  }

  function handleTryAgain() {
    if (isConnectionError && destination) {
      router.replace({
        pathname: "/processando",
        params: { latitude, longitude, destination, isVoiceSearch },
      });
      return;
    }

    router.replace({
      pathname: "/digitar-destino",
      params: { latitude, longitude },
    });
  }

  const getHeaderTitle = () => {
    if (isDailyLimit) return "Limite atingido";
    if (isConnectionError) return "Sem conexão";
    return "Rota não encontrada";
  };

  const getHintText = () => {
    if (isDailyLimit) return "O RotaBus tem um limite diário de buscas. Tente novamente amanhã.";
    if (isConnectionError) return "Verifique seu Wi-Fi ou dados móveis e tente fazer a busca novamente.";
    return "Você pode tentar digitar o endereço novamente ou escolher outro local próximo.";
  };

  return (
    <View style={styles.screen}>
      <BackgroundGradient />
      <ScreenContainer backgroundColor="transparent">
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        <BackButton label="Início" onPress={handleGoHome} />

        <View style={styles.content}>
          <View 
            style={[
              styles.iconContainer, 
              (isDailyLimit || isConnectionError) 
                ? { backgroundColor: "rgba(255, 152, 0, 0.1)" } 
                : { backgroundColor: "rgba(239, 68, 68, 0.1)" }
            ]}
          >
            <AdaptiveIcon 
              iosSymbol={
                isDailyLimit 
                  ? "clock.badge.exclamationmark" 
                  : isConnectionError 
                  ? "wifi.slash" 
                  : "mappin.slash"
              } 
              fallbackFamily="MaterialCommunityIcons"
              fallbackName={
                isDailyLimit 
                  ? "clock-alert" 
                  : isConnectionError 
                  ? "wifi-off" 
                  : "map-marker-off"
              } 
              size={40} 
              color={(isDailyLimit || isConnectionError) ? "#FF9800" : theme.danger} 
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.text }]}>
              {getHeaderTitle()}
            </Text>
            
            <View style={styles.messageCardShadow}>
              <View style={[styles.messageCardContent, { borderColor: theme.border }]}>
                <LiquidGlassView style={StyleSheet.absoluteFillObject} fallbackColor={theme.card} />
                <Text style={[styles.messageText, { color: theme.text }]}>{message}</Text>
              </View>
            </View>

            <Text style={[styles.hintText, { color: theme.textMuted }]}>
              {getHintText()}
            </Text>
          </View>

          <View style={styles.actions}>
            {!isDailyLimit && (
              <PrimaryButton 
                title={isConnectionError ? "Tentar novamente" : "Tentar outro destino"} 
                onPress={handleTryAgain} 
              />
            )}
            
            {isDailyLimit ? (
              <PrimaryButton 
                title="Voltar ao início" 
                onPress={handleGoHome}
              />
            ) : (
              <Pressable 
                style={[styles.secondaryButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={handleGoHome}
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Voltar ao início</Text>
              </Pressable>
            )}

            <ListenOptionsButton textToSpeak={screenMessage} />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    gap: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  textContainer: {
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  messageCardShadow: {
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  messageCardContent: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  messageText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "600",
  },
  hintText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  secondaryButton: {
    width: "100%",
    minHeight: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: "800",
  },
});
