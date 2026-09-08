import crypto from "node:crypto";
import { isIP } from "node:net";

import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import {
  OrderCheckoutThrottleScope,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const checkoutMaxRequests = 5;
const checkoutThrottleWindowMs = 15 * 60 * 1000;

type CheckoutIdentity = {
  cartId?: string;
  forwardedFor?: string;
  realIp?: string;
  requestIp?: string;
};

type ThrottleSubject = {
  hash: string;
  scope: OrderCheckoutThrottleScope;
};

@Injectable()
export class CheckoutThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAllowed(identity: CheckoutIdentity) {
    const subjects = this.getSubjects(identity);
    if (subjects.length === 0) {
      throw new HttpException(
        "Checkout identity is required",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const blockedUntil = await this.prisma.$transaction(async (tx) => {
      let latestBlock: Date | undefined;

      for (const subject of subjects) {
        const block = await this.incrementSubject(tx, subject);
        if (block && (!latestBlock || block > latestBlock)) latestBlock = block;
      }

      return latestBlock;
    });

    if (blockedUntil) {
      const now = Date.now();
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many checkout attempts. Try again later",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((blockedUntil.getTime() - now) / 1000),
          ),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async incrementSubject(
    tx: Prisma.TransactionClient,
    subject: ThrottleSubject,
  ) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + checkoutThrottleWindowMs);
    const key = {
      scope: subject.scope,
      subjectHash: subject.hash,
    };

    const throttle = await tx.orderCheckoutThrottle.upsert({
      where: { scope_subjectHash: key },
      create: {
        ...key,
        requestCount: 0,
        windowStartedAt: now,
        lastRequestAt: now,
      },
      update: {},
      select: { id: true },
    });
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "order_checkout_throttles" WHERE "id" = ${throttle.id} FOR UPDATE`,
    );
    const bucket = await tx.orderCheckoutThrottle.findUnique({
      where: { scope_subjectHash: key },
    });
    if (!bucket) throw new Error("Checkout throttle bucket not found");

    if (bucket.blockedUntil && bucket.blockedUntil > now) {
      return bucket.blockedUntil;
    }

    const windowExpired =
      bucket.windowStartedAt.getTime() <=
      now.getTime() - checkoutThrottleWindowMs;
    const requestCount = windowExpired ? 1 : bucket.requestCount + 1;
    const blockedUntil =
      requestCount > checkoutMaxRequests ? expiresAt : null;

    await tx.orderCheckoutThrottle.update({
      where: { id: bucket.id },
      data: {
        requestCount,
        windowStartedAt: windowExpired ? now : bucket.windowStartedAt,
        lastRequestAt: now,
        blockedUntil,
      },
    });

    return blockedUntil ?? undefined;
  }

  private getSubjects(identity: CheckoutIdentity): ThrottleSubject[] {
    const subjects: ThrottleSubject[] = [];
    const cartId = identity.cartId?.trim();
    const ip = this.getClientIp(identity);

    if (cartId) {
      subjects.push({
        scope: OrderCheckoutThrottleScope.CART,
        hash: this.hashSubject(`cart:${cartId}`),
      });
    }
    if (ip) {
      subjects.push({
        scope: OrderCheckoutThrottleScope.IP,
        hash: this.hashSubject(`ip:${ip}`),
      });
    }

    return subjects;
  }

  private getClientIp(identity: CheckoutIdentity) {
    const directIp = this.normalizeIp(identity.requestIp);
    if (directIp && !this.isTrustedProxy(directIp)) return directIp;

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

  private normalizeIp(value: string | undefined) {
    const raw = value?.trim();
    if (!raw || raw.includes("\n") || raw.includes("\r")) return undefined;
    const normalized = raw.startsWith("::ffff:") ? raw.slice(7) : raw;
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

  private hashSubject(value: string) {
    return crypto
      .createHmac("sha256", this.getSecret())
      .update(`checkout-throttle:${value}`)
      .digest("hex");
  }

  private getSecret() {
    const secret = process.env.AUTH_JWT_SECRET?.trim();
    if (!secret) {
      throw new InternalServerErrorException(
        "AUTH_JWT_SECRET is not configured",
      );
    }
    return secret;
  }
}
