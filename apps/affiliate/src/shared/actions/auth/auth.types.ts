export type AuthUserDTO = {
  id: string;
  provider: "credentials" | "yandex";
  providerUserId: string;
  email?: string;
  name?: string;
  image?: string;
  roles: string[];
};

export type AuthSessionDTO = { user: AuthUserDTO | null };
export type LoginInputDTO = { email: string; password: string };
export type LogoutDTO = { ok: true };
