import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { TextField } from "../src/components/TextField";
import { authService } from "../src/services/auth.service";
import { sessionService } from "../src/services/session.service";
import { useThemeColors } from "../src/theme/colors";

export default function CreateAccountScreen() {
  const theme = useThemeColors();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <ScreenContainer withPadding={false} style={{ backgroundColor: "#F6F8FA" }}>
      <View style={styles.header}>
        <BackButton />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.container}>
          <View style={styles.textHeader}>
            <Text style={styles.title}>Crie sua conta</Text>
            <Text style={styles.subtitle}>É rápido, simples e gratuito</Text>
          </View>

          <View style={styles.card}>
            <TextField
              placeholder="Nome completo"
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
              style={styles.input}
            />

            <TextField
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <TextField
              placeholder="Crie uma senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              style={styles.input}
            />

            <PrimaryButton
              title="Criar conta"
              onPress={handleCreateAccount}
              isLoading={isLoading}
              style={styles.button}
            />
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => router.push("/login")}>
              <Text style={styles.loginLink}>
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
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  container: {
    paddingHorizontal: 20,
    gap: 32,
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
  },
  card: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 32,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },
  input: {
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
    height: 64,
    borderRadius: 32,
  },
  footer: {
    alignItems: "center",
    gap: 24,
  },
  loginLink: {
    fontSize: 16,
    fontWeight: "600",
    color: "#444",
  },
  ttsWrapper: {
    opacity: 0.8,
  },
});
