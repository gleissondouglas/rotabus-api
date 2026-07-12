import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { journeyService } from "../src/services/journey.service";
import { sessionService } from "../src/services/session.service";
import { useAutoSpeak } from "../src/hooks/useAutoSpeak";
import { vibrationService } from "../src/services/vibration.service";
import { useThemeColors } from "../src/theme/colors";
import { layout } from "../src/theme/layout";

export default function TypeDestinationScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();

  const latitude = String(params.latitude || "");
  const longitude = String(params.longitude || "");

  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

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

  async function handleConfirm() {
    if (!isInputValid) {
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
        text: address,
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
  }

  function handleCancel() {
    vibrationService.light();
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Overlay escuro semitransparente atrás do sheet */}
      <Pressable style={styles.overlay} onPress={handleCancel} />

      {/* Bottom sheet */}
      <Animated.View
        entering={FadeInDown.duration(300).springify()}
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
      >
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Campo de texto */}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            errorText ? styles.inputError : null,
          ]}
          placeholder="Digite o destino"
          placeholderTextColor="#9CA3AF"
          value={address}
          onChangeText={(text) => {
            setAddress(text);
            if (errorText) setErrorText("");
          }}
          returnKeyType="search"
          onSubmitEditing={handleConfirm}
          autoCorrect={false}
          autoCapitalize="words"
          editable={!isLoading}
          accessibilityLabel="Campo de destino"
          accessibilityHint="Digite o nome do lugar para onde deseja ir"
        />

        {/* Mensagem de erro */}
        {!!errorText && (
          <Animated.Text
            entering={FadeInUp.duration(200)}
            style={styles.errorText}
            accessibilityRole="alert"
          >
            {errorText}
          </Animated.Text>
        )}

        {/* Botões lado a lado */}
        <View style={styles.buttonsRow}>
          {/* Cancelar */}
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnCancel,
              pressed && { opacity: 0.7 },
              isLoading && { opacity: 0.4 },
            ]}
            onPress={handleCancel}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Cancelar e voltar"
          >
            <Text style={styles.btnCancelText}>Cancelar</Text>
          </Pressable>

          {/* Confirmar */}
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnConfirm,
              { backgroundColor: theme.primary },
              (pressed || (!isInputValid && !isLoading)) && { opacity: 0.65 },
            ]}
            onPress={handleConfirm}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={
              isLoading ? "Buscando destino..." : "Confirmar e buscar destino"
            }
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
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
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    marginBottom: 4,
  },
  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 18,
    fontSize: 17,
    fontWeight: "600",
    color: "#0F172A",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
    marginTop: -6,
    paddingHorizontal: 4,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    height: layout.primaryButtonHeight,
    borderRadius: layout.buttonBorderRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  btnCancel: {
    backgroundColor: "#EEF2FF",
  },
  btnCancelText: {
    color: "#3730A3",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  btnConfirm: {
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnConfirmText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
