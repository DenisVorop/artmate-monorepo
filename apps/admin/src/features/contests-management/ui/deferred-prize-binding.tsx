"use client";
import { useState } from "react";
import { useProducts } from "@/entities/products";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";

export function DeferredPrizeBinding({
  place,
  boundProductId,
  needsSave,
  onBindProduct,
}: {
  place: number;
  boundProductId: string | null;
  needsSave: boolean;
  onBindProduct: (place: number, productId: string) => void;
}) {
  const { products, isPending, isError, refetch } = useProducts();
  const [productId, setProductId] = useState("");
  if (boundProductId) {
    const product = products.find((item) => item.id === boundProductId);
    return (
      <p className="text-sm text-muted-foreground">
        {product ? `Привязан товар «${product.title}»` : "Товар привязан"}
      </p>
    );
  }

  const choices = products.filter(
    (product) =>
      product.status === "published" &&
      product.isOzonDeliveryAvailable &&
      product.images.some((image) => image.url),
  );
  const selected = choices.find((product) => product.id === productId);
  const fieldId = `contest-place-${place}-binding-product`;
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>Товар для выдачи</Label>
      <Select
        value={selected?.id ?? ""}
        onValueChange={setProductId}
        disabled={needsSave || isPending || isError || choices.length === 0}
      >
        <SelectTrigger id={fieldId} className="w-full">
          <SelectValue placeholder="Выберите товар" />
        </SelectTrigger>
        <SelectContent position="popper">
          {choices.map((product) => (
            <SelectItem key={product.id} value={product.id}>
              {product.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && <p role="status">Загружаем товары…</p>}
      {isError && (
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          Загрузить товары ещё раз
        </Button>
      )}
      {!isPending && !isError && choices.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Нет опубликованных товаров с доставкой Ozon.
        </p>
      )}
      {needsSave && (
        <p className="text-sm text-muted-foreground">
          Сначала сохраните изменения конкурса.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={needsSave || !selected}
        onClick={() => {
          if (selected) onBindProduct(place, selected.id);
        }}
      >
        Привязать товар
      </Button>
    </div>
  );
}
