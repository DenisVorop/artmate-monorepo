import type { Product, ProductStatus, ProductTag } from "../model";

const productStatusLabels: Record<ProductStatus, string> = {
  draft: "Черновик",
  published: "Опубликован",
  archived: "Архив",
};

export function getProductStatusLabel(status: ProductStatus) {
  return productStatusLabels[status];
}

const productTagGroupLabels: Record<ProductTag["group"], string> = {
  audience: "Аудитория",
  difficulty: "Сложность",
  format: "Формат",
  mood: "Настроение",
  theme: "Тема",
};

export function getProductTagGroupLabel(group: ProductTag["group"]) {
  return productTagGroupLabels[group];
}

export function getProductStatusBadgeVariant(
  status: ProductStatus,
): "default" | "destructive" | "outline" | "secondary" {
  switch (status) {
    case "published":
      return "default";
    case "archived":
      return "outline";
    case "draft":
      return "secondary";
  }
}

export function getProductPrimaryImage(product: Product) {
  return product.images[0];
}

export function formatProductPrice(product: Product) {
  const amount = product.price / 100;

  return new Intl.NumberFormat("ru-RU", {
    currency: product.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export function formatProductDate(value: string | undefined) {
  if (!value) {
    return "Нет даты";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Нет даты";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
