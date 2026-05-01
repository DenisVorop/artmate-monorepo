"use client";

import { Pencil } from "lucide-react";

import {
  formatProductDate,
  formatProductPrice,
  getProductPrimaryImage,
  getProductStatusBadgeVariant,
  getProductStatusLabel,
  type Product,
} from "@/entities/products";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

import { ProductImagePreview } from "./product-image-preview";

type ProductsTableProps = {
  readonly onSelectProduct: (productId: string) => void;
  readonly products: readonly Product[];
  readonly selectedProductId: string | null;
};

export function ProductsTable({
  onSelectProduct,
  products,
  selectedProductId,
}: ProductsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Товары</CardTitle>
        <CardDescription>
          Список товаров каталога. Редактирование открывается в карточке ниже.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Фото</TableHead>
              <TableHead>Товар</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Изобр.</TableHead>
              <TableHead>Обновлен</TableHead>
              <TableHead className="text-right">Редакт.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const primaryImage = getProductPrimaryImage(product);
              const isSelected = product.id === selectedProductId;

              return (
                <TableRow
                  data-state={isSelected ? "selected" : undefined}
                  key={product.id}
                >
                  <TableCell>
                    <ProductImagePreview
                      className="size-10 rounded-md"
                      imageUrl={primaryImage?.url}
                      label={primaryImage?.alt ?? product.title}
                    />
                  </TableCell>
                  <TableCell className="min-w-64 whitespace-normal">
                    <div className="grid gap-0.5">
                      <span className="font-medium">{product.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {product.slug}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.category?.title ?? "Без категории"}
                  </TableCell>
                  <TableCell>{formatProductPrice(product)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={getProductStatusBadgeVariant(product.status)}>
                        {getProductStatusLabel(product.status)}
                      </Badge>
                      {product.isHit ? (
                        <Badge variant="secondary">Хит</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{product.images.length}</TableCell>
                  <TableCell>{formatProductDate(product.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      aria-label={`Редактировать товар ${product.title}`}
                      onClick={() => onSelectProduct(product.id)}
                      size="icon-sm"
                      type="button"
                      variant={isSelected ? "secondary" : "outline"}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
