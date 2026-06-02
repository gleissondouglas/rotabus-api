import { API_BASE_URL } from "../config/api.config";
import {
  AuthResponse,
  CreateAccountRequest,
  LoginRequest,
} from "../types/auth.types";
import { request } from "../utils/api";

async function login(data: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: data.email,
      password: data.password,
    }),
  });
}

async function createAccount(data: CreateAccountRequest): Promise<AuthResponse> {
  const result = await request<AuthResponse>(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
    }),
  });

  // Após criar a conta, fazemos login automático para uma experiência fluida
  return login({ email: data.email, password: data.password });
}

export const authService = {
  login,
  createAccount,
};
