import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import crypto from "node:crypto";

import { AuthLoginThrottleScope } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

import {
  AUTH_LOGIN_IP_MAX_FAILED_ATTEMPTS,
  AUTH_LOGIN_LOCKOUT_MS,
  AUTH_LOGIN_MAX_FAILED_ATTEMPTS,
  AUTH_LOGIN_THROTTLE_WINDOW_MS,
} from "./auth.constants";

type LoginThrottleInput = {
  login: string;
  ipAddress?: string;
};

type LoginThrottleSubject = {
  scope: AuthLoginThrottleScope;
  subjectHash: string;
  maxFailedAttempts: number;
};

type LockedRecord = {
  lockedUntil: Date | null;
};

@Injectable()
export class LoginThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  async assertLoginAllowed(input: LoginThrottleInput) {
    const now = new Date();
    const subjects = this.getSubjects(input);
    const records = await this.prisma.authLoginThrottle.findMany({
      where: {
        OR: subjects.map((subject) => ({
          scope: subject.scope,
          subjectHash: subject.subjectHash,
        })),
      },
    });

    const retryAfterSeconds = this.getRetryAfterSeconds(records, now);

    if (retryAfterSeconds) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many login attempts. Try again later",
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailedLogin(input: LoginThrottleInput) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - AUTH_LOGIN_THROTTLE_WINDOW_MS);
    const subjects = this.getSubjects(input);

    await this.prisma.$transaction(async (transaction) => {
      for (const subject of subjects) {
        const existingRecord = await transaction.authLoginThrottle.findUnique({
          where: {
            scope_subjectHash: {
              scope: subject.scope,
              subjectHash: subject.subjectHash,
            },
          },
        });
        const isInsideWindow =
          existingRecord && existingRecord.firstFailedAt > windowStart;
        const failedAttempts = isInsideWindow
          ? existingRecord.failedAttempts + 1
          : 1;
        const lockedUntil =
          failedAttempts >= subject.maxFailedAttempts
            ? new Date(now.getTime() + AUTH_LOGIN_LOCKOUT_MS)
            : null;

        if (existingRecord) {
          await transaction.authLoginThrottle.update({
            where: {
              scope_subjectHash: {
                scope: subject.scope,
                subjectHash: subject.subjectHash,
              },
            },
            data: {
              failedAttempts,
              firstFailedAt: isInsideWindow
                ? existingRecord.firstFailedAt
                : now,
              lastFailedAt: now,
              lockedUntil,
            },
          });

          continue;
        }

        await transaction.authLoginThrottle.create({
          data: {
            scope: subject.scope,
            subjectHash: subject.subjectHash,
            failedAttempts,
            firstFailedAt: now,
            lastFailedAt: now,
            lockedUntil,
          },
        });
      }
    });
  }

  async recordSuccessfulLogin(input: LoginThrottleInput) {
    const loginSubject = this.getLoginSubject(input.login);

    await this.prisma.authLoginThrottle.deleteMany({
      where: {
        scope: loginSubject.scope,
        subjectHash: loginSubject.subjectHash,
      },
    });
  }

  private getSubjects(input: LoginThrottleInput): LoginThrottleSubject[] {
    const subjects = [this.getLoginSubject(input.login)];
    const ipAddress = this.normalizeIpAddress(input.ipAddress);

    if (ipAddress) {
      subjects.push({
        scope: AuthLoginThrottleScope.IP,
        subjectHash: this.hashSubject(`ip:${ipAddress}`),
        maxFailedAttempts: AUTH_LOGIN_IP_MAX_FAILED_ATTEMPTS,
      });
    }

    return subjects;
  }

  private getLoginSubject(login: string): LoginThrottleSubject {
    return {
      scope: AuthLoginThrottleScope.LOGIN,
      subjectHash: this.hashSubject(`login:${this.normalizeLogin(login)}`),
      maxFailedAttempts: AUTH_LOGIN_MAX_FAILED_ATTEMPTS,
    };
  }

  private normalizeLogin(login: string) {
    return login.trim().toLowerCase();
  }

  private normalizeIpAddress(ipAddress?: string) {
    return ipAddress?.trim() || undefined;
  }

  private getRetryAfterSeconds(records: LockedRecord[], now: Date) {
    const lockedUntil = records.reduce<Date | undefined>((latest, record) => {
      if (!record.lockedUntil || record.lockedUntil <= now) {
        return latest;
      }

      if (!latest || record.lockedUntil > latest) {
        return record.lockedUntil;
      }

      return latest;
    }, undefined);

    if (!lockedUntil) {
      return undefined;
    }

    return Math.max(
      1,
      Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000),
    );
  }

  private hashSubject(subject: string) {
    return crypto.createHash("sha256").update(subject).digest("hex");
  }
}
