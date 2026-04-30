import { UserRole as PrismaUserRole } from "../generated/prisma/client";

export const userRoles = ["customer", "admin"] as const;

export type UserRole = (typeof userRoles)[number];

export const defaultUserRoles: readonly UserRole[] = ["customer"];

export const defaultPrismaUserRoles: readonly PrismaUserRole[] = [
  PrismaUserRole.CUSTOMER,
];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}
