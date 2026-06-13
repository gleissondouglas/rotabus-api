import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { AuthResponse, AuthUser } from "../types/auth.types";

const TOKEN_KEY = "nuvem_token";
const USER_KEY = "nuvem_user";
const PERMISSIONS_SEEN_KEY = "nuvem_permissions_seen";

// Helper para lidar com armazenamento na web vs nativo
const storage = {
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
    return await SecureStore.getItemAsync(key);
  },
  async deleteItem(key: string) {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

async function saveAuthSession(auth: AuthResponse) {
  try {
    if (!auth.token) {
      throw new Error("Token não recebido.");
    }

    if (!auth.user) {
      throw new Error("Usuário não recebido.");
    }

    await storage.setItem(TOKEN_KEY, auth.token);
    await storage.setItem(USER_KEY, JSON.stringify(auth.user));
  } catch (error) {
    throw error;
  }
}

async function updateUserSession(user: AuthUser) {
  try {
    await storage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    throw error;
  }
}

async function getToken() {
  try {
    return await storage.getItem(TOKEN_KEY);
  } catch (error) {
    return null;
  }
}

async function getUser(): Promise<AuthUser | null> {
  try {
    const user = await storage.getItem(USER_KEY);

    if (!user) {
      return null;
    }

    return JSON.parse(user);
  } catch (error) {
    return null;
  }
}

async function setHasSeenPermissions(value: boolean) {
  try {
    await storage.setItem(PERMISSIONS_SEEN_KEY, String(value));
  } catch (error) {
    // ignore
  }
}

async function getHasSeenPermissions() {
  try {
    const value = await storage.getItem(PERMISSIONS_SEEN_KEY);

    return value === "true";
  } catch (error) {
    return false;
  }
}

async function clearSession() {
  try {
    await storage.deleteItem(TOKEN_KEY);
    await storage.deleteItem(USER_KEY);
    await storage.deleteItem(PERMISSIONS_SEEN_KEY);
  } catch (error) {
    // ignore
  }
}

let currentSessionId: string | null = null;

export const sessionService = {
  saveAuthSession,
  updateUserSession,
  getToken,
  getUser,
  setHasSeenPermissions,
  getHasSeenPermissions,
  clearSession,
  setSessionId: (id: string | null) => { currentSessionId = id; },
  getSessionId: () => currentSessionId,
  clearSessionId: () => { currentSessionId = null; },
};
