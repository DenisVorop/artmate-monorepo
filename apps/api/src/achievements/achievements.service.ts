import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { readAchievements } from "./read-achievements";

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  getMine(userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || user.status !== "ACTIVE" || user.deletedAt)
          throw new ForbiddenException("Account is unavailable");
        return readAchievements(tx, userId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
