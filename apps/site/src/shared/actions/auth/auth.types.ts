export type AuthProvider = "credentials" | "yandex";

export type AuthOAuthProvider = Extract<AuthProvider, "yandex">;

export type AuthUserDTO = {
  id: string;
  provider: AuthProvider;
  providerUserId: string;
  email?: string;
  name?: string;
  image?: string;
  roles: string[];
};

export type AuthSessionDTO = {
  user: AuthUserDTO | null;
};

export type AuthEmailVerificationStateDTO = {
  login: string;
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
  login: string;
  password: string;
};

export type RegisterInputDTO = {
  login: string;
  password: string;
  name?: string;
  email: string;
};

export type ConfirmEmailVerificationInputDTO = {
  login: string;
  code: string;
};

export type ResendEmailVerificationInputDTO = {
  login: string;
};

export type LogoutDTO = {
  ok: true;
};
