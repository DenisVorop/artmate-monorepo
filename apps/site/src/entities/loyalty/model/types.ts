import { z } from "zod";

const points = z.number().int().nonnegative();

export const loyaltyOverviewSchema = z.object({
  enrolled: z.boolean(),
  termsVersion: z.string(),
  member: z
    .object({
      id: z.string(),
      joinedAt: z.string(),
      termsVersion: z.string(),
      status: z.enum(["active", "blocked"]),
      historyState: z.enum(["pending", "ready", "failed"]),
      wallet: z.object({
        balancePoints: points,
        reservedPoints: points,
        availablePoints: points,
        revision: points,
      }),
    })
    .nullable(),
});

export const loyaltyDashboardSchema = z.object({
  tier: z
    .object({
      ratePercent: z.number().nonnegative(),
      spendKopecks: points,
      nextThresholdKopecks: points.nullable(),
      nextRatePercent: z.number().nonnegative().nullable(),
    })
    .nullable(),
});

export const loyaltyOperationsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      sequence: points,
      title: z.string(),
      kind: z.enum(["credit", "reversal", "reserve", "consume", "release", "restore"]),
      balanceDelta: z.number().int(),
      reservedDelta: z.number().int(),
      balanceAfter: points,
      reservedAfter: points,
      occurredAt: z.string(),
      recordedAt: z.string(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export type LoyaltyOverview = z.infer<typeof loyaltyOverviewSchema>;
export type LoyaltyDashboard = z.infer<typeof loyaltyDashboardSchema>;
export type LoyaltyOperations = z.infer<typeof loyaltyOperationsSchema>;
export type LoyaltyOperation = LoyaltyOperations["items"][number];
