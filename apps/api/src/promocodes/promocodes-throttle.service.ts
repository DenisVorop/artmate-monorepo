import crypto from "node:crypto";
import { isIP } from "node:net";

import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

const windowMs = 60_000;
const maxRequests = 30;
const maxBuckets = 10_000;

export type PromoPublicIdentity = {
  cookieHeader?: string;
  forwardedFor?: string;
  realIp?: string;
  requestIp?: string;
};

@Injectable()
export class PromocodesThrottleService {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  assertAllowed(identity: PromoPublicIdentity) {
    const now = Date.now();
    const keys = this.getKeys(identity);

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    for (const key of keys) {
      const bucket = this.buckets.get(key);
      if (bucket && bucket.resetAt > now && bucket.count >= maxRequests) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: "Слишком много запросов. Попробуйте позже",
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((bucket.resetAt - now) / 1000),
            ),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    if (
      this.buckets.size + keys.filter((key) => !this.buckets.has(key)).length >
      maxBuckets
    ) {
      throw new HttpException(
        "Слишком много запросов. Попробуйте позже",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    for (const key of keys) {
      const bucket = this.buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      } else {
        bucket.count += 1;
      }
    }
  }

  private getKeys(identity: PromoPublicIdentity) {
    const ip = this.getIp(identity);
    const cartId = this.getCookie(identity.cookieHeader, "cart_id");
    const subjects = [ip && `ip:${ip}`, cartId && `cart:${cartId}`].filter(
      (value): value is string => Boolean(value),
    );

    return (subjects.length ? subjects : ["unknown"]).map((subject) =>
      crypto.createHash("sha256").update(subject).digest("hex"),
    );
  }

  private getIp(identity: PromoPublicIdentity) {
    const direct = this.normalizeIp(identity.requestIp);
    if (direct && !this.isTrustedProxy(direct)) return direct;
    return (
      this.normalizeIp(identity.realIp) ??
      identity.forwardedFor
        ?.split(",")
        .reverse()
        .map((value) => this.normalizeIp(value))
        .find((value): value is string => Boolean(value)) ??
      direct
    );
  }

  private normalizeIp(value?: string) {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.includes("\n") || trimmed.includes("\r"))
      return undefined;
    const normalized = trimmed.startsWith("::ffff:")
      ? trimmed.slice(7)
      : trimmed;
    return isIP(normalized) ? normalized : undefined;
  }

  private isTrustedProxy(ip: string) {
    return (
      ip === "::1" ||
      ip === "127.0.0.1" ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    );
  }

  getCookie(header: string | undefined, name: string) {
    const raw = header
      ?.split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`))
      ?.slice(name.length + 1);
    if (!raw || raw.length > 256) return undefined;
    try {
      return decodeURIComponent(raw).trim() || undefined;
    } catch {
      return undefined;
    }
  }
}
