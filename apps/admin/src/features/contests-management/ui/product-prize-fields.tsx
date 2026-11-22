"use client";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useProducts } from "@/entities/products";
import { Button, Checkbox, Input, Label } from "@/shared/ui";
import { productPrizeTitle, type ContestFormValues } from "../lib/form-values";

export function ProductPrizeFields({
  form,
  locked,
  placeIndex,
  kind,
}: {
  form: UseFormReturn<ContestFormValues>;
  locked: boolean;
  placeIndex?: number;
  kind: "albums" | "markers";
}) {
  const { products, isPending, isError, refetch } = useProducts();
  const marker = kind === "markers";
  const enabledField = marker ? "hasMarkerPrize" : "hasAlbumPrize";
  const quantityField = marker ? "prizeMarkerQuantity" : "prizeAlbumQuantity";
  const idsField = marker ? "prizeMarkerIds" : "prizeAlbumIds";
  const enabledName =
    placeIndex === undefined
      ? enabledField
      : (`prizePlaces.${placeIndex}.${enabledField}` as const);
  const quantityName =
    placeIndex === undefined
      ? quantityField
      : (`prizePlaces.${placeIndex}.${quantityField}` as const);
  const idsName =
    placeIndex === undefined
      ? idsField
      : (`prizePlaces.${placeIndex}.${idsField}` as const);
  const quantityRegistration = form.register(quantityName);
  const enabled = useWatch({ control: form.control, name: enabledName });
  const errors =
    placeIndex === undefined
      ? form.formState.errors
      : form.formState.errors.prizePlaces?.[placeIndex];
  const quantityId =
    placeIndex === undefined
      ? `contest-${kind}-quantity`
      : `contest-place-${placeIndex}-${kind}-quantity`;
  const choices = products.filter(
    (product) =>
      product.status === "published" &&
      (marker
        ? product.category?.slug === "markery"
        : product.category?.slug !== "markery") &&
      product.isOzonDeliveryAvailable,
  );
  return (
    <div className="space-y-4 border-t pt-5">
      <Controller
        control={form.control}
        name={enabledName}
        render={({ field }) => (
          <Label className="min-h-11">
            <Checkbox
              checked={field.value}
              onCheckedChange={(value) => {
                const before = {
                  ...(placeIndex === undefined
                    ? form.getValues()
                    : form.getValues(`prizePlaces.${placeIndex}`)),
                };
                field.onChange(value === true);
                if (!before.prize || before.prize === productPrizeTitle(before))
                  form.setValue(
                    placeIndex === undefined
                      ? "prize"
                      : `prizePlaces.${placeIndex}.prize`,
                    productPrizeTitle({
                      ...before,
                      [enabledField]: value === true,
                    }),
                    { shouldDirty: true },
                  );
              }}
              disabled={locked}
            />
            {marker ? "Маркеры" : "Альбомы"}
          </Label>
        )}
      />
      {enabled && (
        <>
          <div className="space-y-2">
            <Label htmlFor={quantityId}>
              {marker
                ? "Наборов каждому победителю"
                : "Альбомов каждому победителю"}
            </Label>
            <Input
              id={quantityId}
              type="number"
              min={1}
              max={20}
              readOnly={locked}
              {...quantityRegistration}
              onChange={(event) => {
                const before = {
                  ...(placeIndex === undefined
                    ? form.getValues()
                    : form.getValues(`prizePlaces.${placeIndex}`)),
                };
                void quantityRegistration.onChange(event);
                const quantity = Number(event.target.value);
                if (
                  before.prize === productPrizeTitle(before) &&
                  Number.isInteger(quantity) &&
                  quantity >= 1 &&
                  quantity <= 20
                )
                  form.setValue(
                    placeIndex === undefined
                      ? "prize"
                      : `prizePlaces.${placeIndex}.prize`,
                    productPrizeTitle({ ...before, [quantityField]: quantity }),
                    { shouldDirty: true },
                  );
              }}
            />
            {errors?.[quantityField] && (
              <p role="alert" className="text-sm text-destructive">
                {errors?.[quantityField].message}
              </p>
            )}
          </div>
          <p className="font-medium">
            {marker ? "Наборы маркеров на выбор" : "Альбомы на выбор"}
          </p>
          {isPending ? (
            <p role="status">Загружаем товары…</p>
          ) : isError ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
            >
              Загрузить товары ещё раз
            </Button>
          ) : (
            <Controller
              control={form.control}
              name={idsName}
              render={({ field }) => (
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
                  {choices.length ? (
                    choices.map((product) => (
                      <Label key={product.id} className="min-h-11 py-2">
                        <Checkbox
                          checked={field.value.includes(product.id)}
                          disabled={locked}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, product.id]
                                : field.value.filter((id) => id !== product.id),
                            )
                          }
                        />
                        <span>
                          {product.title}
                          {product.isOutOfStock ? " · нет в наличии" : ""}
                        </span>
                      </Label>
                    ))
                  ) : (
                    <p>Нет товаров с доставкой Ozon</p>
                  )}
                </div>
              )}
            />
          )}
          {errors?.[idsField] && (
            <p role="alert" className="text-sm text-destructive">
              {errors?.[idsField].message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
