import { useState, useEffect } from 'react';
import * as NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

/**
 * Hook para monitorar a conectividade com a internet.
 * Avisa o usuário caso a conexão seja perdida.
 */
export function useConnectivity() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  useEffect(() => {
    // Inscreve-se para mudanças no estado da rede
    const unsubscribe = NetInfo.addEventListener(state => {
      const status = !!state.isConnected && !!state.isInternetReachable;
      
      if (isConnected && !status) {
        // Acabou de perder a conexão
        Alert.alert(
          "Sem Internet",
          "Sua conexão com a internet caiu. Algumas funcionalidades podem não funcionar corretamente.",
          [{ text: "Entendi" }]
        );
      }
      
      setIsConnected(status);
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected]);

  return isConnected;
}
