"use client";

import type { Product } from "@/entities/products";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import { ProductsTable } from "./products-table";

type ProductsListProps = {
  readonly products: readonly Product[];
};

export function ProductsList({ products }: ProductsListProps) {
  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Каталог</CardTitle>
          <CardDescription>Локальные товары пока не созданы</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Добавьте первый товар через форму выше
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <ProductsTable products={products} />
    </div>
  );
}
