"use client";
import type { CSSProperties } from "react";
import { comfortaa, nunito } from "../lib/preview-fonts";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  Controller,
  useFieldArray,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { ContestPlaceIcon, ContestPrizeList } from "@repo/ui/contest-prizes";
import { formatPromoCodeValue, usePromoCodes } from "@/entities/promocodes";
import type { Contest } from "@/entities/contest";
import { Button, Checkbox, Input, Label, Textarea } from "@/shared/ui";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { defaultPrizePlace, type ContestFormValues } from "../lib/form-values";
import { toPrizePresentation } from "../lib/prize-presentation";
import { ProductPrizeFields } from "./product-prize-fields";
import { PromoPrizeFields } from "./promo-prize-fields";

type Props = {
  form: UseFormReturn<ContestFormValues>;
  locked: boolean;
  contest?: Contest;
};

export function ContestPrizeFields({ form, locked, contest }: Props) {
  const mode = useWatch({ control: form.control, name: "prizeMode" });
  const participation = useWatch({
    control: form.control,
    name: "hasParticipationPrize",
  });
  return (
    <div className="space-y-6">
      <Controller
        control={form.control}
        name="prizeMode"
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            disabled={locked}
            onValueChange={(value) => {
              field.onChange(value);
            }}
            aria-label="Распределение призов"
            className="grid gap-3 sm:grid-cols-2"
          >
            {(
              [
                ["EQUAL", "Одинаковые призы"],
                ["PLACES", "Призовые места"],
              ] as const
            ).map(([value, title]) => (
              <Label
                key={value}
                htmlFor={`prize-mode-${value}`}
                className={`flex min-h-14 items-center gap-3 rounded-xl border p-4 ${mode === value ? "border-primary/40 bg-primary/5" : "border-border"}`}
              >
                <RadioGroupItem id={`prize-mode-${value}`} value={value} />
                <span className="min-w-0 space-y-1">
                  <span className="block font-semibold">{title}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        )}
      />
      {mode === "PLACES" ? (
        <PlaceFields form={form} locked={locked} contest={contest} />
      ) : (
        <div className="space-y-5">
          <PrizeTextFields form={form} locked={locked} />
          <PromoPrizeFields
            form={form}
            locked={locked}
            terms={contest?.prizePromoTerms}
          />
          <ProductPrizeFields form={form} locked={locked} kind="albums" />
          <ProductPrizeFields form={form} locked={locked} kind="markers" />
          <div className="space-y-2">
            <Label htmlFor="contest-winnersCount">Число победителей</Label>
            <Input
              id="contest-winnersCount"
              type="number"
              min={1}
              max={100}
              readOnly={locked}
              {...form.register("winnersCount")}
              aria-invalid={Boolean(form.formState.errors.winnersCount)}
            />
            <Error message={form.formState.errors.winnersCount?.message} />
          </div>
        </div>
      )}
      <div className="space-y-4 border-t pt-6">
        <Controller
          control={form.control}
          name="hasParticipationPrize"
          render={({ field }) => (
            <Label className="flex min-h-11 items-start gap-3">
              <Checkbox
                checked={field.value}
                disabled={locked}
                className="mt-0.5"
                onCheckedChange={(checked) => {
                  field.onChange(checked === true);
                }}
              />
              <span>
                <span className="block font-semibold">Приз за участие</span>
              </span>
            </Label>
          )}
        />
        {participation && (
          <PromoPrizeFields
            form={form}
            locked={locked}
            participation
            terms={contest?.participationPromoTerms}
          />
        )}
      </div>
      <PrizePreview form={form} />
    </div>
  );
}

function PlaceFields({ form, locked, contest }: Props) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "prizePlaces",
  });
  const places = useWatch({ control: form.control, name: "prizePlaces" });
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {fields.map((field, index) => (
          <li key={field.id} className="relative rounded-xl border">
            <details className="group" open={index === 0}>
              <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 rounded-xl p-4 pr-14 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <ContestPlaceIcon place={index + 1} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    {index + 1}-е место
                  </span>
                  <span className="mt-1 block font-semibold break-words">
                    {places[index]?.prize || "Укажите приз"}
                  </span>
                  {form.formState.errors.prizePlaces?.[index] && (
                    <span className="mt-1 block text-xs font-normal text-destructive">
                      Проверьте настройки приза
                    </span>
                  )}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="space-y-5 border-t p-4 sm:p-5">
                <PrizeTextFields
                  form={form}
                  locked={locked}
                  placeIndex={index}
                />
                <ProductPrizeFields
                  form={form}
                  locked={locked}
                  placeIndex={index}
                  kind="albums"
                />
                <ProductPrizeFields
                  form={form}
                  locked={locked}
                  placeIndex={index}
                  kind="markers"
                />
                <PromoPrizeFields
                  form={form}
                  locked={locked}
                  placeIndex={index}
                  terms={contest?.prizePlaces[index]?.prizePromoTerms}
                />
              </div>
            </details>
            {!locked && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute top-4 right-2 size-11 text-muted-foreground"
                disabled={fields.length === 1}
                aria-label={`Убрать ${index + 1}-е место`}
                onClick={() => remove(index)}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ol>
      <Error message={form.formState.errors.prizePlaces?.root?.message} />
      {!locked && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={fields.length >= 100}
          onClick={() => append(defaultPrizePlace())}
        >
          <Plus aria-hidden="true" className="size-4" />
          Добавить место
        </Button>
      )}
    </div>
  );
}

function PrizeTextFields({
  form,
  locked,
  placeIndex,
}: Pick<Props, "form" | "locked"> & { placeIndex?: number }) {
  const title =
    placeIndex === undefined
      ? "prize"
      : (`prizePlaces.${placeIndex}.prize` as const);
  const detail =
    placeIndex === undefined
      ? "prizeDetail"
      : (`prizePlaces.${placeIndex}.prizeDetail` as const);
  const errors =
    placeIndex === undefined
      ? form.formState.errors
      : form.formState.errors.prizePlaces?.[placeIndex];
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`contest-${title}`}>Приз</Label>
        <Input
          id={`contest-${title}`}
          maxLength={200}
          readOnly={locked}
          aria-invalid={Boolean(errors?.prize)}
          {...form.register(title)}
        />
        <Error message={errors?.prize?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`contest-${detail}`}>
          Описание приза{placeIndex !== undefined ? " · необязательно" : ""}
        </Label>
        <Textarea
          id={`contest-${detail}`}
          maxLength={1000}
          rows={2}
          readOnly={locked}
          {...form.register(detail)}
        />
        <Error message={errors?.prizeDetail?.message} />
      </div>
    </>
  );
}
function PrizePreview({ form }: { form: Props["form"] }) {
  const values = useWatch({ control: form.control });
  const { promoCodes } = usePromoCodes();
  const presentation = toPrizePresentation(
    { ...form.getValues(), ...values } as ContestFormValues,
    (id) => {
      const promo = promoCodes.find((item) => item.id === id);
      return promo
        ? `Промокод на скидку ${formatPromoCodeValue(promo)}`
        : "Личный промокод";
    },
  );
  return (
    <section
      aria-label="Предпросмотр призов"
      className={`${comfortaa.variable} ${nunito.variable} rounded-xl bg-muted/30 p-5`}
      style={
        {
          "--font-heading": "var(--font-comfortaa)",
          "--font-sans": "var(--font-nunito)",
        } as CSSProperties
      }
    >
      <h3 className="mb-5 text-sm font-semibold">Как на сайте</h3>
      <ContestPrizeList prizes={presentation} />
    </section>
  );
}
function Error({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
