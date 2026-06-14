import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../src/components/ScreenContainer";
import { AssistantLoadingState, LoadingStep } from "../src/components/AssistantLoadingState";
import { useAutoSpeak } from "../src/hooks/useAutoSpeak";
import { journeyService } from "../src/services/journey.service";
import { locationService } from "../src/services/location.service";
import { useThemeColors } from "../src/theme/colors";
import { formatLocalDateTimeWithOffset } from "../src/utils/date-time";
import { layout } from "../src/theme/layout";

export default function ProcessingScreen() {
  const params = useLocalSearchParams();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const isSmallHeight = height < 740;

  const latitudeParam = String(params.latitude || "");
  const longitudeParam = String(params.longitude || "");
  const destination = String(params.destination || "");
  const destinationLat = String(params.destinationLat || "");
  const destinationLng = String(params.destinationLng || "");
  const selectedDestination = String(params.selectedDestination || "");
  const sessionId = String(params.sessionId || "");
  const voiceMode = String(params.voiceMode || "") === "true";

  const timeType: "DEPARTURE" | "ARRIVAL" = params.timeType === "ARRIVAL" ? "ARRIVAL" : "DEPARTURE";
  const dateTime = String(
    params.dateTime || formatLocalDateTimeWithOffset(new Date()),
  );

  const [steps, setSteps] = useState<LoadingStep[]>([
    { id: '1', label: 'Confirmando destino', status: 'loading' },
    { id: '2', label: 'Buscando pontos próximos', status: 'pending' },
    { id: '3', label: 'Verificando ônibus disponíveis', status: 'pending' },
    { id: '4', label: 'Montando instruções simples', status: 'pending' },
  ]);

  const updateStep = (id: string, status: 'loading' | 'completed') => {
    setSteps(prev => prev.map(step => {
      if (step.id === id) return { ...step, status };
      if (status === 'loading' && Number(step.id) < Number(id)) return { ...step, status: 'completed' };
      return step;
    }));
  };

  const screenMessage = `Estamos encontrando o melhor caminho até ${destination}. Aguarde um momento enquanto verifico os ônibus disponíveis.`;

  useAutoSpeak(screenMessage);

  async function getFreshCurrentLocation() {
    const hasPermission = await locationService.requestLocationPermission();
    if (!hasPermission) throw new Error("Permissão de localização negada.");
    const currentLocation = await locationService.getCurrentLocation();
    return {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };
  }

  useEffect(() => {
    async function loadJourney() {
      try {
        if (!destination) {
          router.replace({
            pathname: "/rota-nao-encontrada",
            params: {
              latitude: latitudeParam,
              longitude: longitudeParam,
              destination,
              message: "Não recebemos o destino necessário para buscar a rota.",
            },
          });
          return;
        }

        updateStep('1', 'loading');
        const origin = await getFreshCurrentLocation();
        updateStep('1', 'completed');
        
        updateStep('2', 'loading');
        await new Promise(resolve => setTimeout(resolve, 800));
        updateStep('2', 'completed');

        updateStep('3', 'loading');
        let parsedDestLat: number | undefined = undefined;
        let parsedDestLng: number | undefined = undefined;

        if (destinationLat && destinationLat !== "null" && destinationLat !== "undefined" && destinationLat !== "") {
          parsedDestLat = Number(destinationLat);
        }
        if (destinationLng && destinationLng !== "null" && destinationLng !== "undefined" && destinationLng !== "") {
          parsedDestLng = Number(destinationLng);
        }

        // Validação defensiva: se coordenadas foram fornecidas de forma inválida, ou se
        // precisamos de coordenadas numéricas válidas para planejar rota e elas estão ausentes ou inválidas
        if (
          (destinationLat && (destinationLat === "null" || destinationLat === "undefined" || Number.isNaN(parsedDestLat))) ||
          (destinationLng && (destinationLng === "null" || destinationLng === "undefined" || Number.isNaN(parsedDestLng)))
        ) {
          throw new Error("Não consegui confirmar a localização desse destino. Tente escolher outra opção.");
        }

        const requestBody = {
          origin: { lat: origin.latitude, lng: origin.longitude },
          destination: {
            text: destination,
            lat: parsedDestLat,
            lng: parsedDestLng,
          },
          timePreference: { type: timeType, dateTime },
        };

        const journey = await journeyService.planJourney(requestBody);
        updateStep('3', 'completed');

        updateStep('4', 'loading');
        await new Promise(resolve => setTimeout(resolve, 600));
        updateStep('4', 'completed');

        router.replace({
          pathname: "/melhor-rota",
          params: {
            latitude: String(origin.latitude),
            longitude: String(origin.longitude),
            destination,
            destinationLat,
            destinationLng,
            selectedDestination,
            message: journey.message,
            summary: JSON.stringify(journey.summary),
            alerts: JSON.stringify(journey.alerts),
            steps: JSON.stringify(journey.steps),
            map: journey.map ? JSON.stringify(journey.map) : "",
            // --- Novos campos conversacionais ---
            speechText: journey.speechText || "",
            screen: journey.screen || "",
            displayData: journey.displayData ? JSON.stringify(journey.displayData) : "",
            expectedInput: journey.expectedInput || "",
            conversationState: journey.conversationState || "",
            actions: journey.actions ? JSON.stringify(journey.actions) : "",
            sessionId: journey.metadata?.sessionId || sessionId,
            voiceMode: voiceMode ? "true" : "false",
          },
        });
      } catch (error) {
        console.log("Erro ao buscar rota:", error);
        router.replace({
          pathname: "/rota-nao-encontrada",
          params: {
            latitude: latitudeParam,
            longitude: longitudeParam,
            destination,
            message: error instanceof Error ? error.message : "Não encontramos uma rota disponível.",
          },
        });
      }
    }

    const timer = setTimeout(loadJourney, 500);
    return () => clearTimeout(timer);
  }, []);

  function handleCancel() {
    router.replace({
      pathname: "/inicio",
      params: { latitude: latitudeParam, longitude: longitudeParam }
    });
  }

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.fullScreen}>
        <View style={[styles.content, { paddingHorizontal: isSmallHeight ? layout.screenHorizontalPaddingSmall : layout.screenHorizontalPadding }]}>
          <AssistantLoadingState
            title="Buscando a melhor rota"
            subtitle={`Estamos encontrando o melhor caminho até ${destination}.`}
            steps={steps}
          />
        </View>
        
        <View style={[styles.fixedBottomActions, { paddingBottom: insets.bottom + 16, paddingHorizontal: isSmallHeight ? layout.screenHorizontalPaddingSmall : layout.screenHorizontalPadding }]}>
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              { height: isSmallHeight ? layout.secondaryButtonHeight : 60 },
              pressed && { opacity: 0.7 }
            ]}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancelar busca e voltar ao início"
          >
            <Ionicons name="close-circle-outline" size={20} color="#64748B" />
            <Text style={styles.cancelButtonText} maxFontSizeMultiplier={1.2}>
              Cancelar
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F8FA",
  },
  fullScreen: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  fixedBottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    alignItems: "center",
  },
  cancelButton: {
    width: "100%",
    borderRadius: layout.buttonBorderRadius,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#64748B",
  },
});
