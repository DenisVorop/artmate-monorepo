"use client";

import { ArrowRight, LoaderCircle, RotateCcw, WalletCards } from "lucide-react";
import { useId } from "react";

import { formatFinanceKopecks } from "@/entities/affiliate-finance";
import type { AffiliatePayoutSummary } from "@/entities/affiliate-payout";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/shared/ui";

import {
  getPayoutBlockedMessage,
  getPayoutFormDescription,
  usePayoutForm,
} from "../lib";

export function PayoutForm({
  isSummaryFresh,
  summary,
}: {
  readonly isSummaryFresh: boolean;
  readonly summary: AffiliatePayoutSummary;
}) {
  const inputId = useId();
  const {
    amountField,
    cancelConfirmation,
    confirm,
    confirmation,
    form,
    isPending,
    isUncertain,
    prepare,
    retryUncertain,
    useFullBalance,
  } = usePayoutForm(summary);
  const blockedMessage = getPayoutBlockedMessage(summary.blockedReason);

  return (
    <Card className="overflow-hidden border-ink/10 shadow-[0_20px_60px_rgb(40_27_63/8%)]">
      <CardHeader className="border-b bg-[radial-gradient(circle_at_top_right,rgb(245_158_11/12%),transparent_42%)]">
        <CardTitle className="font-heading text-xl">Новая заявка</CardTitle>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {getPayoutFormDescription(
            { canRequest: summary.canRequest && isSummaryFresh },
            {
            available: formatFinanceKopecks(summary.availableKopecks),
            minimum: formatFinanceKopecks(summary.minimumPayoutKopecks),
            },
          )}
        </p>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">
        {!summary.canRequest && !isUncertain ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p className="font-extrabold">Заявка сейчас недоступна</p>
            <p className="mt-1">{blockedMessage}</p>
          </div>
        ) : confirmation !== null ? (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5">
            <p className="text-sm font-bold text-violet-900">Проверьте сумму</p>
            <p className="font-heading mt-2 text-3xl font-bold text-ink tabular-nums">
              {formatFinanceKopecks(confirmation)}
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Эта сумма будет зарезервирована. Остальной доступный баланс останется
              свободным, но до завершения заявки создать ещё одну нельзя.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                disabled={isPending}
                onClick={cancelConfirmation}
                type="button"
                variant="ghost"
              >
                Изменить сумму
              </Button>
              <Button
                disabled={isPending || (!isSummaryFresh && !isUncertain)}
                onClick={() => void confirm()}
                type="button"
              >
                {isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
                Подтвердить заявку
              </Button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={prepare}>
            {!isSummaryFresh && !isUncertain ? (
              <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">
                Обновляем доступный остаток. Отправка станет доступна после обновления.
              </p>
            ) : null}
            <fieldset
              className="grid gap-4 border-0 p-0"
              disabled={isPending || isUncertain || !isSummaryFresh}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-extrabold text-ink" htmlFor={inputId}>
                    Сумма, ₽
                  </label>
                  <Button
                    disabled={isPending || isUncertain || !isSummaryFresh}
                    onClick={useFullBalance}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <WalletCards aria-hidden="true" />
                    Вся доступная сумма
                  </Button>
                </div>
                <Input
                  aria-describedby={`${inputId}-description`}
                  aria-invalid={Boolean(form.formState.errors.amountRubles)}
                  autoComplete="off"
                  className="mt-2 h-12 text-lg font-extrabold tabular-nums"
                  id={inputId}
                  inputMode="decimal"
                  placeholder="Например, 7 500,50"
                  {...amountField}
                />
                <p
                  className={
                    form.formState.errors.amountRubles
                      ? "mt-2 text-sm text-destructive"
                      : "mt-2 text-xs leading-5 text-muted-foreground"
                  }
                  id={`${inputId}-description`}
                >
                  {form.formState.errors.amountRubles?.message ??
                    `Доступно ${formatFinanceKopecks(summary.availableKopecks)}, минимум ${formatFinanceKopecks(summary.minimumPayoutKopecks)}.`}
                </p>
              </div>
              <Button
                className="w-full sm:w-fit"
                disabled={isPending || isUncertain || !isSummaryFresh}
                type="submit"
              >
                Перейти к подтверждению
                <ArrowRight aria-hidden="true" />
              </Button>
            </fieldset>

            {form.formState.errors.root?.message ? (
              <div
                className="mt-4 rounded-xl bg-destructive/8 p-3 text-sm font-bold text-destructive"
                role="alert"
              >
                <p>{form.formState.errors.root.message}</p>
                {isUncertain ? (
                  <Button
                    className="mt-3"
                    disabled={isPending}
                    onClick={retryUncertain}
                    type="button"
                    variant="outline"
                  >
                    <RotateCcw aria-hidden="true" />
                    Повторить ту же заявку
                  </Button>
                ) : null}
              </div>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
