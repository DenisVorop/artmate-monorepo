import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";
import { isEmail } from "class-validator";

import {
  AffiliatePartnerStatus,
  AuthProvider as PrismaAuthProvider,
  Prisma,
  UserRole as PrismaUserRole,
  UserStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";

import type { AuthPrincipal } from "./auth.types";
import { PasswordHasher } from "./password-hasher";

type EnvCredentialConfig = {
  binding: string;
  passwordHash?: string;
  plainPassword?: string;
};

const credentialsAccountInclude = {
  user: true,
} as const;

type StoredCredentialsAccount = Prisma.AuthAccountGetPayload<{
  include: typeof credentialsAccountInclude;
}>;

@Injectable()
export class CredentialsAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async validateUser(email: string, password: string): Promise<AuthPrincipal> {
    const normalizedEmail = this.normalizeEmail(email);
    const account = await this.prisma.authAccount.findFirst({
      where: {
        provider: PrismaAuthProvider.CREDENTIALS,
        user: {
          email: normalizedEmail,
        },
      },
      include: {
        credential: true,
        user: true,
      },
    });

    if (account?.credential) {
      if (account.user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException("Invalid email or password");
      }

      const isPasswordValid = await PasswordHasher.verify(
        password,
        account.credential.passwordHash,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException("Invalid email or password");
      }

      if (!account.user.emailVerifiedAt) {
        throw new UnauthorizedException("Email is not verified");
      }

      return this.mapStoredAccount(account);
    }

    return this.validateEnvUser(normalizedEmail, password);
  }

  getEnvCredentialBinding(email: string) {
    return this.getEnvCredentialConfig(email)?.binding;
  }

  /** Verify existing environment credentials without provisioning or mutating a User. */
  public async validateFlowEnvPassword(
    email: string,
    password: string,
  ): Promise<string | null> {
    const config = this.getEnvCredentialConfig(this.normalizeEmail(email));
    if (!config) return null;
    const valid = config.passwordHash
      ? await PasswordHasher.verify(password, config.passwordHash)
      : PasswordHasher.equal(password, config.plainPassword ?? "");
    return valid ? config.binding : null;
  }

  async createPasswordHash(password: string) {
    return PasswordHasher.create(password);
  }

  private async validateEnvUser(
    email: string,
    password: string,
  ): Promise<AuthPrincipal> {
    const config = this.getEnvCredentialConfig(email);

    if (!config) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = config.passwordHash
      ? await PasswordHasher.verify(password, config.passwordHash)
      : PasswordHasher.equal(password, config.plainPassword ?? "");

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return {
      ...(await this.upsertEnvCredentialsUser(email)),
      envCredentialBinding: config.binding,
    };
  }

  private async upsertEnvCredentialsUser(
    email: string,
  ): Promise<AuthPrincipal> {
    const account = await this.prisma.$transaction(async (tx) => {
      const existingAccount = await tx.authAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: PrismaAuthProvider.CREDENTIALS,
            providerUserId: email,
          },
        },
        include: credentialsAccountInclude,
      });

      if (existingAccount) {
        const userUpdate = await this.getEnvUserUpdateData(
          tx,
          existingAccount.user.id,
          email,
        );

        return tx.authAccount.update({
          where: { id: existingAccount.id },
          data: {
            providerEmail: email,
            user: {
              update: userUpdate,
            },
          },
          include: credentialsAccountInclude,
        });
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });
      const existingUserCredentialsAccount = existingUser
        ? await tx.authAccount.findUnique({
            where: {
              userId_provider: {
                provider: PrismaAuthProvider.CREDENTIALS,
                userId: existingUser.id,
              },
            },
            include: credentialsAccountInclude,
          })
        : null;

      if (existingUserCredentialsAccount) {
        const userUpdate = await this.getEnvUserUpdateData(
          tx,
          existingUserCredentialsAccount.user.id,
          email,
        );

        return tx.authAccount.update({
          where: { id: existingUserCredentialsAccount.id },
          data: {
            providerEmail: email,
            providerUserId: email,
            user: {
              update: userUpdate,
            },
          },
          include: credentialsAccountInclude,
        });
      }

      if (existingUser) {
        const userUpdate = await this.getEnvUserUpdateData(
          tx,
          existingUser.id,
          email,
        );

        await tx.user.update({
          where: { id: existingUser.id },
          data: userUpdate,
        });
      }

      return tx.authAccount.create({
        data: {
          provider: PrismaAuthProvider.CREDENTIALS,
          providerEmail: email,
          providerUserId: email,
          user: existingUser
            ? {
                connect: { id: existingUser.id },
              }
            : {
                create: this.getEnvUserCreateData(email),
              },
        },
        include: credentialsAccountInclude,
      });
    });

    return this.mapStoredAccount(account);
  }

  private getEnvCredentialConfig(
    email: string,
  ): EnvCredentialConfig | undefined {
    const envEmail = this.getOptionalEnv("AUTH_PASSWORD_EMAIL");

    if (!envEmail) {
      return undefined;
    }

    const expectedEmail = this.normalizeEmail(envEmail);

    if (!isEmail(expectedEmail)) {
      throw new InternalServerErrorException("AUTH_PASSWORD_EMAIL is invalid");
    }

    if (this.normalizeEmail(email) !== expectedEmail) {
      return undefined;
    }

    const passwordHash = this.getOptionalEnv("AUTH_PASSWORD_HASH");

    if (passwordHash) {
      PasswordHasher.assertValid(passwordHash);
      return {
        binding: this.createEnvCredentialBinding(
          "hash",
          expectedEmail,
          passwordHash,
        ),
        passwordHash,
      };
    }

    if (process.env.NODE_ENV === "production") {
      throw new InternalServerErrorException(
        "AUTH_PASSWORD_HASH is required in production",
      );
    }

    const plainPassword = this.getRequiredEnv("AUTH_PASSWORD");
    return {
      binding: this.createEnvCredentialBinding(
        "plain",
        expectedEmail,
        plainPassword,
      ),
      plainPassword,
    };
  }

  private createEnvCredentialBinding(
    source: "hash" | "plain",
    email: string,
    credential: string,
  ) {
    return crypto
      .createHmac("sha256", this.getRequiredEnv("AUTH_JWT_SECRET"))
      .update(JSON.stringify(["env-credentials-v1", source, email, credential]))
      .digest("hex");
  }

  private mapStoredAccount(account: StoredCredentialsAccount): AuthPrincipal {
    return {
      id: account.user.id,
      provider: "credentials",
      providerUserId: account.providerUserId,
      email: account.user.email ?? account.providerEmail ?? undefined,
      name: account.user.name ?? undefined,
      phone: account.user.phone ?? undefined,
      image: account.user.image ?? undefined,
      roles: this.usersService.mapPrismaRoles(account.user.roles),
      authVersion: account.user.authVersion,
    };
  }

  private getEnvUserCreateData(
    email: string,
  ): Prisma.UserCreateWithoutAuthAccountsInput {
    return {
      email,
      emailVerifiedAt: new Date(),
      name: this.getOptionalEnv("AUTH_PASSWORD_NAME"),
      roles: this.getEnvPrismaRoles(false),
      status: UserStatus.ACTIVE,
    };
  }

  private async getEnvUserUpdateData(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
  ): Promise<Prisma.UserUpdateWithoutAuthAccountsInput> {
    const [lockedUser] = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`,
    );

    if (!lockedUser) {
      throw new InternalServerErrorException("Credentials user not found");
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        affiliatePartner: { select: { status: true } },
      },
    });

    if (!user) {
      throw new InternalServerErrorException("Credentials user not found");
    }

    return {
      email,
      emailVerifiedAt: new Date(),
      name: this.getOptionalEnv("AUTH_PASSWORD_NAME"),
      roles: this.getEnvPrismaRoles(
        user.affiliatePartner?.status === AffiliatePartnerStatus.ACTIVE,
      ),
      status: UserStatus.ACTIVE,
    };
  }

  private getEnvPrismaRoles(hasActivePartnerProfile: boolean) {
    const roles: PrismaUserRole[] = this.getPrismaRoles().filter(
      (role) => role !== PrismaUserRole.PARTNER,
    );

    if (hasActivePartnerProfile) {
      roles.push(PrismaUserRole.PARTNER);
    }

    return roles.length > 0 ? roles : this.usersService.getDefaultPrismaRoles();
  }

  private getPrismaRoles() {
    return this.getRoles().map((role) => {
      switch (role) {
        case "admin":
          return PrismaUserRole.ADMIN;
        case "customer":
          return PrismaUserRole.CUSTOMER;
        case "partner":
          return PrismaUserRole.PARTNER;
      }
    });
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getRoles() {
    const roles = this.getOptionalEnv("AUTH_PASSWORD_ROLES");

    if (!roles) {
      return this.usersService.getDefaultRoles();
    }

    return this.usersService.normalizeRoles(roles.split(","));
  }

  private getOptionalEnv(name: string) {
    const value = process.env[name];

    return value && value.length > 0 ? value : undefined;
  }

  private getRequiredEnv(name: string) {
    const value = this.getOptionalEnv(name);

    if (!value) {
      throw new InternalServerErrorException(`${name} is not configured`);
    }

    return value;
  }
}
