import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

import { BackButton } from "../src/components/BackButton";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { sessionService } from "../src/services/session.service";
import { stopSpeaking } from "../src/services/speech.service";
import { userService } from "../src/services/user.service";
import { useThemeColors } from "../src/theme/colors";
import { AuthUser } from "../src/types/auth.types";

export default function SettingsScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");

  useEffect(() => {
    async function loadUser() {
      const userData = await sessionService.getUser();
      setUser(userData);
    }
    loadUser();
  }, []);

  const screenMessage = user 
    ? `Olá, ${user.name}. Você está na tela de configurações. Aqui você pode alterar dados da conta, mudar a senha, acessar acessibilidade, sair da conta ou excluir sua conta permanentemente.`
    : "Você está na tela de configurações. Aqui você pode alterar dados da conta, mudar a senha, acessar acessibilidade, sair da conta ou excluir sua conta permanentemente.";

  function handleAccessibility() {
    router.push("/acessibilidade");
  }

  function handleEditName() {
    router.push("/alterar-nome");
  }

  function handleChangePassword() {
    router.push("/alterar-senha");
  }

  function handleLogout() {
    Alert.alert("Sair da conta", "Deseja realmente sair da sua conta?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          stopSpeaking();
          await sessionService.clearSession();
          router.replace("/");
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Excluir sua conta?",
      "Essa ação é permanente. Seus dados de conta serão removidos e você precisará criar uma nova conta se quiser usar o Nuvem novamente.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Excluir conta",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              await userService.deleteOwnAccount();
              
              stopSpeaking();
              await sessionService.clearSession();
              
              Alert.alert("Conta excluída", "Sua conta foi excluída com sucesso.");
              router.replace("/");
            } catch (error) {
              console.error("Erro ao excluir conta:", error);
              Alert.alert(
                "Não consegui excluir",
                "Ocorreu um erro ao tentar excluir sua conta. Tente novamente em alguns instantes."
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
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
    <ScreenContainer withPadding={false} style={{ backgroundColor: "#F6F8FA" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topBar}>
          <BackButton label="Início" onPress={handleGoHome} />
        </View>

        <Animated.View entering={FadeInUp.duration(600)} style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.avatarCircle, { backgroundColor: "white" }]}>
              <Ionicons name="person" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: "#000" }]} maxFontSizeMultiplier={1.2}>
              {user?.name || "Configurações"}
            </Text>
            <Text style={[styles.subtitle, { color: "#666" }]} maxFontSizeMultiplier={1.2}>
              {user?.email || "Ajuste sua conta e preferências"}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]} maxFontSizeMultiplier={1.2}>Conta</Text>
            <SettingOption 
              icon="person-outline" 
              title="Alterar nome" 
              description="Atualize como o Nuvem chama você" 
              onPress={handleEditName} 
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: "#F0F0F0" }]} />
            <SettingOption 
              icon="key-outline" 
              title="Alterar senha" 
              description="Troque sua senha de acesso" 
              onPress={handleChangePassword} 
              theme={theme}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]} maxFontSizeMultiplier={1.2}>Preferências</Text>
            <SettingOption 
              icon="accessibility-outline" 
              title="Acessibilidade" 
              description="Texto maior, voz, contraste e vibração" 
              onPress={handleAccessibility} 
              theme={theme}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]} maxFontSizeMultiplier={1.2}>Privacidade</Text>
            <SettingOption 
              icon="shield-checkmark-outline" 
              title="Uso de dados" 
              description="Entenda o uso de localização e voz" 
              onPress={() => {
                Alert.alert(
                  "Uso de dados no Nuvem",
                  "Localização: Usamos para encontrar pontos de ônibus próximos e guiar você no caminho.\n\nVoz: Usamos o microfone apenas quando você pressiona o botão para entender para onde quer ir.\n\nDados: Seus dados de rota são processados para criar o melhor caminho e não são compartilhados com terceiros para fins publicitários."
                );
              }} 
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: "#F0F0F0" }]} />
            <SettingOption 
              icon="trash-outline" 
              title={isDeleting ? "Excluindo..." : "Excluir conta"} 
              description="Remover permanentemente seus dados" 
              onPress={handleDeleteAccount} 
              isDanger 
              disabled={isDeleting}
              theme={theme}
            />
          </View>

          <View style={styles.footer}>
            <View style={styles.ttsWrapper}>
              <ListenOptionsButton textToSpeak={screenMessage} />
            </View>
            
            <Pressable 
              style={({ pressed }) => [
                styles.logoutButton, 
                { backgroundColor: "rgba(239, 68, 68, 0.08)" },
                pressed && { opacity: 0.7 }
              ]} 
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Sair da conta"
            >
              <Ionicons name="log-out-outline" size={20} color={theme.danger} />
              <Text style={[styles.logoutText, { color: theme.danger }]} maxFontSizeMultiplier={1.2}>
                Sair da conta
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

interface SettingOptionProps {
  icon: any;
  iconLibrary?: "Ionicons" | "MaterialCommunityIcons";
  title: string;
  description: string;
  onPress: () => void;
  isDanger?: boolean;
  disabled?: boolean;
  theme: any;
}

const SettingOption = ({ icon, iconLibrary = "Ionicons", title, description, onPress, isDanger, disabled, theme }: SettingOptionProps) => (
  <Pressable 
    style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]} 
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={`${title}. ${description}`}
  >
    <View style={[styles.optionIconBg, { backgroundColor: isDanger ? "rgba(239, 68, 68, 0.08)" : theme.primaryLight }]}>
      {iconLibrary === "Ionicons" ? (
        <Ionicons name={icon} size={22} color={isDanger ? theme.danger : theme.primary} />
      ) : (
        <MaterialCommunityIcons name={icon} size={22} color={isDanger ? theme.danger : theme.primary} />
      )}
    </View>
    <View style={styles.optionTextContainer}>
      <Text style={[styles.optionTitle, { color: isDanger ? theme.danger : theme.text }]} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
      <Text style={styles.optionDescription} maxFontSizeMultiplier={1.2}>
        {description}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={theme.border} />
  </Pressable>
);

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
    gap: 16,
    paddingHorizontal: 20,
    marginTop: 8,
  },

  header: {
    alignItems: "center",
    marginBottom: 12,
  },

  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
  },

  section: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 16,
    opacity: 0.8,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },

  optionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },

  optionTextContainer: {
    flex: 1,
  },

  optionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },

  optionDescription: {
    marginTop: 2,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },

  divider: {
    height: 1,
    marginVertical: 4,
  },

  footer: {
    marginTop: 8,
    gap: 24,
    alignItems: "center",
  },

  ttsWrapper: {
    opacity: 0.8,
  },

  logoutButton: {
    width: "100%",
    height: 64,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  logoutText: {
    fontSize: 17,
    fontWeight: "800",
  },
});
