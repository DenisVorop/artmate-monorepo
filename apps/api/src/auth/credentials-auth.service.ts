import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";
import { isEmail } from "class-validator";

import {
  AuthProvider as PrismaAuthProvider,
  Prisma,
  UserRole as PrismaUserRole,
  UserStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";

import type { AuthPrincipal } from "./auth.types";

const SCRYPT_HASH_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;

type ScryptPasswordHash = {
  salt: string;
  hash: string;
};

type EnvCredentialConfig = {
  binding: string;
  passwordHash?: string;
  plainPassword?: string;
};

type RegisterCredentialsUserInput = {
  password: string;
  email: string;
  name?: string;
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

  async registerUser(input: RegisterCredentialsUserInput): Promise<AuthPrincipal> {
    const email = this.normalizeEmail(input.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    try {
      const account = await this.prisma.authAccount.create({
        data: {
          provider: PrismaAuthProvider.CREDENTIALS,
          providerUserId: email,
          providerEmail: email,
          user: {
            create: {
              email,
              emailVerifiedAt: null,
              name: this.getOptionalString(input.name),
              roles: this.usersService.getDefaultPrismaRoles(),
            },
          },
          credential: {
            create: {
              passwordHash: await this.createPasswordHash(input.password),
            },
          },
        },
        include: credentialsAccountInclude,
      });

      return this.mapStoredAccount(account);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("User already exists");
      }

      throw error;
    }
  }

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

      const isPasswordValid = await this.verifyScryptPassword(
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

  async getCredentialsUserById(userId: string): Promise<AuthPrincipal> {
    const account = await this.prisma.authAccount.findFirst({
      where: {
        userId,
        provider: PrismaAuthProvider.CREDENTIALS,
      },
      include: credentialsAccountInclude,
    });

    if (!account || account.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.mapStoredAccount(account);
  }

  getEnvCredentialBinding(email: string) {
    return this.getEnvCredentialConfig(email)?.binding;
  }

  async createPasswordHash(password: string) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await this.scrypt(password, salt);

    return `${SCRYPT_HASH_PREFIX}:${salt}:${hash}`;
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
      ? await this.verifyScryptPassword(password, config.passwordHash)
      : this.safeCompare(password, config.plainPassword ?? "");

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return {
      ...(await this.upsertEnvCredentialsUser(email)),
      envCredentialBinding: config.binding,
    };
  }

  private async upsertEnvCredentialsUser(email: string): Promise<AuthPrincipal> {
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
        return tx.authAccount.update({
          where: { id: existingAccount.id },
          data: {
            providerEmail: email,
            user: {
              update: this.getEnvUserUpdateData(email),
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
        return tx.authAccount.update({
          where: { id: existingUserCredentialsAccount.id },
          data: {
            providerEmail: email,
            providerUserId: email,
            user: {
              update: this.getEnvUserUpdateData(email),
            },
          },
          include: credentialsAccountInclude,
        });
      }

      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: this.getEnvUserUpdateData(email),
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

  private getEnvCredentialConfig(email: string): EnvCredentialConfig | undefined {
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
      this.parseScryptHash(passwordHash);
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

  private async verifyScryptPassword(password: string, passwordHash: string) {
    const parsedHash = this.parseScryptHash(passwordHash);
    const derivedHash = await this.scrypt(password, parsedHash.salt);

    return this.safeCompare(derivedHash, parsedHash.hash);
  }

  private parseScryptHash(passwordHash: string): ScryptPasswordHash {
    const parts = passwordHash.split(":");
    const [algorithm, salt, hash] = parts;

    if (
      parts.length !== 3 ||
      algorithm !== SCRYPT_HASH_PREFIX ||
      !salt ||
      !hash
    ) {
      throw new InternalServerErrorException(
        "AUTH_PASSWORD_HASH must use format scrypt:<salt>:<hash>",
      );
    }

    return { salt, hash };
  }

  private scrypt(password: string, salt: string) {
    return new Promise<string>((resolve, reject) => {
      crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, key) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(key.toString("hex"));
      });
    });
  }

  private safeCompare(actual: string, expected: string) {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
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

  private getEnvUserCreateData(email: string): Prisma.UserCreateWithoutAuthAccountsInput {
    return {
      email,
      emailVerifiedAt: new Date(),
      name: this.getOptionalEnv("AUTH_PASSWORD_NAME"),
      roles: this.getPrismaRoles(),
      status: UserStatus.ACTIVE,
    };
  }

  private getEnvUserUpdateData(email: string): Prisma.UserUpdateWithoutAuthAccountsInput {
    return {
      email,
      emailVerifiedAt: new Date(),
      name: this.getOptionalEnv("AUTH_PASSWORD_NAME"),
      roles: this.getPrismaRoles(),
      status: UserStatus.ACTIVE,
    };
  }

  private getPrismaRoles() {
    return this.getRoles().map((role) =>
      role === "admin" ? PrismaUserRole.ADMIN : PrismaUserRole.CUSTOMER,
    );
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getOptionalString(value?: string) {
    const normalizedValue = value?.trim();

    return normalizedValue ? normalizedValue : undefined;
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
