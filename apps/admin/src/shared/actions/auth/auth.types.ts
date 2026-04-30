export type AuthProvider = "credentials" | "yandex";

export type UserRole = "customer" | "admin";

export type AuthUserDTO = {
  id: string;
  provider: AuthProvider;
  providerUserId: string;
  email?: string;
  name?: string;
  image?: string;
  roles: UserRole[];
};

export type AuthSessionDTO = {
  user: AuthUserDTO | null;
};

export type LoginInputDTO = {
  login: string;
  password: string;
};

export type LogoutDTO = {
  ok: true;
};
