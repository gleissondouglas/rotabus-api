import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { speak, stopSpeaking } from "../services/speech.service";
import { useAccessibility } from "../contexts/AccessibilityContext";

export function useAutoSpeak(message: string) {
  const { autoRead } = useAccessibility();

  useFocusEffect(
    useCallback(() => {
      if (!autoRead || !message.trim()) {
        return;
      }

      speak(message);

      return () => {
        stopSpeaking();
      };
    }, [message, autoRead]),
  );
}
