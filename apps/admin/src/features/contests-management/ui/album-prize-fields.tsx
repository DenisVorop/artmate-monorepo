"use client";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useProducts } from "@/entities/products";
import { Button, Checkbox, Input, Label } from "@/shared/ui";
import type { ContestFormValues } from "../lib/form-values";

export function AlbumPrizeFields({
  form,
  locked,
}: {
  form: UseFormReturn<ContestFormValues>;
  locked: boolean;
}) {
  const { products, isPending, isError, refetch } = useProducts();
  const enabled = useWatch({ control: form.control, name: "hasAlbumPrize" });
  const albums = products.filter(
    (product) =>
      product.status === "published" &&
      product.category?.slug !== "markery" &&
      product.isOzonDeliveryAvailable,
  );
  return (
    <div className="space-y-4 border-t pt-5">
      <Controller
        control={form.control}
        name="hasAlbumPrize"
        render={({ field }) => (
          <Label className="min-h-11">
            <Checkbox
              checked={field.value}
              onCheckedChange={(value) => field.onChange(value === true)}
              disabled={locked}
            />
            Выдавать альбомы победителям
          </Label>
        )}
      />
      {enabled && (
        <>
          <div className="space-y-2">
            <Label htmlFor="contest-album-quantity">
              Альбомов каждому победителю
            </Label>
            <Input
              id="contest-album-quantity"
              type="number"
              min={1}
              max={20}
              readOnly={locked}
              {...form.register("prizeAlbumQuantity")}
            />
            {form.formState.errors.prizeAlbumQuantity && (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.prizeAlbumQuantity.message}
              </p>
            )}
          </div>
          <p className="font-medium">Альбомы на выбор</p>
          {isPending ? (
            <p role="status">Загружаем альбомы…</p>
          ) : isError ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
            >
              Загрузить альбомы ещё раз
            </Button>
          ) : (
            <Controller
              control={form.control}
              name="prizeAlbumIds"
              render={({ field }) => (
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
                  {albums.length ? (
                    albums.map((album) => (
                      <Label key={album.id} className="min-h-11 py-2">
                        <Checkbox
                          checked={field.value.includes(album.id)}
                          disabled={locked}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, album.id]
                                : field.value.filter((id) => id !== album.id),
                            )
                          }
                        />
                        <span>
                          {album.title}
                          {album.isOutOfStock ? " · нет в наличии" : ""}
                        </span>
                      </Label>
                    ))
                  ) : (
                    <p>Нет альбомов с доставкой Ozon</p>
                  )}
                </div>
              )}
            />
          )}
          {form.formState.errors.prizeAlbumIds && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.prizeAlbumIds.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
