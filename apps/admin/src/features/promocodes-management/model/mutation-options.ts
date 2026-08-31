import type { PromoCodeAdminDTO } from "@/shared/actions/promocodes";

export type PromoCodeMutationOptions = {
  readonly onSuccess?: (
    _promoCode: PromoCodeAdminDTO,
  ) => Promise<unknown> | unknown;
};
