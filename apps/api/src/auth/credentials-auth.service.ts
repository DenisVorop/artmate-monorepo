import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import crypto from "node:crypto";

import {
  AuthProvider as PrismaAuthProvider,
  Prisma,
  UserStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import type { AuthUser } from "./auth.types";

const SCRYPT_HASH_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;

type ScryptPasswordHash = {
  salt: string;
  hash: string;
};

type RegisterCredentialsUserInput = {
  login: string;
  password: string;
  email?: string;
  name?: string;
};

const credentialsUserInclude = {
  account: {
    include: {
      user: true,
    },
  },
} as const;

const credentialsAccountInclude = {
  user: true,
} as const;

type StoredCredentialsUser = Prisma.AuthCredentialGetPayload<{
  include: typeof credentialsUserInclude;
}>;

type StoredCredentialsAccount = Prisma.AuthAccountGetPayload<{
  include: typeof credentialsAccountInclude;
}>;

@Injectable()
export class CredentialsAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async registerUser(input: RegisterCredentialsUserInput): Promise<AuthUser> {
    const login = this.normalizeLogin(input.login);
    const email = this.getOptionalString(input.email);
    const existingCredential = await this.prisma.authCredential.findUnique({
      where: { login },
    });

    if (existingCredential) {
      throw new ConflictException("User already exists");
    }

    if (email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException("User already exists");
      }
    }

    try {
      const account = await this.prisma.authAccount.create({
        data: {
          provider: PrismaAuthProvider.CREDENTIALS,
          providerUserId: login,
          providerEmail: email,
          user: {
            create: {
              email,
              name: this.getOptionalString(input.name) ?? login,
              roles: ["customer"],
            },
          },
          credential: {
            create: {
              login,
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

  async validateUser(login: string, password: string): Promise<AuthUser> {
    const normalizedLogin = this.normalizeLogin(login);
    const user = await this.prisma.authCredential.findUnique({
      where: { login: normalizedLogin },
      include: credentialsUserInclude,
    });

    if (user) {
      if (user.account.user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException("Invalid login or password");
      }

      const isPasswordValid = await this.verifyScryptPassword(
        password,
        user.passwordHash,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException("Invalid login or password");
      }

      return this.mapStoredUser(user);
    }

    return this.validateEnvUser(normalizedLogin, password);
  }

  private async validateEnvUser(
    login: string,
    password: string,
  ): Promise<AuthUser> {
    const envLogin = this.getOptionalEnv("AUTH_PASSWORD_LOGIN");

    if (!envLogin) {
      throw new UnauthorizedException("Invalid login or password");
    }

    const expectedLogin = this.normalizeLogin(envLogin);

    if (login !== expectedLogin) {
      throw new UnauthorizedException("Invalid login or password");
    }

    const isPasswordValid = await this.verifyEnvPassword(password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid login or password");
    }

    return {
      id: `credentials:${expectedLogin}`,
      provider: "credentials",
      providerUserId: expectedLogin,
      email: this.getOptionalEnv("AUTH_PASSWORD_EMAIL"),
      name: this.getOptionalEnv("AUTH_PASSWORD_NAME") ?? expectedLogin,
      roles: this.getRoles(),
    };
  }

  private async verifyEnvPassword(password: string) {
    const passwordHash = this.getOptionalEnv("AUTH_PASSWORD_HASH");

    if (passwordHash) {
      return this.verifyScryptPassword(password, passwordHash);
    }

    if (process.env.NODE_ENV === "production") {
      throw new InternalServerErrorException(
        "AUTH_PASSWORD_HASH is required in production",
      );
    }

    const plainPassword = this.getRequiredEnv("AUTH_PASSWORD");

    return this.safeCompare(password, plainPassword);
  }

  private async createPasswordHash(password: string) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await this.scrypt(password, salt);

    return `${SCRYPT_HASH_PREFIX}:${salt}:${hash}`;
  }

  private async verifyScryptPassword(password: string, passwordHash: string) {
    const parsedHash = this.parseScryptHash(passwordHash);
    const derivedHash = await this.scrypt(password, parsedHash.salt);

    return this.safeCompare(derivedHash, parsedHash.hash);
  }

  private parseScryptHash(passwordHash: string): ScryptPasswordHash {
    const [algorithm, salt, hash] = passwordHash.split(":");

    if (algorithm !== SCRYPT_HASH_PREFIX || !salt || !hash) {
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

  private mapStoredUser(user: StoredCredentialsUser): AuthUser {
    return this.mapStoredAccount(user.account);
  }

  private mapStoredAccount(account: StoredCredentialsAccount): AuthUser {
    return {
      id: account.user.id,
      provider: "credentials",
      providerUserId: account.providerUserId,
      email: account.user.email ?? account.providerEmail ?? undefined,
      name: account.user.name ?? undefined,
      image: account.user.image ?? undefined,
      roles: account.user.roles,
    };
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private normalizeLogin(login: string) {
    return login.trim().toLowerCase();
  }

  private getOptionalString(value?: string) {
    const normalizedValue = value?.trim();

    return normalizedValue ? normalizedValue : undefined;
  }

  private getRoles() {
    const roles = this.getOptionalEnv("AUTH_PASSWORD_ROLES");

    if (!roles) {
      return ["customer"];
    }

    return roles
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
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
