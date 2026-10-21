import { z } from "zod";

import type { EmailSubscriptionDTO } from "@/shared/actions/consents";

export type EmailSubscription = EmailSubscriptionDTO;
export const emailSubscriptionSchema: z.ZodType<EmailSubscription> = z.object({
  email: z.string().email().max(254),
  subscribed: z.boolean(),
  version: z.number().int().nonnegative(),
  stateRevision: z.number().int().nonnegative(),
  grantRevisionId: z.string().min(1).optional(),
});
