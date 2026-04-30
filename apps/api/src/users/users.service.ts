import { ForbiddenException, Injectable } from "@nestjs/common";

import { UserRole as PrismaUserRole } from "../generated/prisma/client";

import {
  defaultPrismaUserRoles,
  defaultUserRoles,
  isUserRole,
  type UserRole,
} from "./users.types";

type UserWithRoles = {
  roles: readonly UserRole[];
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  customer: "Customer",
};

@Injectable()
export class UsersService {
  getDefaultRoles(): UserRole[] {
    return [...defaultUserRoles];
  }

  getDefaultPrismaRoles(): PrismaUserRole[] {
    return [...defaultPrismaUserRoles];
  }

  mapPrismaRoles(roles: readonly PrismaUserRole[]): UserRole[] {
    const mappedRoles = roles.map((role) => this.mapPrismaRole(role));

    return mappedRoles.length > 0 ? mappedRoles : this.getDefaultRoles();
  }

  normalizeRoles(roles: readonly string[] | undefined): UserRole[] {
    const normalizedRoles =
      roles?.map((role) => role.trim().toLowerCase()).filter(isUserRole) ?? [];

    return normalizedRoles.length > 0 ? normalizedRoles : this.getDefaultRoles();
  }

  hasRole(user: UserWithRoles, role: UserRole) {
    return user.roles.includes(role);
  }

  assertRole(user: UserWithRoles, role: UserRole) {
    if (!this.hasRole(user, role)) {
      throw new ForbiddenException(`${roleLabels[role]} role required`);
    }
  }

  private mapPrismaRole(role: PrismaUserRole): UserRole {
    switch (role) {
      case PrismaUserRole.ADMIN:
        return "admin";
      case PrismaUserRole.CUSTOMER:
        return "customer";
    }
  }
}
