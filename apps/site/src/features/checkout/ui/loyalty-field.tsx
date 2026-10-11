"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Coins, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { LoyaltyPoints, useLoyaltyData, type LoyaltyOverview } from "@/entities/loyalty";
import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { decline } from "@/shared/lib";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Input,
  Label,
} from "@/shared/ui";
import { Checkbox } from "@/shared/ui/checkbox";
import { Link } from "@/shared/ui/link";

import { useCheckout } from "../lib";
import { createLoyaltyFormSchema, type LoyaltyFormValues } from "../lib/loyalty-form";

export function LoyaltyField() {
  const { user, isPending: isSessionPending } = useSession();
  const overview = useLoyaltyData(user?.id ?? "guest", !!user);
  const { loyalty, isSubmitting, selectedDelivery, checkoutCalculation } = useCheckout();
  return (
    <BaseLoyaltyField
      isSignedIn={Boolean(user)}
      isSessionPending={isSessionPending}
      overview={overview}
      loyalty={loyalty}
      isSubmitting={isSubmitting}
      hasDelivery={Boolean(selectedDelivery)}
      checkoutCalculation={checkoutCalculation}
    />
  );
}

export function BaseLoyaltyField({
  isSignedIn,
  isSessionPending,
  overview,
  loyalty,
  isSubmitting,
  hasDelivery,
  checkoutCalculation,
}: {
  isSignedIn: boolean;
  isSessionPending: boolean;
  overview: { data?: LoyaltyOverview; isPending: boolean; isError: boolean };
  loyalty: ReturnType<typeof useCheckout>["loyalty"];
  isSubmitting: boolean;
  hasDelivery: boolean;
  checkoutCalculation: ReturnType<typeof useCheckout>["checkoutCalculation"];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const member = overview.data?.member;
  const isReady =
    isSignedIn &&
    !isSessionPending &&
    !overview.isPending &&
    !overview.isError &&
    member?.status === "active" &&
    member.historyState === "ready";
  const preview =
    !loyalty.isPending && checkoutCalculation.status === "ready" ? loyalty.preview : undefined;
  const hasSpending = loyalty.pointsToSpend > 0;
  const canSpend = isReady && hasDelivery && Boolean(preview && preview.maxPoints > 0);
  const spendingPoints = hasSpending ? loyalty.pointsToSpend : preview?.maxPoints;

  return (
    <Accordion type="single" collapsible className="border-t">
      <AccordionItem value="loyalty" className="border-0">
        <AccordionTrigger className="min-h-12 items-center gap-2 py-2 hover:no-underline">
          <Coins className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span id="checkout-loyalty-heading" className="flex-1">
            Баллы Artmate
          </span>
          {isReady && (
            <span className="font-semibold tabular-nums">
              <LoyaltyPoints points={preview?.availablePoints ?? member.wallet.availablePoints} />
            </span>
          )}
        </AccordionTrigger>
        <AccordionContent className="pt-1 pb-3 [&_p:not(:last-child)]:mb-0">
          <div aria-live="polite" className="text-xs leading-5 text-muted-foreground">
            {isSessionPending ? (
              <p>Проверяем аккаунт…</p>
            ) : !isSignedIn ? (
              <p>
                <Link
                  href={`${routes.auth}?next=${encodeURIComponent(routes.checkout)}`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Войдите
                </Link>{" "}
                в аккаунт, чтобы списать баллы.
              </p>
            ) : overview.isPending ? (
              <p>Загружаем баланс…</p>
            ) : overview.isError || !overview.data ? (
              <p>Не удалось загрузить баллы. Попробуйте позже.</p>
            ) : !overview.data.enrolled ? (
              <p>
                <Link
                  href={routes.loyalty}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Вступить в клуб Artmate
                </Link>
              </p>
            ) : member?.status === "blocked" ? (
              <p>Участие в клубе приостановлено.</p>
            ) : member?.historyState === "pending" ? (
              <p>Проверяем баланс. Попробуйте позже.</p>
            ) : !isReady ? (
              <p>Баллы пока недоступны.</p>
            ) : (
              <>
                <p>5 баллов = 1 ₽</p>
                <div className="mt-2 flex min-h-11 items-center gap-3 rounded-lg bg-muted/40 px-3">
                  <Label
                    htmlFor="checkout-spend-points"
                    className="min-h-11 min-w-0 flex-1 cursor-pointer py-2 text-sm font-medium text-foreground"
                  >
                    {(hasSpending || canSpend) && spendingPoints
                      ? `Списать ${spendingPoints.toLocaleString("ru-RU")} ${decline(spendingPoints, "балл", "балла", "баллов")}`
                      : "Списать баллы"}
                  </Label>
                  {hasSpending && canSpend && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 shrink-0 px-1 text-xs text-foreground"
                      disabled={isSubmitting || loyalty.isPending}
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? "Свернуть" : "Изменить"}
                    </Button>
                  )}
                  <Checkbox
                    id="checkout-spend-points"
                    checked={hasSpending}
                    disabled={isSubmitting || loyalty.isPending || (!hasSpending && !canSpend)}
                    aria-describedby="checkout-points-status"
                    className="size-5 shrink-0 border-foreground/25 data-[state=checked]:border-rose-500 data-[state=checked]:bg-rose-500"
                    onCheckedChange={(checked) => {
                      loyalty.setPoints(checked === true ? (preview?.maxPoints ?? 0) : 0);
                      setIsEditing(false);
                    }}
                  />
                </div>
                <div id="checkout-points-status" className="mt-1">
                  {loyalty.isPending ? (
                    <p className="flex items-center gap-2" role="status">
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                      Обновляем сумму…
                    </p>
                  ) : !hasDelivery ? (
                    <p>Списание доступно после выбора пункта выдачи.</p>
                  ) : !preview ? (
                    <p>
                      {checkoutCalculation.status === "offline"
                        ? "Нет сети. Подключитесь к интернету, чтобы применить баллы."
                        : "Не удалось применить баллы. Попробуйте ещё раз."}
                    </p>
                  ) : preview.maxPoints === 0 ? (
                    <p>
                      {preview.availablePoints === 0
                        ? "Пока нет баллов для списания."
                        : "На этот заказ баллы не списываются."}
                    </p>
                  ) : null}
                </div>
                {isEditing && canSpend && preview && (
                  <LoyaltyForm
                    key={`${loyalty.selectionKey}:${loyalty.pointsToSpend}`}
                    maxPoints={preview.maxPoints}
                    pointsToSpend={loyalty.pointsToSpend}
                    isDisabled={isSubmitting || loyalty.isPending}
                    onApply={(points) => {
                      loyalty.setPoints(points);
                      setIsEditing(false);
                    }}
                  />
                )}
              </>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
  } = useForm<LoyaltyFormValues>({
    defaultValues: { points: pointsToSpend },
    resolver: zodResolver(createLoyaltyFormSchema(maxPoints)),
  });

  return (
    <form
      className="space-y-2 pt-2 text-foreground"
      noValidate
      onSubmit={handleSubmit(({ points }) => onApply(points))}
    >
      <Label htmlFor="loyalty-points">Сколько баллов списать</Label>
      <div className="flex min-w-0 gap-2">
        <Input
          id="loyalty-points"
          type="number"
          inputMode="numeric"
          min={0}
          max={maxPoints}
          step={1}
          className="min-h-11 min-w-0 flex-1"
          disabled={isDisabled}
          aria-invalid={Boolean(errors.points)}
          aria-describedby="loyalty-points-error"
          {...register("points", { valueAsNumber: true })}
        />
        <Button
          type="submit"
          variant="outline"
          className="min-h-11 shrink-0 px-3"
          disabled={isDisabled}
        >
          Применить
        </Button>
      </div>
      <p
        id="loyalty-points-error"
        className="text-xs text-destructive"
        role={errors.points ? "alert" : undefined}
      >
        {errors.points?.message}
      </p>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 px-0 text-xs"
        disabled={isDisabled}
        onClick={() => onApply(maxPoints)}
      >
        Списать максимум · <LoyaltyPoints points={maxPoints} />
      </Button>
    </form>
  );
}
