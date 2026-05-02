import { z } from "zod";

import type { AdminUserRole } from "@/entities/users";

export const adminUserRoleOptions = ["customer", "admin"] as const;

const adminUserRoleSchema = z.enum(adminUserRoleOptions);

export const userRolesFormSchema = z.object({
  roles: z.array(adminUserRoleSchema).min(1, "Выберите хотя бы одну роль"),
});

export const userAccountStatusFormSchema = z.object({
  status: z.enum(["active", "blocked"]),
});

export type UserRolesFormValues = z.infer<typeof userRolesFormSchema>;

export type UserAccountStatusFormValues = z.infer<typeof userAccountStatusFormSchema>;

export type UserRolesFormRole = AdminUserRole;
