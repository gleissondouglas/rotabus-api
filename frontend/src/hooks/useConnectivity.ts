import { useState, useEffect } from 'react';
import * as NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

import { API_BASE_URL } from '../config/api.config';

/**
 * Hook para monitorar a conectividade com a internet.
 * Avisa o usuário caso a conexão seja perdida.
 */
export function useConnectivity() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  useEffect(() => {
    // Inscreve-se para mudanças no estado da rede
    const unsubscribe = NetInfo.addEventListener(state => {
      // Identifica se estamos usando um backend local para desenvolvimento
      const isLocalBackend = 
        API_BASE_URL.includes("localhost") || 
        API_BASE_URL.includes("127.0.0.1") || 
        API_BASE_URL.includes("10.0.2.2") ||
        API_BASE_URL.includes("192.168.");

      const status = (isLocalBackend || __DEV__)
        ? !!state.isConnected
        : (!!state.isConnected && state.isInternetReachable !== false);
      
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
