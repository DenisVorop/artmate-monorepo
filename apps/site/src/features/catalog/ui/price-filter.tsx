"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input, Label } from "@/shared/ui";
import { useCatalog } from "../lib/catalog-provider";
import { matchesCatalogCategory } from "../lib/catalog-state";
import { priceFilterSchema, type PriceFilterValues } from "../lib/price-filter-form";

export function PriceFilter() {
  const id = useId();
  const { minPrice, maxPrice, products, categoryId, category, updateFilters } = useCatalog();
  const prices = products
    .filter((product) => matchesCatalogCategory(product, { categoryId, category }))
    .map((product) => product.price);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PriceFilterValues>({
    resolver: zodResolver(priceFilterSchema),
    values: {
      min: minPrice === undefined ? "" : String(minPrice),
      max: maxPrice === undefined ? "" : String(maxPrice),
    },
  });
  const submit = handleSubmit(({ min, max }) =>
    updateFilters({
      minPrice: min.trim() ? Number(min) : undefined,
      maxPrice: max.trim() ? Number(max) : undefined,
    }),
  );
  const error = errors.min?.message || errors.max?.message;
  return (
    <form
      onSubmit={submit}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) void submit();
      }}
      noValidate
    >
      <div className="grid grid-cols-2 gap-2">
        {(["min", "max"] as const).map((name) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={`${id}-${name}`} className="text-xs text-muted-foreground">
              {name === "min" ? "От" : "До"}
            </Label>
            <Input
              id={`${id}-${name}`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              {...register(name)}
              placeholder={
                prices.length
                  ? String(name === "min" ? Math.min(...prices) : Math.max(...prices))
                  : undefined
              }
              aria-invalid={Boolean(errors[name])}
              aria-describedby={error ? `${id}-error` : undefined}
              className="h-10"
            />
          </div>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <button type="submit" hidden>
        Применить цену
      </button>
    </form>
  );
}
