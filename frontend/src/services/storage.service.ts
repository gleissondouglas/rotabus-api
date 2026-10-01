import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CHUNK_SIZE = 1800; // Limite seguro para não estourar os 2048 bytes do iOS Keychain
const CHUNKED_PREFIX = "__ROTABUS_CHUNKED__:";

/** Armazenamento persistente compartilhado entre web e plataformas nativas com chunking defensivo. */
export const appStorage = {
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    // Payload grande: divide em chunks seguros
    const totalChunks = Math.ceil(value.length / CHUNK_SIZE);
    const manifest = `${CHUNKED_PREFIX}${totalChunks}`;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunk);
    }

    await SecureStore.setItemAsync(key, manifest);
  },

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }

    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;

    if (!raw.startsWith(CHUNKED_PREFIX)) {
      return raw;
    }

    // Reconstrói o valor a partir dos chunks sequenciais
    const totalChunks = parseInt(raw.replace(CHUNKED_PREFIX, ""), 10);
    if (isNaN(totalChunks) || totalChunks <= 0) return null;

    let fullValue = "";
    for (let i = 0; i < totalChunks; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
      if (chunk === null) return null; // Corrupção de chunk
      fullValue += chunk;
    }

    return fullValue;
  },

  async deleteItem(key: string) {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }

    try {
      const raw = await SecureStore.getItemAsync(key);
      if (raw && raw.startsWith(CHUNKED_PREFIX)) {
        const totalChunks = parseInt(raw.replace(CHUNKED_PREFIX, ""), 10);
        if (!isNaN(totalChunks) && totalChunks > 0) {
          for (let i = 0; i < totalChunks; i++) {
            try {
              await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
            } catch {
              // chunk já deletado ou indisponível
            }
          }
        }
      }
    } catch {
      // ignora erro ao ler manifesto
    }

    await SecureStore.deleteItemAsync(key);
  },
};

