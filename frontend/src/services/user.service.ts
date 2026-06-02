import { API_BASE_URL } from "../config/api.config";
import { AuthUser } from "../types/auth.types";
import { sessionService } from "./session.service";
import { request } from "../utils/api";

const DEFAULT_TIMEOUT = 10000; // 10 segundos

async function updateProfile(name: string): Promise<{ message: string; user: AuthUser }> {
  const token = await sessionService.getToken();

  const result = await request<{ message: string; user: AuthUser }>(`${API_BASE_URL}/users/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
    timeout: DEFAULT_TIMEOUT,
  });

  // Atualiza o usuário na sessão local
  await sessionService.updateUserSession(result.user);

  return result;
}

async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const token = await sessionService.getToken();

  return request<{ message: string }>(`${API_BASE_URL}/users/me/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
    timeout: DEFAULT_TIMEOUT,
  });
}

/**
 * Exclui a conta do próprio usuário autenticado.
 */
async function deleteOwnAccount(): Promise<{ message: string }> {
  const token = await sessionService.getToken();

  if (!token) {
    throw new Error("Usuário não autenticado.");
  }

  return request<{ message: string }>(`${API_BASE_URL}/users/me`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    timeout: DEFAULT_TIMEOUT,
  });
}

export const userService = {
  updateProfile,
  changePassword,
  deleteOwnAccount,
};
