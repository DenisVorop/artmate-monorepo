"use client";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import {
  usePromoCodes,
  formatPromoCodeValue,
  formatKopecks,
  formatPromoCodeDate,
} from "@/entities/promocodes";
import type { Contest } from "@/entities/contest";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";
import type { ContestFormValues } from "../lib/form-values";

export function PromoPrizeFields({
  form,
  locked,
  terms,
  placeIndex,
  participation = false,
}: {
  form: UseFormReturn<ContestFormValues>;
  locked: boolean;
  terms?: Contest["prizePromoTerms"];
  placeIndex?: number;
  participation?: boolean;
}) {
  const { promoCodes, isPending, isError } = usePromoCodes();
  const name = participation
    ? "participationPromoCodeId"
    : placeIndex === undefined
      ? "prizePromoCodeId"
      : (`prizePlaces.${placeIndex}.prizePromoCodeId` as const);
  const inputId = participation
    ? "contest-participation-promo"
    : placeIndex === undefined
      ? "contest-promo-prize"
      : `contest-place-${placeIndex}-promo`;
  const error = participation
    ? form.formState.errors.participationPromoCodeId
    : placeIndex === undefined
      ? form.formState.errors.prizePromoCodeId
      : form.formState.errors.prizePlaces?.[placeIndex]?.prizePromoCodeId;
  const selectedId = useWatch({
    control: form.control,
    name,
  });
  const selected = promoCodes.find((p) => p.id === selectedId);
  const snapshot =
    selectedId &&
    terms &&
    selectedId ===
      (participation
        ? form.formState.defaultValues?.participationPromoCodeId
        : placeIndex === undefined
          ? form.formState.defaultValues?.prizePromoCodeId
          : form.formState.defaultValues?.prizePlaces?.[placeIndex]
              ?.prizePromoCodeId)
      ? terms
      : null;
  const options = promoCodes.filter(
    (p) =>
      p.kind === "standard" &&
      p.isActive &&
      (!p.endsAt || new Date(p.endsAt).getTime() > Date.now()),
  );
  const discount = snapshot
    ? snapshot.type === "PERCENTAGE"
      ? `${snapshot.basisPoints! / 100}%`
      : formatKopecks(snapshot.amountKopecks!)
    : selected
      ? formatPromoCodeValue(selected)
      : null;
  const minSubtotal =
    snapshot?.minSubtotalKopecks ?? selected?.minSubtotalKopecks ?? 0;
  const maxDiscount = snapshot
    ? snapshot.maxDiscountKopecks
    : selected?.maxDiscountKopecks;
  const startsAt = snapshot ? snapshot.startsAt : selected?.startsAt;
  const endsAt = snapshot ? snapshot.endsAt : selected?.endsAt;
  return (
    <div className="space-y-3 border-t pt-5">
      <Label htmlFor={inputId}>
        {participation
          ? "Промокод за участие"
          : placeIndex === undefined
            ? "Промокод каждому победителю"
            : "Промокод"}
      </Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value ?? "none"}
            onValueChange={(value) =>
              field.onChange(value === "none" ? null : value)
            }
            disabled={locked || isPending || isError}
          >
            <SelectTrigger
              id={inputId}
              className="w-full"
              aria-invalid={Boolean(error)}
            >
              <SelectValue placeholder="Выберите промокод" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без промокода</SelectItem>
              {selectedId && !options.some((p) => p.id === selectedId) && (
                <SelectItem value={selectedId}>
                  {snapshot?.name ?? selected?.name ?? "Выбранный промокод"}
                </SelectItem>
              )}
              {options.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.id === selectedId && snapshot
                    ? `${snapshot.name} · ${discount}`
                    : `${p.name} · ${formatPromoCodeValue(p)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Не удалось загрузить промокоды. Обновите страницу.
        </p>
      )}
      {selectedId && (
        <div className="space-y-1 text-sm text-muted-foreground">
          {discount && (
            <p>
              Скидка {discount}
              {minSubtotal > 0 ? ` · от ${formatKopecks(minSubtotal)}` : ""}
              {maxDiscount ? ` · не больше ${formatKopecks(maxDiscount)}` : ""}
            </p>
          )}
          {startsAt && <p>С {formatPromoCodeDate(startsAt)}</p>}
          {endsAt && <p>До {formatPromoCodeDate(endsAt)}</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
