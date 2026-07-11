import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useAutoSpeakOnce } from "../src/hooks/useAutoSpeakOnce";
import { useAccessibility } from "../src/contexts/AccessibilityContext";

export default function AccessibilityScreen() {
  const {
    largeText,
    slowVoice,
    highContrast,
    autoRead,
    vibration,
    updateSettings,
  } = useAccessibility();

  const screenMessage =
    "Você está na tela de acessibilidade. Aqui você pode configurar texto maior, voz mais lenta, alto contraste, leitura automática das telas e vibração.";

  useAutoSpeakOnce("acessibilidade", screenMessage);

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
          <View style={styles.textHeader}>
            <Text style={styles.title}>Acessibilidade</Text>
            <Text style={styles.subtitle}>
              Ajuste o app para ficar mais fácil de usar de acordo com suas necessidades.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.option}>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>Texto maior</Text>
                <Text style={styles.optionDescription}>
                  Aumenta o tamanho das letras no app para facilitar a leitura.
                </Text>
              </View>

              <Switch
                value={largeText}
                onValueChange={(val) => updateSettings({ largeText: val })}
                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.option}>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>Voz mais lenta</Text>
                <Text style={styles.optionDescription}>
                  Faz a assistente falar com mais calma e clareza.
                </Text>
              </View>

              <Switch
                value={slowVoice}
                onValueChange={(val) => updateSettings({ slowVoice: val })}
                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.option}>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>Alto contraste</Text>
                <Text style={styles.optionDescription}>
                  Melhora a visualização com cores mais fortes.
                </Text>
              </View>

              <Switch
                value={highContrast}
                onValueChange={(val) => updateSettings({ highContrast: val })}
                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.option}>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>
                  Leitura automática
                </Text>
                <Text style={styles.optionDescription}>
                  A assistente narra as telas ao entrar nelas.
                </Text>
              </View>

              <Switch
                value={autoRead}
                onValueChange={(val) => updateSettings({ autoRead: val })}
                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.option}>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionTitle}>Vibração</Text>
                <Text style={styles.optionDescription}>
                  Usa vibração para avisos e confirmações.
                </Text>
              </View>

              <Switch
                value={vibration}
                onValueChange={(val) => updateSettings({ vibration: val })}
                trackColor={{ false: "#E2E8F0", true: "#3B82F6" }}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.note}>
              Suas preferências são salvas automaticamente.
            </Text>

            <View style={styles.ttsWrapper}>
              <ListenOptionsButton textToSpeak={screenMessage} />
            </View>
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
    flex: 1,
    gap: 32,
    paddingHorizontal: 20,
    marginTop: 8,
  },

  textHeader: {
    alignItems: "center",
    gap: 8,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#000",
    textAlign: "center",
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 17,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 24,
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

  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },

  optionTextBox: {
    flex: 1,
  },

  optionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
  },

  optionDescription: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
  },

  footer: {
    alignItems: "center",
    gap: 24,
  },

  note: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    fontWeight: "600",
  },

  ttsWrapper: {
    opacity: 0.8,
  },
});
