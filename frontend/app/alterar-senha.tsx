import { router } from "expo-router";
import { useState } from "react";
import {
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
import { colors } from "../src/theme/colors";

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Erro", "Por favor, preencha todos os campos.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Erro", "A nova senha e a confirmação não coincidem.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Erro", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      setLoading(true);
      const result = await userService.changePassword(currentPassword, newPassword);
      Alert.alert("Sucesso", result.message);
      router.back();
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.title}>Alterar senha</Text>
            <Text style={styles.subtitle}>
              Mantenha sua conta segura trocando sua senha periodicamente.
            </Text>

            <View style={styles.form}>
              <TextField
                label="Senha atual"
                placeholder="Digite sua senha atual"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />

              <TextField
                label="Nova senha"
                placeholder="Digite a nova senha"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />

              <TextField
                label="Confirmar nova senha"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <View style={styles.buttonWrapper}>
                <PrimaryButton
                  title="Alterar senha"
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    paddingTop: 20,
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
    marginBottom: 20,
  },
  form: {
    gap: 20,
  },
  buttonWrapper: {
    marginTop: 10,
  },
});
