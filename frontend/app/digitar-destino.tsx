import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { usePreventDoublePress } from "../src/hooks/usePreventDoublePress";
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { journeyService } from "../src/services/journey.service";
import { sessionService } from "../src/services/session.service";
import { useAutoSpeak } from "../src/hooks/useAutoSpeak";
import { vibrationService } from "../src/services/vibration.service";
import { recentSearchService } from "../src/services/recentSearch.service";
import { useThemeColors } from "../src/theme/colors";
import { layout } from "../src/theme/layout";

export default function TypeDestinationScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");

  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<any>(null);

  const screenMessage =
    "Digite um lugar, hospital, rua ou endereço para onde você quer ir. Depois toque em Confirmar.";

  useAutoSpeak(screenMessage);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const isInputValid = address.trim().length >= 3;

  const handleConfirm = usePreventDoublePress(async function (customAddress?: string) {
    const targetAddress = typeof customAddress === "string" ? customAddress : address;

    if (targetAddress.trim().length < 3) {
      vibrationService.error();
      setErrorText("Digite pelo menos 3 letras do destino.");
      return;
    }

    setIsLoading(true);
    setErrorText("");
    vibrationService.medium();

    try {
      sessionService.clearSessionId();

      const response = await journeyService.resolveDestination({
        text: targetAddress,
        origin: {
          lat: Number(latitude),
          lng: Number(longitude),
        },
      });

      const resolvedOptions: any[] = [];
      if (response.resolvedDestination) {
        resolvedOptions.push(response.resolvedDestination);
      }
      if (response.candidates && response.candidates.length > 0) {
        resolvedOptions.push(...response.candidates);
      }
      if (resolvedOptions.length === 0 && response.options && response.options.length > 0) {
        if (typeof response.options[0] === "object" && response.options[0] !== null) {
          resolvedOptions.push(...(response.options as any[]));
        } else if (typeof response.options[0] === "string") {
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
        void recentSearchService.addRecentSearch({
          query: bestOption?.name || response.interpretedDestination || targetAddress,
          title: bestOption?.name || response.interpretedDestination || targetAddress,
          address: bestOption?.address || "",
          lat: Number(bestOption?.lat) || undefined,
          lng: Number(bestOption?.lng) || undefined,
        });
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
            speechText: response.speechText || "",
            screen: response.screen || "",
            displayData: response.displayData ? JSON.stringify(response.displayData) : "",
            expectedInput: response.expectedInput || "",
            conversationState: response.conversationState || "",
            actions: response.actions ? JSON.stringify(response.actions) : "",
            sessionId: response.metadata?.sessionId || "",
            interactionMode: "text",
          },
        });
      } else {
        vibrationService.error();
        setErrorText(
          response.message || "Não encontrei esse lugar. Tente digitar de forma diferente.",
        );
      }
    } catch (err) {
      console.error("Erro ao buscar local:", err);
      vibrationService.error();
      setErrorText("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  });

  function handleCancel() {
    vibrationService.light();
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Pressable style={styles.overlay} onPress={handleCancel} />

      <Animated.View
        entering={ZoomIn.duration(300).springify()}
        style={[
          styles.modalContainer,
          isDark
            ? { backgroundColor: '#131A26', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, shadowColor: '#007AFF', shadowOpacity: 0.15, shadowRadius: 40 }
            : { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20 }
        ]}
      >
        {/* Icone do topo */}
        <View style={styles.iconContainer}>
          <View style={[
            styles.iconBackground,
            isDark 
              ? { backgroundColor: 'rgba(0, 122, 255, 0.1)', borderColor: 'rgba(0, 122, 255, 0.3)', borderWidth: 1 }
              : { backgroundColor: 'rgba(0, 122, 255, 0.08)', borderWidth: 0 }
          ]}>
            <Ionicons name="bus" size={26} color="#007AFF" />
          </View>
        </View>

        {/* Textos */}
        <Text style={[styles.title, { color: theme.text }]}>Destino</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Informe para onde você deseja ir
        </Text>

        {/* Input */}
        <View
          style={[
            styles.inputWrapper,
            isDark
              ? { backgroundColor: '#1E293B', borderColor: isFocused ? '#007AFF' : 'rgba(0, 122, 255, 0.4)' }
              : { backgroundColor: '#F8FAFC', borderColor: isFocused ? '#007AFF' : 'rgba(0,0,0,0.06)' },
            errorText ? { borderColor: theme.danger } : null,
          ]}
        >
          <Ionicons name="location-outline" size={20} color={isDark ? "#007AFF" : (isFocused ? "#007AFF" : theme.textMuted)} style={styles.inputIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.text }]}
            placeholder="Digite o destino"
            placeholderTextColor={theme.textMuted}
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              if (errorText) setErrorText("");
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
            onSubmitEditing={() => handleConfirm()}
            autoCorrect={false}
            autoCapitalize="words"
            editable={!isLoading}
            selectionColor="#007AFF"
            accessibilityLabel="Campo de destino"
            accessibilityHint="Digite o nome do lugar para onde deseja ir"
          />
        </View>

        {/* Mensagem de erro */}
        {!!errorText && (
          <Animated.Text
            entering={FadeInUp.duration(200)}
            style={[styles.errorText, { color: theme.danger }]}
            accessibilityRole="alert"
          >
            {errorText}
          </Animated.Text>
        )}

        {/* Botões */}
        <View style={styles.buttonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              isDark
                ? { backgroundColor: '#2E3A4B' }
                : { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
              pressed && { opacity: 0.7 },
              isLoading && { opacity: 0.4 }]}
            onPress={handleCancel}
            disabled={isLoading}
            accessibilityRole="button"
          >
            <Text style={[styles.btnCancelText, { color: theme.text }]}>Cancelar</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnConfirm,
              isDark && { shadowColor: '#007AFF', shadowOpacity: 0.4, shadowRadius: 15, elevation: 8 },
              (pressed || (!isInputValid && !isLoading)) && { opacity: 0.7 }]}
            onPress={() => handleConfirm()}
            disabled={isLoading}
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.btnConfirmText}>Confirmar</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  modalContainer: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 32,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconBackground: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    height: "100%",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: -8,
    marginBottom: 16,
    textAlign: "center",
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancelText: {
    fontSize: 16,
    fontWeight: "700",
  },
  btnConfirm: {
    backgroundColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnConfirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
