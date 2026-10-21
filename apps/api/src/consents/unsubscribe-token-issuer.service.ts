import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UnsubscribeToken } from "./unsubscribe-token";

/** Internal capability issuance; no public HTTP issuer or mail delivery. Each
 * issued hash remains usable across later regrants for the same subscription. */
@Injectable()
export class UnsubscribeTokenIssuer {
  constructor(private readonly prisma: PrismaService) {}
  public async issue(subscriptionId: string): Promise<string> {
    const exists = await this.prisma.emailAdvertisingSubscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, email: true },
    });
    if (!exists?.email)
      throw new NotFoundException("Subscription is unavailable");
    const { token, hash } = UnsubscribeToken.create();
    await this.prisma.emailAdvertisingUnsubscribeToken.create({
      data: { subscriptionId, tokenHash: hash },
    });
    return token;
  }
}
