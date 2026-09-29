import { useEffect, useState } from "react";
import { getSpeakingState, subscribeToSpeakingState } from "../services/speech.service";

/**
 * Hook que expõe de forma reativa se o TTS está falando agora.
 * 
 * Performance: Substituiu o antigo polling (4 setState/segundo) por um
 * sistema de Event Listener que atualiza instantaneamente sem overhead.
 */
export function useIsSpeaking(): boolean {
  // Inicializa com o estado atual síncrono para evitar flash incorreto no mount
  const [isSpeaking, setIsSpeaking] = useState(getSpeakingState());

  useEffect(() => {
    const unsubscribe = subscribeToSpeakingState((speaking) => {
      setIsSpeaking(speaking);
    });

    return () => unsubscribe();
  }, []);

  return isSpeaking;
}
