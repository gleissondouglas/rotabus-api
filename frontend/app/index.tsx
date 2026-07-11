import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { AssistantPresence } from "../src/components/AssistantPresence";
import { hasSeenOnboarding } from "../src/services/onboardingStorage";
import { sessionService } from "../src/services/session.service";
import { speak, stopSpeaking } from "../src/services/speech.service";
import { useThemeColors } from "../src/theme/colors";
import { layout } from "../src/theme/layout";

const welcomeMessage =
  "Bem-vindo ao Nuvem. Encontre sua rota de ônibus falando para onde deseja ir.";

/**
 * Esta é a tela de entrada (WelcomeScreen). 
 * Sua função é decidir se o usuário deve ver as boas-vindas ou ser redirecionado
 * para a tela inicial caso já esteja logado.
 */

export default function WelcomeScreen() {
  const theme = useThemeColors();
  const { height, fontScale } = useWindowDimensions();
  const isCompact = height < 700 || fontScale > 1.15;
  // Estado para controlar se ainda estamos verificando o token no storage
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  // Estado para decidir se mostramos a UI de boas-vindas após a verificação
  const [shouldShowWelcome, setShouldShowWelcome] = useState(false);

  // Valores animados para uma entrada breve e discreta
  const visualOpacity = useRef(new Animated.Value(0)).current;
  const visualScale = useRef(new Animated.Value(0.92)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isActive = true;
    const timeout = setTimeout(() => {
      if (!isActive) return;

      setIsCheckingSession((current) => {
        if (current) {
          console.log("[Index] Forçando tela de boas-vindas por timeout.");
          setShouldShowWelcome(true);
          return false;
        }
        return false;
      });
    }, 3500);

    /**
     * Lógica de Verificação de Sessão:
     * Verifica se existe um token salvo e se o usuário já aceitou as permissões.
     */
    async function checkSession() {
      console.log("[Index] Verificando sessão...");

      try {
        const onboardingSeen = await hasSeenOnboarding();
        if (!isActive) return;

        if (!onboardingSeen) {
          clearTimeout(timeout);
          router.replace("/onboarding");
          return;
        }

        const token = await sessionService.getToken();
        const hasSeenPermissions = await sessionService.getHasSeenPermissions();

        if (!isActive) return;

        console.log("[Index] Resultado:", {
          hasToken: !!token,
          hasSeenPermissions,
        });
        clearTimeout(timeout);

        // Se tem token e já viu permissões, vai direto para o Início
        if (token && hasSeenPermissions) {
          router.replace("/inicio");
          return;
        }

        // Se tem token mas não viu as permissões (ex: primeira instalação), vai para Permissões
        if (token && !hasSeenPermissions) {
          router.replace("/permissoes");
          return;
        }

        // Caso contrário, mostra a tela de boas-vindas
        setShouldShowWelcome(true);
        setIsCheckingSession(false);
      } catch (error) {
        if (!isActive) return;

        console.log("[Index] Erro crítico:", error);
        clearTimeout(timeout);
        setShouldShowWelcome(true);
        setIsCheckingSession(false);
      }
    }

    checkSession();

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    // Se não for para mostrar as boas-vindas (ex: redirecionou), não faz nada
    if (!shouldShowWelcome) return;

    // Aciona a voz de boas-vindas
    speak(welcomeMessage);

    // Sequência curta: assistente -> mensagem -> ação
    Animated.sequence([
      Animated.parallel([
        Animated.timing(visualOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(visualScale, {
          toValue: 1,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      stopSpeaking();
    };
  }, [
    shouldShowWelcome,
    visualOpacity,
    visualScale,
    textOpacity,
    buttonOpacity,
  ]);

  function handleStart() {
    stopSpeaking();
    router.push("/login");
  }

  if (isCheckingSession) {
    return (
      <ScreenContainer backgroundColor={theme.background}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Entrando no Nuvem...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={theme.background} withPadding={false}>
      <View style={[styles.content, isCompact && styles.contentCompact]}>
        <View style={[styles.visualRegion, isCompact && styles.visualRegionCompact]}>
          <Animated.View
            style={[
              styles.assistantVisual,
              isCompact && styles.assistantVisualCompact,
              { backgroundColor: theme.primaryLight, opacity: visualOpacity, transform: [{ scale: visualScale }] },
            ]}
          >
            <AssistantPresence compact={isCompact} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.textRegion, { opacity: textOpacity }]}>
          <View style={styles.textContent}>
            <Text style={[styles.title, isCompact && styles.titleCompact, { color: theme.text }]} maxFontSizeMultiplier={1.3}>
              Bem-vindo ao Nuvem
            </Text>
            <Text style={[styles.description, { color: theme.textMuted }]} maxFontSizeMultiplier={1.45}>
              Encontre sua rota de ônibus falando para onde deseja ir.
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.buttonRegion, { opacity: buttonOpacity }]}>
          <PrimaryButton
            title="Entrar ou criar conta"
            onPress={handleStart}
            accessibilityLabel="Entrar ou criar conta"
            style={styles.button}
          />
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 16, fontWeight: "600" },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: layout.screenHorizontalPadding,
    paddingTop: 24,
    paddingBottom: 8,
  },
  contentCompact: {
    paddingHorizontal: layout.screenHorizontalPaddingSmall,
    paddingTop: 12,
  },
  visualRegion: {
    flex: 0.8,
    minHeight: 150,
    maxHeight: 210,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  visualRegionCompact: {
    minHeight: 112,
    maxHeight: 150,
  },
  assistantVisual: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  assistantVisualCompact: {
    width: 124,
    height: 124,
    borderRadius: 62,
  },
  textRegion: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textContent: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  title: {
    fontSize: layout.titleFontSize,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 39,
    marginBottom: 16,
  },
  titleCompact: {
    fontSize: layout.titleFontSizeSmall,
    lineHeight: 34,
  },
  description: {
    fontSize: layout.subtitleFontSize,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 27,
  },
  buttonRegion: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    paddingTop: 20,
    paddingBottom: 8,
  },
  button: {
    minHeight: layout.primaryButtonHeightSmall,
    borderRadius: layout.buttonBorderRadius,
  },
});
