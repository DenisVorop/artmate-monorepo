import type { AdminUser, AdminUserRole, UserAccountStatus } from "../model";

const roleLabels: Record<AdminUserRole, string> = {
  admin: "Админ",
  customer: "Клиент",
};

const statusLabels: Record<UserAccountStatus, string> = {
  active: "Активен",
  blocked: "Заблокирован",
  deleted: "Удален",
};

const providerLabels: Record<
  AdminUser["authAccounts"][number]["provider"],
  string
> = {
  credentials: "Email/пароль",
  yandex: "Yandex",
};

export function getAdminUserDisplayName(user: AdminUser) {
  if (user.name) {
    return user.name;
  }

  return (
    getCredentialsProviderUserId(user) ??
    user.email ??
    getPrimaryProviderUserId(user) ??
    user.id
  );
}

export function getAdminUserContact(user: AdminUser) {
  return (
    user.email ??
    user.authAccounts.find((account) => account.providerEmail)?.providerEmail
  );
}

export function getAdminUserRoleLabel(role: AdminUserRole) {
  return roleLabels[role];
}

export function getAdminUserStatusLabel(status: UserAccountStatus) {
  return statusLabels[status];
}

export function getAdminUserProviderLabels(user: AdminUser) {
  return user.authAccounts.map((account) => providerLabels[account.provider]);
}

function getPrimaryProviderUserId(user: AdminUser) {
  return user.authAccounts[0]?.providerUserId;
}

function getCredentialsProviderUserId(user: AdminUser) {
  return user.authAccounts.find((account) => account.provider === "credentials")
    ?.providerUserId;
}
