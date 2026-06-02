import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import "fast-text-encoding";

// Polyfill para DOMException (necessário para algumas libs no Hermes)
if (typeof global.DOMException === "undefined") {
  (global as any).DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || "DOMException";
    }
  };
}

import { AccessibilityProvider } from "../src/contexts/AccessibilityContext";
import { initSentry } from "../src/config/sentry.config";
import { useConnectivity } from "../src/hooks/useConnectivity";

/**
 * O RootLayout é o componente "pai" de toda a aplicação. 
 * Ele envolve todas as telas e fornece contextos globais.
 */

// Inicializa o Sentry para monitoramento de erros e performance antes do app carregar
initSentry();

function RootLayout() {
  // Monitora a conectividade com a internet globalmente
  useConnectivity();

  return (
    // O AccessibilityProvider gerencia estados de acessibilidade (ex: alto contraste) para todo o app
    <AccessibilityProvider>
      {/* O Stack do expo-router gerencia a navegação em pilha (uma tela sobre a outra) */}
      <Stack
        screenOptions={{
          headerShown: false, // Esconde o cabeçalho padrão para usarmos um customizado nas telas
          animation: "slide_from_right", // Transição lateral suave entre telas
          animationDuration: 300,
        }}
      />

      {/* Controla a barra de status do celular (hora, bateria, etc) */}
      <StatusBar style="dark" />
    </AccessibilityProvider>
  );
}

// O Sentry.wrap envolve o componente raiz para capturar erros automaticamente
export default Sentry.wrap(RootLayout);
