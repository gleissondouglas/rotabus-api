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
import { SocialButton } from "../src/components/SocialButton";
import { authService } from "../src/services/auth.service";
import { sessionService } from "../src/services/session.service";
import { useThemeColors } from "../src/theme/colors";

export default function LoginScreen() {
  const theme = useThemeColors();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !senha.trim()) {
      Alert.alert("Atenção", "Digite seu e-mail e sua senha.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await authService.login({
        email: email.trim(),
        password: senha,
      });

      await sessionService.saveAuthSession(response);
      router.replace("/permissoes");
    } catch (error) {
      console.log("Erro completo no login:", error);
      Alert.alert(
        "Erro no login",
        error instanceof Error ? error.message : "Não foi possível fazer login.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSocialLogin(provider: string) {
    Alert.alert("Em breve", `Login com ${provider} estará disponível em breve!`);
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
          <View style={styles.textHeader}>
            <Text style={[styles.title, { color: theme.text }]}>Bem-vindo!</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>Faça login para continuar sua viagem</Text>
          </View>

          <View style={styles.cardContent}>
            <TextField
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              iconLeft="mail-outline"
              style={styles.input}
            />

            <TextField
              placeholder="Senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry={!showPassword}
              iconLeft="lock-closed-outline"
              iconRight={
                <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={theme.textMuted} />
                </Pressable>
              }
              style={styles.input}
            />

            <PrimaryButton
              title="Entrar"
              onPress={handleLogin}
              isLoading={isLoading}
              style={styles.button}
            />

            <Pressable onPress={() => router.push("/esqueci-senha")} style={{ alignItems: "center", marginTop: 8 }}>
              <Text style={{ fontSize: 15, color: theme.primary, fontWeight: "600" }}>
                Esqueci minha senha
              </Text>
            </Pressable>
          </View>

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.textMuted }]}>ou continue com</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.socialContainer}>
            <SocialButton provider="apple" onPress={() => handleSocialLogin("Apple")} />
            <SocialButton provider="google" onPress={() => handleSocialLogin("Google")} />
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => router.replace("/criar-conta")}>
              <Text style={[styles.createAccount, { color: theme.text }]}>
                Não tem conta? <Text style={{ color: theme.primary, fontWeight: "800" }}>Criar conta</Text>
              </Text>
            </Pressable>

            <View style={styles.ttsWrapper}>
              <ListenOptionsButton textToSpeak="Você está na tela de login. Digite seu e-mail e sua senha. Depois toque no botão entrar. Se ainda não tiver conta, toque em criar conta." />
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
    paddingTop: 20,
  },
  container: {
    paddingHorizontal: 24,
    gap: 32,
  },
  textHeader: {
    alignItems: "center",
    gap: 8,
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
    fontWeight: "500",
  },
  cardContent: {
    gap: 16,
  },
  input: {
    // marginBottom is handled by gap
  },
  button: {
    marginTop: 8,
    height: 56, // matching the pill size
    borderRadius: 28,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "lowercase",
  },
  socialContainer: {
    width: "100%",
  },
  footer: {
    alignItems: "center",
    gap: 24,
  },
  createAccount: {
    fontSize: 16,
    fontWeight: "600",
  },
  ttsWrapper: {
    opacity: 0.9,
  },
});

