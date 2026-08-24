import crypto from "node:crypto";
import { isIP } from "node:net";

import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

import {
  ozonProxyIpMaxRequests,
  ozonProxySessionMaxRequests,
  ozonProxyThrottleWindowMs,
} from "./delivery.constants";

const cartCookieName = "cart_id";
const maxTrackedSubjects = 10_000;

type DeliveryProxyIdentity = {
  cookieHeader?: string;
  forwardedFor?: string;
  realIp?: string;
  requestIp?: string;
};

type ThrottleBucket = {
  count: number;
  resetAt: number;
};

type ThrottleSubject = {
  key: string;
  limit: number;
};

@Injectable()
export class DeliveryProxyThrottleService {
  private readonly buckets = new Map<string, ThrottleBucket>();
  private nextCleanupAt = 0;

  assertAllowed(identity: DeliveryProxyIdentity) {
    const now = Date.now();
    const subjects = this.getSubjects(identity);

    this.cleanupExpiredBuckets(now);

    for (const subject of subjects) {
      const bucket = this.buckets.get(subject.key);

      if (bucket && bucket.resetAt > now && bucket.count >= subject.limit) {
        this.throwTooManyRequests(bucket.resetAt, now);
      }
    }

    const newSubjectCount = subjects.filter(
      (subject) => !this.buckets.has(subject.key),
    ).length;

    if (this.buckets.size + newSubjectCount > maxTrackedSubjects) {
      this.throwTooManyRequests(now + ozonProxyThrottleWindowMs, now);
    }

    for (const subject of subjects) {
      const bucket = this.buckets.get(subject.key);

      if (!bucket || bucket.resetAt <= now) {
        this.buckets.set(subject.key, {
          count: 1,
          resetAt: now + ozonProxyThrottleWindowMs,
        });
        continue;
      }

      bucket.count += 1;
    }
  }

  private getSubjects(identity: DeliveryProxyIdentity): ThrottleSubject[] {
    const ipAddress = this.getClientIp(identity);
    const sessionId = this.getCartId(identity.cookieHeader);
    const subjects: ThrottleSubject[] = [];

    if (ipAddress) {
      subjects.push({
        key: this.hashSubject(`ip:${ipAddress}`),
        limit: ozonProxyIpMaxRequests,
      });
    }

    if (sessionId) {
      subjects.push({
        key: this.hashSubject(`session:${sessionId}`),
        limit: ozonProxySessionMaxRequests,
      });
    }

    return subjects.length > 0
      ? subjects
      : [
          {
            key: "unknown-client",
            limit: ozonProxySessionMaxRequests,
          },
        ];
  }

  private getClientIp(identity: DeliveryProxyIdentity) {
    const directIp = this.normalizeIpAddress(identity.requestIp);

    if (directIp && !this.canTrustForwardedIp(directIp)) {
      return directIp;
    }

    return (
      this.normalizeIpAddress(identity.realIp) ??
      this.getNearestForwardedIp(identity.forwardedFor) ??
      directIp
    );
  }

  private getNearestForwardedIp(forwardedFor: string | undefined) {
    return forwardedFor
      ?.split(",")
      .reverse()
      .map((value) => this.normalizeIpAddress(value))
      .find((value): value is string => Boolean(value));
  }

  private getCartId(cookieHeader: string | undefined) {
    const cartCookie = cookieHeader
      ?.split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${cartCookieName}=`));
    const rawCartId = cartCookie?.slice(cartCookieName.length + 1);

    if (!rawCartId || rawCartId.length > 256) {
      return undefined;
    }

    try {
      return decodeURIComponent(rawCartId).trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private normalizeIpAddress(ipAddress: string | undefined) {
    const rawIpAddress = ipAddress?.trim();

    if (
      !rawIpAddress ||
      rawIpAddress.toLowerCase() === "unknown" ||
      rawIpAddress.includes("\n") ||
      rawIpAddress.includes("\r")
    ) {
      return undefined;
    }

    const normalizedIpAddress = rawIpAddress.startsWith("::ffff:")
      ? rawIpAddress.slice("::ffff:".length)
      : rawIpAddress;

    return isIP(normalizedIpAddress) ? normalizedIpAddress : undefined;
  }

  private canTrustForwardedIp(ipAddress: string) {
    const normalizedIpAddress = ipAddress.toLowerCase();

    return (
      normalizedIpAddress === "::1" ||
      normalizedIpAddress === "127.0.0.1" ||
      normalizedIpAddress.startsWith("10.") ||
      normalizedIpAddress.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedIpAddress) ||
      normalizedIpAddress.startsWith("fc") ||
      normalizedIpAddress.startsWith("fd") ||
      normalizedIpAddress.startsWith("fe80:")
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

    this.nextCleanupAt = now + ozonProxyThrottleWindowMs;
  }

  private throwTooManyRequests(resetAt: number, now: number): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: "Too many Ozon delivery requests. Try again later",
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private hashSubject(subject: string) {
    return crypto.createHash("sha256").update(subject).digest("hex");
  }
}
