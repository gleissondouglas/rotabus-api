export type LoginRequest = {
  email: string;
  password: string;
};

export type CreateAccountRequest = {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

export type AuthResponse = {
  message: string;
  token: string;
  user: AuthUser;
};
