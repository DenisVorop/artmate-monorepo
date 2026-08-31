"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Textarea,
} from "@/shared/ui";

import {
  getReleasePromoCodeInput,
  releasePromoCodeDefaultValues,
  releasePromoCodeFormSchema,
  type ReleasePromoCodeFormValues,
} from "../lib";
import { useReleasePromoCodeRedemption } from "../model";

type ReleasePromoCodeRedemptionProps = {
  readonly orderId: string;
  readonly promoCodeId: string;
};

export function ReleasePromoCodeRedemption({
  orderId,
  promoCodeId,
}: ReleasePromoCodeRedemptionProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<ReleasePromoCodeFormValues>({
    defaultValues: releasePromoCodeDefaultValues,
    resolver: zodResolver(releasePromoCodeFormSchema),
  });
  const {
    errorMessage,
    isPending,
    mutate: releaseRedemption,
    reset: resetMutation,
  } = useReleasePromoCodeRedemption({
    onSuccess: () => {
      form.reset(releasePromoCodeDefaultValues);
      setOpen(false);
    },
  });
  const errors = form.formState.errors;
  const confirmedErrorId = `release-promo-${promoCodeId}-${orderId}-confirmed-error`;
  const reasonErrorId = `release-promo-${promoCodeId}-${orderId}-reason-error`;
  const serverErrorId = `release-promo-${promoCodeId}-${orderId}-server-error`;

  function changeOpen(nextOpen: boolean) {
    if (!isPending) {
      setOpen(nextOpen);
    }

    if (nextOpen) {
      form.reset(releasePromoCodeDefaultValues);
      resetMutation();
    }
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="destructive">
          Снять резерв
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Снять резерв промокода</DialogTitle>
          <DialogDescription>
            Заказ {orderId}. Действие доступно только для окончательно закрытой
            оплаты без списания.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <ShieldAlert
            className="mt-0.5 size-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p>
            Это действие не отменяет платёж и не делает возврат. Сначала
            проверьте у платёжного провайдера, что оплата окончательно закрыта
            без списания.
          </p>
        </div>

        <form
          aria-describedby={errorMessage ? serverErrorId : undefined}
          className="grid gap-4"
          id={`release-promo-${promoCodeId}-${orderId}`}
          onSubmit={form.handleSubmit((values) =>
            releaseRedemption({
              input: getReleasePromoCodeInput(values),
              orderId,
              promoCodeId,
            }),
          )}
        >
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Причина снятия резерва
            </span>
            <Textarea
              aria-describedby={errors.reason ? reasonErrorId : undefined}
              aria-invalid={Boolean(errors.reason)}
              disabled={isPending}
              maxLength={500}
              rows={4}
              {...form.register("reason")}
            />
            {errors.reason ? (
              <span className="text-xs text-destructive" id={reasonErrorId}>
                {errors.reason.message}
              </span>
            ) : null}
          </label>

          <Controller
            control={form.control}
            name="confirmed"
            render={({ field }) => (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  aria-describedby={
                    errors.confirmed ? confirmedErrorId : undefined
                  }
                  aria-invalid={Boolean(errors.confirmed)}
                  checked={field.value}
                  disabled={isPending}
                  name={field.name}
                  onBlur={field.onBlur}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                  ref={field.ref}
                />
                <span>
                  Я проверил окончательное закрытие оплаты без списания у
                  провайдера.
                </span>
              </label>
            )}
          />
          {errors.confirmed ? (
            <p className="text-xs text-destructive" id={confirmedErrorId}>
              {errors.confirmed.message}
            </p>
          ) : null}
          {errorMessage ? (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              id={serverErrorId}
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={isPending} type="button" variant="outline">
              Отмена
            </Button>
          </DialogClose>
          <Button
            disabled={isPending}
            form={`release-promo-${promoCodeId}-${orderId}`}
            type="submit"
            variant="destructive"
          >
            Подтвердить снятие резерва
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
