import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "../constants/storage";

interface AccessibilitySettings {
  largeText: boolean;
  slowVoice: boolean;
  highContrast: boolean;
  autoRead: boolean;
  vibration: boolean;
}

interface AccessibilityContextData extends AccessibilitySettings {
  updateSettings: (settings: Partial<AccessibilitySettings>) => Promise<void>;
  isLoading: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextData>(
  {} as AccessibilityContextData
);

const defaultSettings: AccessibilitySettings = {
  largeText: false,
  slowVoice: true,
  highContrast: false,
  autoRead: true,
  vibration: true,
};

// Helper para lidar com armazenamento
const storage = {
  async setItem(value: string) {
    if (Platform.OS === "web") {
      localStorage.setItem(STORAGE_KEYS.ACCESSIBILITY_SETTINGS, value);
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESSIBILITY_SETTINGS, value);
  },
  async getItem() {
    if (Platform.OS === "web") {
      return localStorage.getItem(STORAGE_KEYS.ACCESSIBILITY_SETTINGS);
    }
    return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESSIBILITY_SETTINGS);
  },
};

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const saved = await storage.getItem();
        if (saved) {
          setSettings(JSON.parse(saved));
        }
      } catch (error) {
        console.log("Erro ao carregar acessibilidade:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<AccessibilitySettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await storage.setItem(JSON.stringify(updated));
    } catch (error) {
      console.log("Erro ao salvar acessibilidade:", error);
    }
  };

  return (
    <AccessibilityContext.Provider
      value={{
        ...settings,
        updateSettings,
        isLoading,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
}
