import { AuthResponse, AuthUser } from "../types/auth.types";
import { appStorage } from "./storage.service";

const TOKEN_KEY = "nuvem_token";
const USER_KEY = "nuvem_user";
const PERMISSIONS_SEEN_KEY = "nuvem_permissions_seen";

async function saveAuthSession(auth: AuthResponse) {
  try {
    if (!auth.token) {
      throw new Error("Token não recebido.");
    }

    if (!auth.user) {
      throw new Error("Usuário não recebido.");
    }

    await appStorage.setItem(TOKEN_KEY, auth.token);
    await appStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  } catch (error) {
    throw error;
  }
}

async function updateUserSession(user: AuthUser) {
  try {
    await appStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    throw error;
  }
}

async function getToken() {
  try {
    return await appStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function getUser(): Promise<AuthUser | null> {
  try {
    const user = await appStorage.getItem(USER_KEY);

    if (!user) {
      return null;
    }

    return JSON.parse(user);
  } catch {
    return null;
  }
}

async function setHasSeenPermissions(value: boolean) {
  try {
    await appStorage.setItem(PERMISSIONS_SEEN_KEY, String(value));
  } catch {
    // ignore
  }
}

async function getHasSeenPermissions() {
  try {
    const value = await appStorage.getItem(PERMISSIONS_SEEN_KEY);

    return value === "true";
  } catch {
    return false;
  }
}

const SESSION_ID_KEY = "nuvem_session_id";
let currentSessionId: string | null = null;

async function clearSession() {
  try {
    await appStorage.deleteItem(TOKEN_KEY);
    await appStorage.deleteItem(USER_KEY);
    await appStorage.deleteItem(PERMISSIONS_SEEN_KEY);
    await appStorage.deleteItem(SESSION_ID_KEY);
    currentSessionId = null;
  } catch {
    // ignore
  }
}

async function restoreSessionId(): Promise<string | null> {
  try {
    const id = await appStorage.getItem(SESSION_ID_KEY);
    currentSessionId = id;
    return id;
  } catch {
    return null;
  }
}

export const sessionService = {
  saveAuthSession,
  updateUserSession,
  getToken,
  getUser,
  setHasSeenPermissions,
  getHasSeenPermissions,
  clearSession,
  setSessionId: (id: string | null) => {
    currentSessionId = id;
    if (id) {
      appStorage.setItem(SESSION_ID_KEY, id).catch(() => {});
    } else {
      appStorage.deleteItem(SESSION_ID_KEY).catch(() => {});
    }
  },
  getSessionId: () => currentSessionId,
  clearSessionId: () => {
    currentSessionId = null;
    appStorage.deleteItem(SESSION_ID_KEY).catch(() => {});
  },
  restoreSessionId,
};
