import crypto from "node:crypto";
import { isIP } from "node:net";

import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

import {
  partnerApplicationEmailRateLimit,
  partnerApplicationIpRateLimit,
  partnerApplicationRateLimitWindowMs,
} from "./partner-applications.constants";

const maxTrackedSubjects = 10_000;

type PartnerApplicationIdentity = {
  email: string;
  forwardedFor?: string;
  realIp?: string;
  requestIp?: string;
};

type ThrottleSubject = {
  key: string;
  limit: number;
};

type ThrottleBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class PartnerApplicationsThrottleService {
  private readonly buckets = new Map<string, ThrottleBucket>();
  private nextCleanupAt = 0;

  assertAllowed(identity: PartnerApplicationIdentity) {
    const now = Date.now();
    const subjects = this.getSubjects(identity);

    this.cleanupExpiredBuckets(now);

    for (const subject of subjects) {
      const bucket = this.buckets.get(subject.key);

      if (bucket && bucket.resetAt > now && bucket.count >= subject.limit) {
        this.throwTooManyRequests(bucket.resetAt, now);
      }
    }

    const newSubjects = subjects.filter(
      (subject) => !this.buckets.has(subject.key),
    ).length;

    if (this.buckets.size + newSubjects > maxTrackedSubjects) {
      this.throwTooManyRequests(now + partnerApplicationRateLimitWindowMs, now);
    }

    for (const subject of subjects) {
      const bucket = this.buckets.get(subject.key);

      if (!bucket || bucket.resetAt <= now) {
        this.buckets.set(subject.key, {
          count: 1,
          resetAt: now + partnerApplicationRateLimitWindowMs,
        });
      } else {
        bucket.count += 1;
      }
    }
  }

  private getSubjects(identity: PartnerApplicationIdentity): ThrottleSubject[] {
    const ip = this.getClientIp(identity);
    const email = identity.email.trim().toLowerCase();
    const subjects: ThrottleSubject[] = [
      {
        key: this.hashSubject(`email:${email}`),
        limit: partnerApplicationEmailRateLimit,
      },
    ];

    if (ip) {
      subjects.push({
        key: this.hashSubject(`ip:${ip}`),
        limit: partnerApplicationIpRateLimit,
      });
    }

    return subjects;
  }

  private getClientIp(identity: PartnerApplicationIdentity) {
    const directIp = this.normalizeIp(identity.requestIp);

    if (directIp && !this.isTrustedProxy(directIp)) {
      return directIp;
    }

    return (
      this.normalizeIp(identity.realIp) ??
      identity.forwardedFor
        ?.split(",")
        .reverse()
        .map((value) => this.normalizeIp(value))
        .find((value): value is string => Boolean(value)) ??
      directIp
    );
  }

  private normalizeIp(value?: string) {
    const trimmed = value?.trim();

    if (!trimmed || trimmed.includes("\n") || trimmed.includes("\r")) {
      return undefined;
    }

    const normalized = trimmed.startsWith("::ffff:")
      ? trimmed.slice("::ffff:".length)
      : trimmed;

    return isIP(normalized) ? normalized : undefined;
  }

  private isTrustedProxy(ip: string) {
    const normalized = ip.toLowerCase();

    return (
      normalized === "::1" ||
      normalized === "127.0.0.1" ||
      normalized.startsWith("10.") ||
      normalized.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  private cleanupExpiredBuckets(now: number) {
    if (now < this.nextCleanupAt && this.buckets.size < maxTrackedSubjects) {
      return;
    }

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }

    this.nextCleanupAt = now + partnerApplicationRateLimitWindowMs;
  }

  private hashSubject(subject: string) {
    return crypto.createHash("sha256").update(subject).digest("hex");
  }

  private throwTooManyRequests(resetAt: number, now: number): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: "Слишком много заявок. Попробуйте позже",
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
