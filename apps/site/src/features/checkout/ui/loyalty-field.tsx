"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Coins, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { formatLoyaltyPoints, useLoyaltyData } from "@/entities/loyalty";
import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Button, Input, Label } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { formatMoney, useCheckout } from "../lib";
import { createLoyaltyFormSchema, type LoyaltyFormValues } from "../lib/loyalty-form";

export function LoyaltyField() {
  const { user, isPending: isSessionPending } = useSession();
  const overview = useLoyaltyData(user?.id ?? "guest", !!user);
  const { loyalty, isSubmitting, selectedDelivery, checkoutCalculation } = useCheckout();
  const member = overview.data?.member;
  const isReady =
    !overview.isError && member?.status === "active" && member.historyState === "ready";
  const preview =
    !loyalty.isPending && checkoutCalculation.status === "ready" ? loyalty.preview : undefined;

  return (
    <section
      aria-label="Баллы клуба Artmate"
      className="space-y-3 rounded-lg border bg-muted/20 p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Coins className="size-4 text-rose-500" aria-hidden="true" />
        Баллы клуба Artmate
      </p>

      <div aria-live="polite" className="space-y-2 text-sm">
        {isSessionPending ? (
          <p className="text-muted-foreground">Проверяем аккаунт…</p>
        ) : !user ? (
          <p className="text-muted-foreground">
            <Link
              href={`${routes.auth}?next=${encodeURIComponent(routes.checkout)}`}
              className="font-medium text-primary underline underline-offset-4"
            >
              Войдите
            </Link>{" "}
            в аккаунт, чтобы использовать баллы клуба.
          </p>
        ) : overview.isPending ? (
          <p className="text-muted-foreground">Загружаем баллы…</p>
        ) : overview.isError || !overview.data ? (
          <p className="text-muted-foreground">
            Баллы временно недоступны. Можно оформить заказ без них.
          </p>
        ) : !overview.data.enrolled ? (
          <p className="text-muted-foreground">
            <Link
              href={routes.loyalty}
              className="font-medium text-primary underline underline-offset-4"
            >
              Вступите в клуб Artmate
            </Link>{" "}
            и используйте баллы для покупок.
          </p>
        ) : member?.status === "blocked" ? (
          <p className="text-muted-foreground">
            Участие в клубе приостановлено. Списание баллов недоступно.
          </p>
        ) : member?.historyState === "pending" ? (
          <p className="text-muted-foreground">
            Собираем вашу историю. Баллы станут доступны автоматически, когда всё будет готово.
          </p>
        ) : !isReady ? (
          <p className="text-muted-foreground">
            Баллы пока недоступны. Можно оформить заказ без них.
          </p>
        ) : (
          <>
            {(!selectedDelivery || preview) && (
              <p>
                Доступно:{" "}
                {formatLoyaltyPoints(preview?.availablePoints ?? member.wallet.availablePoints)}
              </p>
            )}
            {!selectedDelivery ? (
              <p className="text-muted-foreground">
                Выберите пункт выдачи, чтобы рассчитать списание баллов.
              </p>
            ) : loyalty.isPending ? (
              <p className="flex items-center gap-2 text-muted-foreground" role="status">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Пересчитываем списание и итог заказа…
              </p>
            ) : !preview ? (
              <p className="text-muted-foreground">
                {checkoutCalculation.status === "offline"
                  ? "Нет сети. Списание будет доступно после пересчёта заказа."
                  : loyalty.pointsToSpend > 0
                    ? "Не удалось рассчитать списание. Уберите баллы и выберите сумму заново."
                    : "Не удалось рассчитать заказ. Попробуйте повторить расчёт."}
              </p>
            ) : preview.maxPoints === 0 ? (
              <p className="text-muted-foreground">
                {preview.availablePoints === 0
                  ? "Пока нет доступных баллов для списания."
                  : "Для этого заказа списание баллов недоступно."}
              </p>
            ) : (
              <LoyaltyForm
                key={`${loyalty.selectionKey}:${loyalty.pointsToSpend}`}
                maxPoints={preview.maxPoints}
                pointsToSpend={loyalty.pointsToSpend}
                isDisabled={isSubmitting}
                onApply={loyalty.setPoints}
              />
            )}
            <p className="text-xs text-muted-foreground">
              5 баллов = 1 ₽. За каждый товар нужно заплатить минимум 1 ₽. Доставка оплачивается
              отдельно.
            </p>
          </>
        )}
      </div>

      {loyalty.pointsToSpend > 0 ? (
        <div className="space-y-2 text-sm" aria-live="polite">
          {isReady && preview && preview.pointsToSpend === loyalty.pointsToSpend ? (
            <p className="font-medium text-emerald-700">
              К списанию: {formatLoyaltyPoints(preview.pointsToSpend)}. Скидка{" "}
              {formatMoney(preview.discountKopecks / 100)}.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Выбрано к списанию: {formatLoyaltyPoints(loyalty.pointsToSpend)}. Скидка ожидает
              пересчёта.
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={isSubmitting}
            onClick={() => loyalty.setPoints(0)}
          >
            Не списывать баллы
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function LoyaltyForm({
  maxPoints,
  pointsToSpend,
  isDisabled,
  onApply,
}: {
  maxPoints: number;
  pointsToSpend: number;
  isDisabled: boolean;
  onApply: (_points: number) => void;
}) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<LoyaltyFormValues>({
    defaultValues: { points: pointsToSpend },
    resolver: zodResolver(createLoyaltyFormSchema(maxPoints)),
  });

  return (
    <form className="space-y-2" noValidate onSubmit={handleSubmit(({ points }) => onApply(points))}>
      <Label htmlFor="loyalty-points">Сколько баллов списать</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="loyalty-points"
          type="number"
          inputMode="numeric"
          min={0}
          max={maxPoints}
          step={1}
          className="min-h-11"
          disabled={isDisabled}
          aria-invalid={Boolean(errors.points)}
          aria-describedby={
            errors.points ? "loyalty-points-error loyalty-points-limit" : "loyalty-points-limit"
          }
          {...register("points", { valueAsNumber: true })}
        />
        <Button type="submit" variant="outline" className="min-h-11" disabled={isDisabled}>
          Применить
        </Button>
      </div>
      {errors.points?.message ? (
        <p id="loyalty-points-error" className="text-sm text-destructive" role="alert">
          {errors.points.message}
        </p>
      ) : null}
      <Button
        id="loyalty-points-limit"
        type="button"
        variant="link"
        className="min-h-11 px-0"
        disabled={isDisabled}
        onClick={() => setValue("points", maxPoints, { shouldDirty: true, shouldValidate: true })}
      >
        Максимум: {formatLoyaltyPoints(maxPoints)}
      </Button>
    </form>
  );
}
