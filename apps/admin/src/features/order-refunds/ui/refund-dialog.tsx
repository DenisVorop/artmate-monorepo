"use client";

import { RotateCcw } from "lucide-react";
import { useId } from "react";

import type { OrderRefunds } from "@/entities/order-refund";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
} from "@/shared/ui";

import { formatMoney, useRefundForm } from "../lib";

export function RefundDialog({ data }: { readonly data: OrderRefunds }) {
  const fieldId = useId();
  const {
    changeOpen,
    form,
    isPending,
    items,
    open,
    previewKopecks,
    setFullRemainingRefund,
    submit,
    submitError,
  } = useRefundForm(data);
  const deliveryId = `${fieldId}-delivery`;
  const deliveryHelpId = `${fieldId}-delivery-help`;
  const referenceId = `${fieldId}-reference`;
  const reasonId = `${fieldId}-reason`;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button disabled={!data.canRecord}>
          <RotateCcw aria-hidden="true" data-icon="inline-start" />
          Учесть возврат
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="min-w-0">
          <DialogTitle>Учесть возврат</DialogTitle>
          <DialogDescription className="break-words">
            Сохранение не переводит деньги покупателю. Укажите уже подтвержденную
            операцию возврата.
          </DialogDescription>
        </DialogHeader>

        <form className="min-w-0 max-w-full space-y-5" onSubmit={submit}>
          <fieldset className="min-w-0 space-y-3" disabled={isPending}>
            <legend className="font-medium">Товары</legend>
            {items.map((item, index) => (
              <div
                className="grid min-w-0 max-w-full gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center"
                key={item.productId}
              >
                <div className="min-w-0 max-w-full">
                  <p className="break-words font-medium">{item.title}</p>
                  <p className="break-words text-sm text-muted-foreground">
                    Доступно {item.remainingQuantity} из {item.quantity} шт. · до {formatMoney(item.refundableKopecks)}
                  </p>
                </div>
                <label className="grid min-w-0 gap-1 text-sm">
                  <span>Количество</span>
                  <Input
                    aria-label={`Количество для ${item.title}`}
                    type="number"
                    min={0}
                    max={item.remainingQuantity}
                    step={1}
                    {...form.register(`quantities.${index}`, {
                      setValueAs: (value) => (value === "" ? 0 : Number(value)),
                    })}
                  />
                </label>
                <FieldError
                  className="sm:col-span-2"
                  message={form.formState.errors.quantities?.[index]?.message}
                />
              </div>
            ))}
          </fieldset>

          <div className="grid min-w-0 gap-2">
            <label htmlFor={deliveryId} className="font-medium">
              Возврат доставки, ₽
            </label>
            <Input
              id={deliveryId}
              inputMode="decimal"
              disabled={isPending}
              aria-describedby={deliveryHelpId}
              {...form.register("deliveryRubles")}
            />
            <p id={deliveryHelpId} className="text-sm text-muted-foreground">
              Доступно: {formatMoney(data.delivery.refundableKopecks)}
            </p>
            <FieldError message={form.formState.errors.deliveryRubles?.message} />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={setFullRemainingRefund}
          >
            Выбрать весь остаток
          </Button>

          <div className="grid min-w-0 gap-2">
            <label htmlFor={referenceId} className="font-medium">
              Номер операции
            </label>
            <Input
              id={referenceId}
              maxLength={120}
              disabled={isPending}
              autoComplete="off"
              {...form.register("reference")}
            />
            <FieldError message={form.formState.errors.reference?.message} />
          </div>

          <div className="grid min-w-0 gap-2">
            <label htmlFor={reasonId} className="font-medium">
              Причина
            </label>
            <Textarea
              id={reasonId}
              className="field-sizing-fixed min-w-0 max-w-full"
              maxLength={1000}
              rows={4}
              disabled={isPending}
              {...form.register("reason")}
            />
            <FieldError message={form.formState.errors.reason?.message} />
          </div>

          <div className="min-w-0 rounded-lg border bg-muted/35 p-3">
            <p className="text-sm text-muted-foreground">Будет учтено</p>
            <p className="mt-1 break-words text-2xl font-semibold">
              {previewKopecks === null ? "—" : formatMoney(previewKopecks)}
            </p>
            <FieldError message={form.formState.errors.quantities?.root?.message} />
          </div>

          <label className="flex min-w-0 items-start gap-3 rounded-lg border p-3 text-sm leading-6">
            <Checkbox
              checked={form.watch("confirmed")}
              disabled={isPending}
              onCheckedChange={(checked) =>
                form.setValue("confirmed", checked === true, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              aria-label="Подтвердить выполненный возврат"
            />
            <span className="min-w-0 break-words">
              Подтверждаю, что возврат покупателю уже выполнен
            </span>
          </label>
          <FieldError message={form.formState.errors.confirmed?.message} />

          {submitError ? (
            <p className="min-w-0 break-words rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => changeOpen(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Сохраняем..." : "Учесть возврат"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({
  className,
  message,
}: {
  readonly className?: string;
  readonly message?: string;
}) {
  return message ? (
    <p className={`break-words text-sm text-destructive ${className ?? ""}`}>
      {message}
    </p>
  ) : null;
}
