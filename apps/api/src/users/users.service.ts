import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  AuthProvider as PrismaAuthProvider,
  Prisma,
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/auth.types";

import {
  defaultPrismaUserRoles,
  defaultUserRoles,
  isUserRole,
  type ManageableUserStatus,
  type UserRole,
  type UserStatus,
} from "./users.types";

type UserWithRoles = {
  roles: readonly UserRole[];
};

const adminUserInclude = {
  authAccounts: {
    orderBy: {
      connectedAt: "asc",
    },
  },
} as const;

type StoredAdminUser = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  customer: "Customer",
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return normalizedRoles.length > 0
      ? normalizedRoles
      : this.getDefaultRoles();
  }

  hasRole(user: UserWithRoles, role: UserRole) {
    return user.roles.includes(role);
  }

  assertRole(user: UserWithRoles, role: UserRole) {
    if (!this.hasRole(user, role)) {
      throw new ForbiddenException(`${roleLabels[role]} role required`);
    }
  }

  async getAdminUsers() {
    const users = await this.prisma.user.findMany({
      include: adminUserInclude,
      orderBy: {
        createdAt: "desc",
      },
    });

    return users.map((user) => this.mapAdminUser(user));
  }

  async updateAdminUserRoles(
    userId: string,
    roles: readonly UserRole[],
    actor: AuthUser,
  ) {
    const normalizedRoles = this.normalizeRolesForUpdate(roles);

    if (actor.id === userId && !normalizedRoles.includes("admin")) {
      throw new BadRequestException("Current admin role cannot be removed");
    }

    return this.updateAdminUser(userId, {
      roles: normalizedRoles.map((role) => this.mapUserRole(role)),
    });
  }

  async updateAdminUserStatus(
    userId: string,
    status: ManageableUserStatus,
    actor: AuthUser,
  ) {
    if (actor.id === userId && status !== "active") {
      throw new BadRequestException("Current admin account cannot be blocked");
    }

    return this.updateAdminUser(userId, {
      status: this.mapUserStatus(status),
    });
  }

  private mapPrismaRole(role: PrismaUserRole): UserRole {
    switch (role) {
      case PrismaUserRole.ADMIN:
        return "admin";
      case PrismaUserRole.CUSTOMER:
        return "customer";
    }
  }

  private async updateAdminUser(userId: string, data: Prisma.UserUpdateInput) {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
        include: adminUserInclude,
      });

      return this.mapAdminUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("User not found");
      }

      throw error;
    }
  }

  private normalizeRolesForUpdate(roles: readonly UserRole[]) {
    const normalizedRoles = Array.from(
      new Set(
        roles.map((role) => role.trim().toLowerCase()).filter(isUserRole),
      ),
    );

    if (normalizedRoles.length === 0) {
      throw new BadRequestException("At least one valid role is required");
    }

    return normalizedRoles;
  }

  private mapUserRole(role: UserRole): PrismaUserRole {
    switch (role) {
      case "admin":
        return PrismaUserRole.ADMIN;
      case "customer":
        return PrismaUserRole.CUSTOMER;
    }
  }

  private mapUserStatus(status: ManageableUserStatus): PrismaUserStatus {
    switch (status) {
      case "active":
        return PrismaUserStatus.ACTIVE;
      case "blocked":
        return PrismaUserStatus.BLOCKED;
    }
  }

  private mapPrismaStatus(status: PrismaUserStatus): UserStatus {
    switch (status) {
      case PrismaUserStatus.ACTIVE:
        return "active";
      case PrismaUserStatus.BLOCKED:
        return "blocked";
      case PrismaUserStatus.DELETED:
        return "deleted";
    }
  }

  private mapPrismaAuthProvider(
    provider: PrismaAuthProvider,
  ): "credentials" | "yandex" {
    switch (provider) {
      case PrismaAuthProvider.CREDENTIALS:
        return "credentials";
      case PrismaAuthProvider.YANDEX:
        return "yandex";
    }
  }

  private mapAdminUser(user: StoredAdminUser) {
    return {
      id: user.id,
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      image: user.image ?? undefined,
      roles: this.mapPrismaRoles(user.roles),
      status: this.mapPrismaStatus(user.status),
      authAccounts: user.authAccounts.map((account) => ({
        provider: this.mapPrismaAuthProvider(account.provider),
        providerUserId: account.providerUserId,
        providerEmail: account.providerEmail ?? undefined,
        connectedAt: account.connectedAt.toISOString(),
        lastLoginAt: account.lastLoginAt?.toISOString(),
      })),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
