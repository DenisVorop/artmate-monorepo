"use client";

import { useAnalytics } from "../lib/analytics";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, Palette, Sparkles } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { LoyaltyPoints } from "@/entities/loyalty";

import { Button, Card, CardContent, CardHeader, CardTitle, Label } from "@/shared/ui";
import { Checkbox } from "@/shared/ui/checkbox";
import { routes } from "@/shared/constants";

import { enrollmentFormSchema, type EnrollmentFormValues } from "../lib/enrollment-form";
import { useEnroll } from "../model/use-enroll";

export function Enrollment({ userId, termsVersion }: { userId: string; termsVersion: string }) {
  const analytics = useAnalytics();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentFormSchema),
    defaultValues: { acceptedTerms: false },
  });
  const { mutate, isPending, isError } = useEnroll(userId, termsVersion);

  return (
    <Card className="border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50">
      <CardHeader className="gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-rose-500">
          <Sparkles className="size-6" />
        </span>
        <CardTitle className="text-2xl">Творите и получайте бонусы</CardTitle>
        <p className="max-w-2xl text-sm leading-6 text-stone-600">
          Вступите в клуб Artmate, чтобы получать баллы за покупки и творчество. После вступления мы
          учтём вашу историю покупок и опубликованных работ.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div id="loyalty-rules" className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-rose-100 bg-white/80 p-4">
            <Gift className="mb-3 size-5 text-rose-500" />
            <p className="font-semibold">
              <LoyaltyPoints points={5} /> = 1 ₽
            </p>
            <p className="mt-1 leading-6 text-stone-600">
              Баллы бессрочные. Ими можно оплатить часть покупки.
            </p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-white/80 p-4">
            <Palette className="mb-3 size-5 text-orange-500" />
            <p className="font-semibold">
              <LoyaltyPoints points={25} /> за картину
            </p>
            <p className="mt-1 leading-6 text-stone-600">
              За одобренную публичную работу в мастерской — один раз за каждую картину.
            </p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-white/80 p-4">
            <Sparkles className="mb-3 size-5 text-rose-500" />
            <p className="font-semibold">Бонусы за покупки</p>
            <p className="mt-1 leading-6 text-stone-600">
              Начисляем за завершённые покупки. Процент бонусов зависит от суммы покупок.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit((values) => mutate(values))} className="space-y-4">
          <div>
            <div className="flex items-start gap-3">
              <Controller
                control={control}
                name="acceptedTerms"
                render={({ field }) => (
                  <Checkbox
                    id="loyalty-terms"
                    name={field.name}
                    ref={field.ref}
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(value === true)}
                    onBlur={field.onBlur}
                    disabled={isPending}
                    aria-invalid={Boolean(errors.acceptedTerms)}
                    aria-describedby={
                      errors.acceptedTerms ? "loyalty-terms-error" : "loyalty-rules"
                    }
                    className="mt-3.5"
                  />
                )}
              />
              <Label
                htmlFor="loyalty-terms"
                className="block min-h-11 cursor-pointer py-2.5 text-sm leading-6"
              >
                Я принимаю{" "}
                <a
                  href={routes.legal.loyaltyRules}
                  onClick={analytics.termsOpened}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm text-rose-700 underline underline-offset-4 hover:text-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                >
                  правила клуба Artmate
                </a>{" "}
                и хочу вступить в клуб.
              </Label>
            </div>
            {errors.acceptedTerms && (
              <p id="loyalty-terms-error" role="alert" className="mt-1 text-sm text-destructive">
                {errors.acceptedTerms.message}
              </p>
            )}
          </div>
          {isError && (
            <p role="alert" className="text-sm text-destructive">
              Не удалось вступить в клуб. Попробуйте позже. Если правила обновились, обновите
              страницу.
            </p>
          )}
          <Button type="submit" disabled={isPending} className="min-h-11 w-full sm:w-auto">
            {isPending ? "Вступаем в клуб…" : "Вступить в клуб"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
