import "dotenv/config";

import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
  ProductStatus as PrismaProductStatus,
} from "../generated/prisma/client";
import { OZON_SELLER_API_URL } from "../ozon/ozon.constants";

type OzonProductListItem = {
  archived?: boolean;
  offer_id?: string;
  product_id?: number | string;
};

type OzonProductListResponse = {
  result?: {
    items?: OzonProductListItem[];
    last_id?: string;
    total?: number;
  };
};

type OzonProductInfoItem = {
  currency_code?: string;
  id?: number | string;
  images?: string[];
  is_archived?: boolean;
  is_autoarchived?: boolean;
  name?: string;
  min_price?: string;
  offer_id?: string;
  old_price?: string;
  price?: string;
  primary_image?: string[] | string;
  sku?: number | string;
  statuses?: {
    status?: string;
    status_description?: string;
    status_name?: string;
  };
};

type OzonProductInfoListResponse = {
  items?: OzonProductInfoItem[];
};

type ImportSummary = {
  archived: number;
  created: number;
  images: number;
  skipped: number;
  totalFromOzon: number;
  updated: number;
};

const ozonProductListLimit = 1000;
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getRequiredEnv("DATABASE_URL"),
  }),
});

async function main() {
  const products = await loadOzonProducts();
  const summary = await importProducts(products);

  console.log(
    JSON.stringify(
      {
        ...summary,
        note: "Non-archived Ozon products were imported as local drafts.",
      },
      null,
      2,
    ),
  );
}

async function loadOzonProducts() {
  const productRefs = await loadOzonProductRefs();
  const productIds = productRefs
    .map((product) => parseId(product.product_id))
    .filter((productId): productId is string => Boolean(productId));
  const products: OzonProductInfoItem[] = [];

  for (const productIdChunk of chunk(productIds, ozonProductListLimit)) {
    const response = await requestOzon<OzonProductInfoListResponse>(
      "/v3/product/info/list",
      {
        product_id: productIdChunk,
      },
    );

    products.push(...(response.items ?? []));
  }

  return products;
}

async function loadOzonProductRefs() {
  const products: OzonProductListItem[] = [];
  let lastId = "";

  while (true) {
    const response = await requestOzon<OzonProductListResponse>(
      "/v3/product/list",
      {
        filter: {
          visibility: "ALL",
        },
        last_id: lastId,
        limit: ozonProductListLimit,
      },
    );
    const result = response.result;
    const items = result?.items ?? [];
    const nextLastId = result?.last_id ?? "";

    products.push(...items);

    if (items.length === 0 || !nextLastId || nextLastId === lastId) {
      return products;
    }

    lastId = nextLastId;
  }
}

async function importProducts(products: readonly OzonProductInfoItem[]) {
  const summary: ImportSummary = {
    archived: 0,
    created: 0,
    images: 0,
    skipped: 0,
    totalFromOzon: products.length,
    updated: 0,
  };

  for (const product of products) {
    const ozonProductId = parseId(product.id);

    if (!ozonProductId) {
      summary.skipped += 1;
      continue;
    }

    const title = parseTitle(product);
    const slug = buildProductSlug(product, ozonProductId);
    const status = getProductStatus(product);
    const imageUrls = getImageUrls(product);
    const existingProduct = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    await prisma.$transaction(async (transaction) => {
      const localProduct = existingProduct
        ? await transaction.product.update({
            where: { id: existingProduct.id },
            data: {
              currency: getCurrency(product.currency_code),
              description: getProductDescription(product, ozonProductId),
              price: parsePrice(product.price ?? product.min_price),
              status,
              title,
            },
          })
        : await transaction.product.create({
            data: {
              currency: getCurrency(product.currency_code),
              description: getProductDescription(product, ozonProductId),
              price: parsePrice(product.price ?? product.min_price),
              slug,
              status,
              title,
            },
          });

      await transaction.productImage.deleteMany({
        where: {
          productId: localProduct.id,
        },
      });

      if (imageUrls.length > 0) {
        await transaction.productImage.createMany({
          data: imageUrls.map((url, index) => ({
            alt: title,
            id: randomBytes(16).toString("hex"),
            productId: localProduct.id,
            sortOrder: index,
            url,
          })),
        });
      }
    });

    if (existingProduct) {
      summary.updated += 1;
    } else {
      summary.created += 1;
    }

    if (status === PrismaProductStatus.ARCHIVED) {
      summary.archived += 1;
    }

    summary.images += imageUrls.length;
  }

  return summary;
}

async function requestOzon<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${OZON_SELLER_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Api-Key": getRequiredEnv("OZON_API_KEY"),
      "Client-Id": getRequiredEnv("OZON_CLIENT_ID"),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Ozon Seller API request failed with status ${response.status}: ${await getResponseText(response)}`,
    );
  }

  return (await response.json()) as T;
}

function parseTitle(product: OzonProductInfoItem) {
  const title =
    product.name?.trim() ??
    product.offer_id?.trim() ??
    `Ozon product ${parseId(product.id) ?? "unknown"}`;

  return title.slice(0, 220).trim();
}

function buildProductSlug(product: OzonProductInfoItem, ozonProductId: string) {
  const offerId = product.offer_id?.trim();
  const source = offerId && offerId.length > 0 ? offerId : ozonProductId;
  const slugPart = slugify(source);

  return `ozon-${slugPart}-${ozonProductId}`.slice(0, 180);
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "product";
}

function getProductDescription(
  product: OzonProductInfoItem,
  ozonProductId: string,
) {
  return [
    "Импортировано из Ozon.",
    `Ozon product_id: ${ozonProductId}`,
    product.sku ? `Ozon SKU: ${product.sku}` : undefined,
    product.offer_id ? `Ozon offer_id: ${product.offer_id}` : undefined,
    product.statuses?.status_name
      ? `Ozon status: ${product.statuses.status_name}`
      : undefined,
    product.statuses?.status_description
      ? `Ozon status description: ${product.statuses.status_description}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function getProductStatus(product: OzonProductInfoItem) {
  if (product.is_archived || product.is_autoarchived) {
    return PrismaProductStatus.ARCHIVED;
  }

  return PrismaProductStatus.DRAFT;
}

function parsePrice(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function getCurrency(value: string | undefined) {
  return value === "RUB" ? "RUB" : "RUB";
}

function getImageUrls(product: OzonProductInfoItem) {
  const primaryImages = Array.isArray(product.primary_image)
    ? product.primary_image
    : product.primary_image
      ? [product.primary_image]
      : [];
  const images = [...primaryImages, ...(product.images ?? [])];
  const urls = images
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  return Array.from(new Set(urls));
}

function parseId(value: number | string | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const id = String(value).trim();

  return id.length > 0 ? id : undefined;
}

function chunk<T>(items: readonly T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

async function getResponseText(response: Response) {
  const text = await response.text();

  return text.length > 1000 ? `${text.slice(0, 1000)}...` : text;
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
