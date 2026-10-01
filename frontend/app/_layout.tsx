import { useEffect, useRef } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import "fast-text-encoding";

import { AccessibilityProvider } from "../src/contexts/AccessibilityContext";
import { initSentry } from "../src/config/sentry.config";
import { useConnectivity } from "../src/hooks/useConnectivity";
import { registerForPushNotificationsAsync } from "../src/services/notification.service";
import { scheduledTripService } from "../src/services/scheduledTrip.service";
import { speak } from "../src/services/speech.service";

// Polyfill para DOMException (necessário para algumas libs no Hermes)
if (typeof global.DOMException === "undefined") {
  (global as any).DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || "DOMException";
    }
  };
}

/**
 * O RootLayout é o componente "pai" de toda a aplicação. 
 * Ele envolve todas as telas e fornece contextos globais.
 */

// Inicializa o Sentry para monitoramento de erros e performance antes do app carregar
initSentry();

function RootLayout() {
  // Monitora a conectividade com a internet globalmente
  useConnectivity();

  const lastHandledNotifIdRef = useRef<string | null>(null);

  // Registra para notificações push ao abrir o app
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) console.log("Push Token Ativo:", token);
    });
  }, []);

  // Trata cliques em notificações de lembrete de rota (Deep Linking e Cold Start)
  useEffect(() => {
    async function processNotificationResponse(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      try {
        const notifId = response.notification?.request?.identifier;
        if (notifId && lastHandledNotifIdRef.current === notifId) {
          return; // Previne processamento duplo (cold start + listener simultâneos)
        }
        if (notifId) {
          lastHandledNotifIdRef.current = notifId;
        }

        const notifData = response.notification?.request?.content?.data;
        const isRouteReminder =
          notifData?.type === "ROUTE_REMINDER" ||
          !!notifData?.tripId ||
          !!notifData?.leaveHomeDateTime;

        if (isRouteReminder) {
          const trip = await scheduledTripService.getScheduledTrip();
          if (trip && trip.params) {
            const timing = scheduledTripService.getTripTimingStatus(trip);
            if (timing.status === "expired") {
              Alert.alert(
                "Ônibus já passou",
                `O horário previsto para sair e pegar o ônibus para ${trip.destination} já passou. Deseja buscar uma nova rota?`,
                [
                  {
                    text: "Dispensar",
                    style: "cancel",
                    onPress: () => {
                      void scheduledTripService.clearScheduledTrip(false);
                    },
                  },
                  {
                    text: "Buscar nova rota",
                    onPress: () => {
                      void scheduledTripService.clearScheduledTrip(false);
                      setTimeout(() => {
                        router.push({
                          pathname: "/digitar-destino",
                          params: { prefill: trip.destination },
                        });
                      }, 150);
                    },
                  },
                ]
              );
              speak(`Atenção: o horário do ônibus para ${trip.destination} já passou.`);
            } else {
              speak(`Abrindo sua rota agendada para ${trip.destination || "seu destino"}.`);
              setTimeout(() => {
                router.replace({
                  pathname: "/melhor-rota",
                  params: trip.params,
                });
              }, 150);
            }
          }
        }
      } catch (err) {
        console.warn("[RootLayout] Erro ao processar clique na notificação:", err);
      }
    }

    // Caso 1: Cold start (app fechado e aberto pelo toque na notificação)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        processNotificationResponse(response);
      }
    });

    // Caso 2: App em background ou foreground
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      processNotificationResponse(response);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AccessibilityProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 260,
          }}
        />
        <StatusBar style="auto" />
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}

// O Sentry.wrap envolve o componente raiz para capturar erros automaticamente
export default Sentry.wrap(RootLayout);
