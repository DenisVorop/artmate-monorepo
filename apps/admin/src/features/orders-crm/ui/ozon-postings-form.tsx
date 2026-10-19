"use client";

import { useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { OzonPostingLinks, type AdminOrder } from "@/entities/orders";
import { Button, Textarea } from "@/shared/ui";

import {
  OzonPostingsFormMapper,
  ozonPostingsFormSchema,
  type OzonPostingsFormValues,
} from "../lib/ozon-postings-form";
import { useUpdateOzonPostings } from "../model/use-update-ozon-postings";

export function OzonPostingsForm({ order }: { readonly order: AdminOrder }) {
  const inputId = useId();
  const { mutate, isPending, isError } = useUpdateOzonPostings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<OzonPostingsFormValues>({
    resolver: zodResolver(ozonPostingsFormSchema),
    values: OzonPostingsFormMapper.getValues(
      order.ozonPostingNumbers,
      order.ozonFbsPostingNumbers,
    ),
    resetOptions: { keepDirtyValues: true },
  });

  return (
    <form
      className="space-y-2 rounded-lg border p-3"
      onSubmit={handleSubmit((values) =>
        mutate(
          {
            orderId: order.id,
            ...OzonPostingsFormMapper.build(values),
          },
          {
            onSuccess: (updatedOrder) =>
              reset(
                OzonPostingsFormMapper.getValues(
                  updatedOrder.ozonPostingNumbers,
                  updatedOrder.ozonFbsPostingNumbers,
                ),
              ),
          },
        ),
      )}
    >
      <label className="text-sm font-medium" htmlFor={inputId}>
        Отправления Ozon
      </label>
      <p className="text-xs text-muted-foreground" id={`${inputId}-hint`}>
        Добавьте ссылки на все отправления ФБО и ФБС этого заказа, каждую с
        новой строки.
      </p>
      <Textarea
        {...register("links")}
        id={inputId}
        aria-describedby={`${inputId}-hint${errors.links ? ` ${inputId}-error` : ""}`}
        aria-invalid={Boolean(errors.links)}
        disabled={isPending}
        placeholder="https://seller.ozon.ru/app/postings/fbo/details?posting_number=…"
        rows={3}
      />
      {errors.links ? (
        <p className="text-xs text-destructive" id={`${inputId}-error`}>
          {errors.links.message}
        </p>
      ) : null}
      {isError ? (
        <p className="text-xs text-destructive" role="alert">
          Не удалось сохранить отправления. Попробуйте ещё раз.
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={isPending || !isDirty}
        size="sm"
        type="submit"
      >
        {isPending ? "Сохраняем…" : "Сохранить отправления"}
      </Button>
      <OzonPostingLinks
        postingNumbers={order.ozonPostingNumbers}
        fbsPostingNumbers={order.ozonFbsPostingNumbers}
      />
    </form>
  );
}
