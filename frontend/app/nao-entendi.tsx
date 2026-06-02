import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { VoiceOrb } from "../src/components/VoiceOrb";
import { colors } from "../src/theme/colors";

export default function DidNotUnderstandScreen() {
  const params = useLocalSearchParams();

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");

  const screenMessage = "Desculpe, não consegui entender o destino que você falou. Você pode tocar em falar novamente, digitar o destino ou voltar para a tela inicial.";

  function handleTryAgain() {
    router.replace({
      pathname: "/inicio",
      params: {
        latitude,
        longitude,
      },
    });
  }

  function handleTypeDestination() {
    router.push({
      pathname: "/digitar-destino",
      params: {
        latitude,
        longitude,
      },
    });
  }

  function handleGoHome() {
    router.replace({
      pathname: "/inicio",
      params: {
        latitude,
        longitude,
      },
    });
  }

  return (
    <ScreenContainer>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.orbContainer}>
            <VoiceOrb state="error" size={100} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Não consegui entender</Text>
            <Text style={styles.subtitle}>
              Por favor, tente falar novamente o nome do lugar ou o endereço completo.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardText}>
              Se preferir, você também pode digitar o destino usando o teclado.
            </Text>
          </View>

          <View style={styles.actions}>
            <PrimaryButton title="Tentar falar de novo" onPress={handleTryAgain} />

            <ListenOptionsButton textToSpeak={screenMessage} />

            <Pressable
              style={styles.secondaryButton}
              onPress={handleTypeDestination}
            >
              <Text style={styles.secondaryButtonText}>Digitar destino</Text>
            </Pressable>

            <Pressable style={styles.homeButton} onPress={handleGoHome}>
              <Text style={styles.homeButtonText}>Voltar ao início</Text>
            </Pressable>
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
    paddingHorizontal: 24,
    gap: 32,
    paddingTop: 40,
  },
  orbContainer: {
    marginBottom: 8,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 26,
    fontWeight: '600',
  },
  card: {
    width: "100%",
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cardText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.danger,
    textAlign: "center",
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  homeButton: {
    marginTop: 8,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textMuted,
  },
});
