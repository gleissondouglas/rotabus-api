import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";
import { colors } from "../src/theme/colors";

export default function HelpScreen() {
  const params = useLocalSearchParams();

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");

  const screenMessage =
    "Você está na tela de ajuda. Para buscar uma rota, toque em falar destino. Se preferir escrever, toque em digitar destino. Você também pode acessar as configurações.";

  useAutoSpeakOnce("ajuda", screenMessage);

  function handleSpeakDestination() {
    router.push({
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

  function handleSettings() {
    router.push({
      pathname: "/configuracoes",
      params: {
        latitude,
        longitude,
      },
    });
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <BackButton />

        <View style={styles.content}>
          <Text style={styles.title}>Ajuda</Text>

          <Text style={styles.subtitle}>
            Veja como usar o Nuvem de forma simples.
          </Text>

          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="mic-outline" size={28} color={colors.primary} />
            </View>

            <View style={styles.cardTextBox}>
              <Text style={styles.cardTitle}>Falar destino</Text>
              <Text style={styles.cardDescription}>
                Mantenha o botão de voz pressionado e diga para onde você quer
                ir.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="create-outline" size={28} color={colors.primary} />
            </View>

            <View style={styles.cardTextBox}>
              <Text style={styles.cardTitle}>Digitar destino</Text>
              <Text style={styles.cardDescription}>
                Se preferir, você pode escrever o local desejado.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="bus-outline" size={28} color={colors.primary} />
            </View>

            <View style={styles.cardTextBox}>
              <Text style={styles.cardTitle}>Ir até o ponto</Text>
              <Text style={styles.cardDescription}>
                O Nuvem mostra o ponto de ônibus mais próximo e guia você até
                lá.
              </Text>
            </View>
          </View>

          <PrimaryButton
            title="Falar destino"
            onPress={handleSpeakDestination}
          />

          <ListenOptionsButton textToSpeak={screenMessage} />

          <Pressable
            style={styles.secondaryButton}
            onPress={handleTypeDestination}
          >
            <Text style={styles.secondaryButtonText}>Digitar destino</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleSettings}>
            <Text style={styles.secondaryButtonText}>Configurações</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 6,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  cardTextBox: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },

  cardDescription: {
    marginTop: 3,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },

  secondaryButton: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
});
