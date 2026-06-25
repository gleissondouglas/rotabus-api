import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";

import { PrimaryButton } from "../src/components/PrimaryButton";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { sessionService } from "../src/services/session.service";
import { speak, stopSpeaking } from "../src/services/speech.service";
import { useThemeColors } from "../src/theme/colors";

const { width } = Dimensions.get("window");

const welcomeMessage =
  "Bem-vindo ao Nuvem. Sua assistente de mobilidade por voz. Encontre rotas de ônibus de forma simples.";

/**
 * Esta é a tela de entrada (WelcomeScreen). 
 * Sua função é decidir se o usuário deve ver as boas-vindas ou ser redirecionado
 * para a tela inicial caso já esteja logado.
 */

export default function WelcomeScreen() {
  const theme = useThemeColors();
  // Estado para controlar se ainda estamos verificando o token no storage
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  // Estado para decidir se mostramos a UI de boas-vindas após a verificação
  const [shouldShowWelcome, setShouldShowWelcome] = useState(false);

  // Valores animados para criar a sequência de entrada visual
  const busOpacity = useRef(new Animated.Value(0)).current;
  const busTranslateX = useRef(new Animated.Value(-width * 0.2)).current;
  const routeWidth = useRef(new Animated.Value(0)).current;
  const pinScale = useRef(new Animated.Value(0)).current;
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

    // Sequência de Animações: Ônibus -> Linha -> Pin -> Texto -> Botão
    Animated.sequence([
      // 1. Ônibus surge com fade-in e desliza levemente
      Animated.parallel([
        Animated.timing(busOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(busTranslateX, {
          toValue: -40,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // 2. A linha da rota "cresce" e o pin de destino aparece com efeito mola
      Animated.parallel([
        Animated.timing(routeWidth, {
          toValue: 80,
          duration: 400,
          useNativeDriver: false, // width não suporta native driver
        }),
        Animated.spring(pinScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // 3. O título e subtítulo aparecem
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      // 4. Por fim, o botão principal de ação aparece
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      stopSpeaking();
    };
  }, [
    shouldShowWelcome,
    busOpacity,
    busTranslateX,
    routeWidth,
    pinScale,
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
    <ScreenContainer backgroundColor={theme.background}>
      <View style={styles.content}>
        <View style={styles.mainContent}>
          <View style={styles.illustrationContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
            <View style={[styles.heroGlow, { backgroundColor: theme.primaryLight }]} />
            <View style={[styles.routeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.routeDot, styles.routeDotStart, { backgroundColor: theme.primaryLight }]} />
              <View style={[styles.routeDot, styles.routeDotEnd, { backgroundColor: theme.primaryLight }]} />
              <Animated.View
                style={[
                  styles.routeLine,
                  {
                    width: routeWidth,
                    backgroundColor: theme.primaryLight,
                  },
                ]}
              />

              <Animated.View 
                style={[
                  styles.busWrapper, 
                  { 
                    opacity: busOpacity,
                    transform: [{ translateX: busTranslateX }]
                  }
                ]}
              >
                <View style={[styles.busBadge, { backgroundColor: theme.primary }]}>
                  <MaterialCommunityIcons name="bus-side" size={66} color={theme.white} />
                </View>
              </Animated.View>

              <Animated.View 
                style={[
                  styles.pinWrapper, 
                  { 
                    transform: [{ scale: pinScale }]
                  }
                ]}
              >
                <View style={[styles.pinBadge, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Ionicons name="location" size={38} color={theme.danger} />
                </View>
              </Animated.View>
            </View>
          </View>

          <Animated.View style={[styles.textContent, { opacity: textOpacity }]}>
            <Text style={[styles.kicker, { color: theme.primary }]}>Mobilidade por voz</Text>
            <Text style={[styles.title, { color: theme.text }]} maxFontSizeMultiplier={1.25}>
              Bem-vindo ao Nuvem
            </Text>
            <Text style={[styles.subtitle, { color: theme.text }]} maxFontSizeMultiplier={1.25}>
              Sua assistente de mobilidade por voz.
            </Text>
            <Text style={[styles.supportingText, { color: theme.textMuted }]} maxFontSizeMultiplier={1.35}>
              Encontre rotas de ônibus de forma simples.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonWrapper, { opacity: buttonOpacity }]}>
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
  content: { flex: 1, justifyContent: "space-between", paddingVertical: 28 },
  mainContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 30 },
  illustrationContainer: {
    height: 248,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  heroGlow: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    opacity: 0.55,
  },
  routeCard: {
    width: "86%",
    maxWidth: 330,
    height: 164,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 6,
  },
  routeDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  routeDotStart: {
    left: 42,
    top: 46,
  },
  routeDotEnd: {
    right: 48,
    bottom: 42,
  },
  routeLine: {
    position: "absolute",
    height: 6,
    borderRadius: 3,
    left: "34%",
    top: 80,
  },
  busWrapper: {
    zIndex: 2,
  },
  busBadge: {
    width: 112,
    height: 92,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pinWrapper: {
    position: "absolute",
    right: "18%",
    zIndex: 1,
    top: 48,
  },
  pinBadge: {
    width: 62,
    height: 62,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textContent: {
    alignItems: "center",
    paddingHorizontal: 22,
    maxWidth: 360,
  },
  kicker: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 40,
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 25,
  },
  supportingText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 24,
  },
  buttonWrapper: { width: "100%", paddingHorizontal: 24, paddingBottom: 16 },
  button: {
    minHeight: 66,
    borderRadius: 18,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 5,
  },
});
