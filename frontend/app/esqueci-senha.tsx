import { BackgroundGradient } from "../src/components/BackgroundGradient";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { TextField } from "../src/components/TextField";
import { authService } from "../src/services/auth.service";
import { useThemeColors } from "../src/theme/colors";

function ShieldHaloVisual() {
  const theme = useThemeColors();
  
  return (
    <View style={styles.shieldContainer}>
      <View style={[styles.halo, styles.haloOuter, { borderColor: theme.primary + "1A" }]}>
        <View style={[styles.halo, styles.haloMiddle, { borderColor: theme.primary + "33" }]}>
          <View style={[styles.halo, styles.haloInner, { backgroundColor: theme.primary + "1A", borderWidth: 0 }]}>
            <Ionicons name="shield-outline" size={32} color={theme.primary} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function ForgotPasswordScreen() {
  const theme = useThemeColors();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      Alert.alert("Atenção", "Digite o e-mail cadastrado na sua conta.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await authService.forgotPassword(email.trim());
      setIsSuccess(true);
      Alert.alert(
        "Verifique seu e-mail",
        response.message || "Enviamos instruções para recuperar a sua senha.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Não foi possível solicitar a recuperação de senha."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <BackgroundGradient />
      <ScreenContainer withPadding={false} backgroundColor="transparent">
      <View style={styles.header}>
        <BackButton />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.container}>
          
          <ShieldHaloVisual />

          <View style={styles.textHeader}>
            <Text style={[styles.title, { color: theme.text }]}>Recuperar Senha</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Digite seu e-mail cadastrado e enviaremos as instruções para você redefinir sua senha.
            </Text>
          </View>

          <View style={styles.cardContent}>
            <TextField
              placeholder="Seu e-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              iconLeft="mail-outline"
              style={styles.input}
            />

            <PrimaryButton
              title="Enviar instruções"
              onPress={handleReset}
              isLoading={isLoading}
              disabled={isSuccess}
              style={styles.button}
            />
          </View>

          <View style={styles.linksContainer}>
            <Pressable onPress={() => router.back()}>
              <Text style={[styles.loginLink, { color: theme.textMuted }]}>
                Lembrou a senha? <Text style={{ color: theme.primary, fontWeight: "800" }}>Fazer login</Text>
              </Text>
            </Pressable>

            <Text style={[styles.spamHint, { color: theme.textMuted }]}>
              Não se esqueça de checar a caixa de spam ou lixo eletrônico.
            </Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.ttsWrapper}>
              <ListenOptionsButton textToSpeak="Você está na tela de recuperação de senha. Digite o seu e-mail e toque no botão enviar instruções para recebê-las." />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 40,
    paddingTop: 10,
  },
  container: {
    paddingHorizontal: 24,
    gap: 24,
  },
  shieldContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  halo: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    borderWidth: 1,
  },
  haloOuter: {
    width: 140,
    height: 140,
  },
  haloMiddle: {
    width: 100,
    height: 100,
  },
  haloInner: {
    width: 70,
    height: 70,
  },
  textHeader: {
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
    fontSize: 15,
    textAlign: "center",
    fontWeight: "500",
    paddingHorizontal: 10,
    lineHeight: 22,
  },
  cardContent: {
    gap: 16,
  },
  input: {
  },
  button: {
    marginTop: 8,
    height: 56,
    borderRadius: 28,
  },
  linksContainer: {
    alignItems: "center",
    gap: 24,
    marginTop: 8,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: "600",
  },
  spamHint: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 18,
    opacity: 0.8,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  ttsWrapper: {
    opacity: 0.9,
  },
});

