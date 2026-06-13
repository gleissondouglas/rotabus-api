import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { BackButton } from "../src/components/BackButton";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { TextField } from "../src/components/TextField";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { ListenOptionsButton } from "../src/components/ListenOptionsButton";
import { journeyService } from "../src/services/journey.service";
import { sessionService } from "../src/services/session.service";
import { useAutoSpeak } from "../src/hooks/useAutoSpeak";
import { vibrationService } from "../src/services/vibration.service";
import { useThemeColors } from "../src/theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function TypeDestinationScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");

  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const inputRef = useRef<any>(null);

  const screenMessage = "Digite um lugar, hospital, rua ou endereço para onde você quer ir. Depois toque em encontrar rota.";

  useAutoSpeak(screenMessage);

  useEffect(() => {
    // Focar o input automaticamente após a animação de entrada
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const isInputValid = address.trim().length >= 3;

  async function handleSearchRoute() {
    if (!isInputValid) {
      vibrationService.error();
      setErrorText("Por favor, digite pelo menos 3 letras do destino.");
      return;
    }

    setIsLoading(true);
    setErrorText("");
    vibrationService.medium();

    try {
      // Inicia um novo diálogo limpando qualquer ID de sessão pré-existente
      sessionService.clearSessionId();

      const response = await journeyService.resolveDestination({
        text: address,
        origin: {
          lat: Number(latitude),
          lng: Number(longitude),
        },
      });

      // Extrai opções com coordenadas e dados de destino válidos de forma robusta e resiliente
      const resolvedOptions: any[] = [];
      if (response.resolvedDestination) {
        resolvedOptions.push(response.resolvedDestination);
      }
      if (response.candidates && response.candidates.length > 0) {
        resolvedOptions.push(...response.candidates);
      }
      if (resolvedOptions.length === 0 && response.options && response.options.length > 0) {
        if (typeof response.options[0] === 'object' && response.options[0] !== null) {
          resolvedOptions.push(...(response.options as any[]));
        } else if (typeof response.options[0] === 'string') {
          // Se for uma lista de strings, cria um esqueleto para compatibilidade
          response.options.forEach((optStr: any, idx: number) => {
            resolvedOptions.push({
              id: String(idx),
              name: String(optStr),
              address: response.displayData?.items?.[idx]?.address || "",
              lat: null,
              lng: null,
              source: "LEGACY_FALLBACK",
            });
          });
        }
      }

      if (response.mode === "resolved" || response.mode === "suggestions") {
        const bestOption = resolvedOptions[0];
        vibrationService.success();
        router.push({
          pathname: "/confirmar-destino",
          params: {
            latitude,
            longitude,
            destination: bestOption?.name || response.interpretedDestination,
            address: bestOption?.address || "",
            confirmationQuestion: response.voice?.confirmationQuestion || response.message,
            options: JSON.stringify(resolvedOptions),
            mode: response.mode,
            message: response.message,
            // --- Novos campos conversacionais ---
            speechText: response.speechText || "",
            screen: response.screen || "",
            displayData: response.displayData ? JSON.stringify(response.displayData) : "",
            expectedInput: response.expectedInput || "",
            conversationState: response.conversationState || "",
            actions: response.actions ? JSON.stringify(response.actions) : "",
            sessionId: response.metadata?.sessionId || "",
          },
        });
      } else {
        vibrationService.error();
        setErrorText(response.message || "Não encontrei esse lugar. Tente digitar de forma diferente.");
      }
    } catch (err) {
      console.error("Erro ao buscar local:", err);
      vibrationService.error();
      setErrorText("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ScreenContainer withPadding={false} style={{ backgroundColor: "#F6F8FA" }}>
      <View style={styles.topBar}>
        <BackButton />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          entering={FadeInUp.duration(600)} 
          style={styles.content}
        >
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
              <Ionicons name="map" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: "#000" }]} maxFontSizeMultiplier={1.3}>Para onde vamos?</Text>
            <Text style={[styles.subtitle, { color: "#666" }]} maxFontSizeMultiplier={1.2}>
              Digite um lugar, hospital, rua ou endereço.
            </Text>
          </View>

          <View style={styles.card}>
            <TextField
              ref={inputRef}
              label="Destino"
              placeholder="Ex: Uniube, Hospital Regional ou Rua 52"
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                if (errorText) setErrorText("");
              }}
              autoFocus={false}
              returnKeyType="search"
              onSubmitEditing={handleSearchRoute}
              style={styles.input}
            />

            {!!errorText && (
              <View 
                style={styles.errorCard} 
                accessible={true} 
                accessibilityLabel={`Atenção: ${errorText}`}
                accessibilityRole="alert"
              >
                <Ionicons name="alert-circle" size={24} color="#EF4444" />
                <View style={styles.errorTextContainer}>
                  <Text style={styles.errorTitle}>Não consegui buscar</Text>
                  <Text style={styles.errorDescription}>{errorText}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              title={errorText ? "Tentar novamente" : "Encontrar rota"}
              onPress={handleSearchRoute}
              isLoading={isLoading}
              disabled={!isInputValid && !isLoading}
              style={[styles.button, (!isInputValid && !isLoading) ? { opacity: 0.6 } : {}]}
              accessibilityLabel={errorText ? "Tentar encontrar rota novamente" : "Confirmar e encontrar rota para o destino digitado"}
            />

            <View style={styles.ttsWrapper}>
              <ListenOptionsButton 
                label="Ouvir ajuda" 
                textToSpeak={screenMessage} 
                accessibilityLabel="Ouvir instruções para preencher esta tela"
              />
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    justifyContent: "flex-start",
    paddingTop: 20,
  },
  content: {
    paddingHorizontal: 20,
    gap: 24,
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 24,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 28,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
    gap: 16,
  },
  input: {
    marginBottom: 0,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF2F2",
    padding: 16,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorTextContainer: {
    flex: 1,
  },
  errorTitle: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  errorDescription: {
    color: "#991B1B",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  actions: {
    gap: 24,
    alignItems: "center",
  },
  button: {
    height: 64,
    borderRadius: 32,
    width: "100%",
  },
  ttsWrapper: {
    opacity: 0.8,
  },
});
