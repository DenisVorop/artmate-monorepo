export type AuthProvider = "credentials" | "yandex";

export type AuthOAuthProvider = Extract<AuthProvider, "yandex">;

export type AuthUserDTO = {
  id: string;
  provider: AuthProvider;
  providerUserId: string;
  email?: string;
  name?: string;
  phone?: string;
  image?: string;
  roles: string[];
};

export type AuthSessionDTO = {
  user: AuthUserDTO | null;
};

export type AuthProvidersDTO = {
  providers: AuthOAuthProvider[];
};

export type LogoutDTO = {
  ok: true;
};

export type AuthTelegramAccountDTO = {
  phone: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  linkedAt: string;
};

export type AuthTelegramLinkStatusDTO = {
  linked: boolean;
  botUrl?: string;
  account?: AuthTelegramAccountDTO;
};

export type ConfirmTelegramLinkInputDTO = {
  code: string;
};

export type AuthTelegramLinkResponseDTO = {
  linked: true;
  account: AuthTelegramAccountDTO;
};
