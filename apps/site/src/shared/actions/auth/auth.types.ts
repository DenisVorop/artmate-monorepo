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

export type AuthEmailVerificationStateDTO = {
  email: string;
  emailMasked?: string;
  expiresAt?: string;
  resendAvailableAt: string;
};

export type AuthEmailVerificationResponseDTO = {
  status: "verification_required";
  verification: AuthEmailVerificationStateDTO;
};

export type AuthProvidersDTO = {
  providers: AuthOAuthProvider[];
};

export type LoginInputDTO = {
  email: string;
  password: string;
};

export type RegisterInputDTO = {
  password: string;
  name?: string;
  email: string;
};

export type ConfirmEmailVerificationInputDTO = {
  email: string;
  code: string;
};

export type ResendEmailVerificationInputDTO = {
  email: string;
};

export type RequestPasswordResetInputDTO = {
  email: string;
};

export type ConfirmPasswordResetInputDTO = {
  token: string;
  password: string;
};

export type PasswordResetDTO = {
  ok: true;
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
