import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";

import { ScreenContainer } from "../src/components/ScreenContainer";
import { sessionService } from "../src/services/session.service";
import { speak, stopSpeaking } from "../src/services/speech.service";
import { colors } from "../src/theme/colors";

const { width } = Dimensions.get("window");

const welcomeMessage =
  "Bem-vindo ao Nuvem. Sua assistente de mobilidade por voz. Encontre rotas de ônibus de forma simples.";

/**
 * Esta é a tela de entrada (WelcomeScreen). 
 * Sua função é decidir se o usuário deve ver as boas-vindas ou ser redirecionado
 * para a tela inicial caso já esteja logado.
 */

export default function WelcomeScreen() {
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
    /**
     * Lógica de Verificação de Sessão:
     * Verifica se existe um token salvo e se o usuário já aceitou as permissões.
     */
    async function checkSession() {
      console.log("[Index] Verificando sessão...");
      
      // Timeout de segurança: se a verificação demorar demais, libera a tela de boas-vindas
      const timeout = setTimeout(() => {
        setIsCheckingSession((current) => {
          if (current) {
            console.log("[Index] Forçando tela de boas-vindas por timeout.");
            setShouldShowWelcome(true);
            return false;
          }
          return false;
        });
      }, 3500);

      try {
        const token = await sessionService.getToken();
        const hasSeenPermissions = await sessionService.getHasSeenPermissions();

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
        console.log("[Index] Erro crítico:", error);
        clearTimeout(timeout);
        setShouldShowWelcome(true);
        setIsCheckingSession(false);
      }
    }

    checkSession();
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
  }, [shouldShowWelcome]);

  function handleStart() {
    stopSpeaking();
    router.push("/login");
  }

  if (isCheckingSession) {
    return (
      <ScreenContainer backgroundColor={colors.background}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Entrando no Nuvem...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <View style={styles.content}>
        <View style={styles.mainContent}>
          {/* Bus Animation Area */}
          <View style={styles.illustrationContainer} accessibilityElementsHidden={true} importantForAccessibility="no">
            <View style={styles.animationWrapper}>
              {/* Route Line */}
              <Animated.View style={[styles.routeLine, { width: routeWidth }]} />
              
              {/* Bus */}
              <Animated.View 
                style={[
                  styles.busWrapper, 
                  { 
                    opacity: busOpacity,
                    transform: [{ translateX: busTranslateX }]
                  }
                ]}
              >
                <MaterialCommunityIcons name="bus-side" size={70} color={colors.primary} />
              </Animated.View>

              {/* Pin */}
              <Animated.View 
                style={[
                  styles.pinWrapper, 
                  { 
                    transform: [{ scale: pinScale }]
                  }
                ]}
              >
                <Ionicons name="location" size={36} color={colors.danger} />
              </Animated.View>
            </View>
          </View>

          {/* Text Content */}
          <Animated.View style={[styles.textContent, { opacity: textOpacity }]}>
            <Text style={styles.title}>Bem-vindo ao Nuvem</Text>
            <Text style={styles.subtitle}>Sua assistente de mobilidade por voz.</Text>
            <Text style={styles.supportingText}>Encontre rotas de ônibus de forma simples.</Text>
          </Animated.View>
        </View>

        {/* Action Button */}
        <Animated.View style={[styles.buttonWrapper, { opacity: buttonOpacity }]}>
          <Pressable 
            style={styles.button} 
            onPress={handleStart}
            accessibilityLabel="Entrar ou criar conta"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Entrar ou criar conta</Text>
          </Pressable>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { fontSize: 16, fontWeight: "600" },
  content: { flex: 1, justifyContent: "space-between", paddingVertical: 40 },
  mainContent: { flex: 1, alignItems: "center", justifyContent: "center" },
  illustrationContainer: {
    height: 200,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  animationWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 200,
    height: 100,
  },
  routeLine: {
    position: "absolute",
    height: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: 2,
    left: "30%",
  },
  busWrapper: {
    zIndex: 2,
  },
  pinWrapper: {
    position: "absolute",
    right: "20%",
    zIndex: 1,
    marginTop: -10,
  },
  textContent: {
    alignItems: "center",
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  supportingText: {
    fontSize: 16,
    fontWeight: "400",
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
  },
  buttonWrapper: { width: "100%", paddingHorizontal: 24, paddingBottom: 20 },
  button: {
    width: "100%",
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { fontSize: 18, fontWeight: "700", color: colors.white },
});

