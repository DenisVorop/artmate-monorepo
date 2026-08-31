"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { routes } from "@/shared/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import {
  createPromoCodeDefaultValues,
  getCreatePromoCodeInput,
  promoCodeFormSchema,
  type PromoCodeFormValues,
} from "../lib";
import { useCreatePromoCode } from "../model";
import { PromoCodeForm } from "./promo-code-form";

export function CreatePromoCode() {
  const router = useRouter();
  const form = useForm<PromoCodeFormValues>({
    defaultValues: createPromoCodeDefaultValues,
    resolver: zodResolver(promoCodeFormSchema),
  });
  const { isPending, mutate: createPromoCode } = useCreatePromoCode({
    onSuccess: (promoCode) => router.push(routes.promoCode(promoCode.id)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый промокод</CardTitle>
      </CardHeader>
      <CardContent>
        <PromoCodeForm
          form={form}
          formId="create-promo-code"
          onSubmit={form.handleSubmit((values) =>
            createPromoCode(getCreatePromoCodeInput(values)),
          )}
          submitLabel="Создать"
          submitPending={isPending}
        />
      </CardContent>
    </Card>
  );
}
