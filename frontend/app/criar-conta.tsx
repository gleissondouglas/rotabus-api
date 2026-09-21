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

export default function CreateAccountScreen() {
  const theme = useThemeColors();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleCreateAccount() {
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      Alert.alert("Atenção", "Preencha nome, e-mail e senha.");
      return;
    }

    if (senha.length < 6) {
      Alert.alert("Atenção", "A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await authService.createAccount({
        name: nome,
        email,
        password: senha,
      });

      await sessionService.saveAuthSession(response);
      Alert.alert("Conta criada", "Sua conta foi criada com sucesso.");
      router.push("/permissoes");
    } catch (error) {
      console.log("Erro completo ao criar conta:", error);
      Alert.alert("Erro", "Não foi possível criar sua conta.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSocialLogin(provider: string) {
    Alert.alert("Em breve", `Cadastro com ${provider} estará disponível em breve!`);
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
            <Text style={[styles.title, { color: theme.text }]}>Crie sua conta</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>É rápido, simples e gratuito</Text>
          </View>

          <View style={styles.cardContent}>
            <TextField
              placeholder="Nome completo"
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
              iconLeft="person-outline"
              style={styles.input}
            />

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
              placeholder="Crie uma senha"
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
              title="Criar conta"
              onPress={handleCreateAccount}
              isLoading={isLoading}
              style={styles.button}
            />
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
            <Pressable onPress={() => router.replace("/login")}>
              <Text style={[styles.loginLink, { color: theme.text }]}>
                Já tem conta? <Text style={{ color: theme.primary, fontWeight: "800" }}>Entrar</Text>
              </Text>
            </Pressable>

            <View style={styles.ttsWrapper}>
              <ListenOptionsButton textToSpeak="Você está na tela de criar conta. Digite seu nome, seu e-mail e uma senha. Depois toque em criar conta." />
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
  },
  button: {
    marginTop: 8,
    height: 56,
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
  loginLink: {
    fontSize: 16,
    fontWeight: "600",
  },
  ttsWrapper: {
    opacity: 0.9,
  },
});

