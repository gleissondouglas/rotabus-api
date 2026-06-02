import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BackButton } from "../src/components/BackButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { TextField } from "../src/components/TextField";
import { userService } from "../src/services/user.service";
import { sessionService } from "../src/services/session.service";
import { colors } from "../src/theme/colors";

export default function EditNameScreen() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const user = await sessionService.getUser();
      if (user) {
        setName(user.name);
      }
      setInitialLoading(false);
    }
    loadUser();
  }, []);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Erro", "Por favor, informe seu nome.");
      return;
    }

    try {
      setLoading(true);
      const result = await userService.updateProfile(name);
      Alert.alert("Sucesso", result.message);
      router.back();
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <BackButton />

          <View style={styles.content}>
            <Text style={styles.title}>Alterar nome</Text>
            <Text style={styles.subtitle}>
              Como você gostaria que o Nuvem chamasse você?
            </Text>

            <View style={styles.form}>
              <TextField
                label="Seu nome"
                placeholder="Ex: Maria Oliveira"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <View style={styles.buttonWrapper}>
                <PrimaryButton
                  title="Salvar alteração"
                  onPress={handleSave}
                  isLoading={loading}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    paddingTop: 40,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  form: {
    gap: 24,
  },
  buttonWrapper: {
    marginTop: 16,
  },
});
