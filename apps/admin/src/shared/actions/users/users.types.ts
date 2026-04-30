export type AuthProvider = "credentials" | "yandex";

export type UserRole = "customer" | "admin";

export type AdminUserStatus = "active" | "blocked" | "deleted";

export type AdminUserAuthAccountDTO = {
  provider: AuthProvider;
  providerUserId: string;
  providerEmail?: string;
  connectedAt: string;
  lastLoginAt?: string;
};

export type AdminUserDTO = {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  roles: UserRole[];
  status: AdminUserStatus;
  authAccounts: AdminUserAuthAccountDTO[];
  createdAt: string;
  updatedAt: string;
};

export type UpdateAdminUserRolesInputDTO = {
  roles: UserRole[];
};

export type UpdateAdminUserStatusInputDTO = {
  status: Extract<AdminUserStatus, "active" | "blocked">;
};
