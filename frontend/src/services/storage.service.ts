import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** Armazenamento persistente compartilhado entre web e plataformas nativas. */
export const appStorage = {
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async getItem(key: string) {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async deleteItem(key: string) {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
