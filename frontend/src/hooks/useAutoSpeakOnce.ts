import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { speak, stopSpeaking } from "../services/speech.service";
import { useAccessibility } from "../contexts/AccessibilityContext";

const spokenKeys = new Set<string>();

export function useAutoSpeakOnce(key: string, message: string) {
  const { autoRead } = useAccessibility();

  useFocusEffect(
    useCallback(() => {
      if (!autoRead || !message.trim()) {
        return;
      }

      if (spokenKeys.has(key)) {
        return;
      }

      spokenKeys.add(key);
      speak(message);

      return () => {
        stopSpeaking();
      };
    }, [key, message, autoRead]),
  );
}
