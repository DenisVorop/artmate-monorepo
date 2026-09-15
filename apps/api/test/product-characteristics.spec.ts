import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ValidationPipe,
  type ArgumentMetadata,
} from "@nestjs/common";

import { ProductStatus } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import {
  CreateProductRequestDTO,
  ProductDTO,
  UpdateProductRequestDTO,
} from "../src/products/dto";
import { ProductsService } from "../src/products/products.service";

const baseInput = { title: "Маркеры", slug: "markers", priceRub: 1990 };
const characteristics = [
  { name: "Количество цветов", value: "168", isHighlighted: true },
  { name: "Наконечник", value: "Кисть", isHighlighted: false },
];
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

function transform<T extends object>(type: new () => T, value: unknown) {
  return pipe.transform(value, {
    metatype: type,
    type: "body",
  } as ArgumentMetadata) as Promise<T>;
}

function createHarness() {
  const writes: Array<{ operation: string; data: Record<string, unknown> }> =
    [];
  const reads: unknown[] = [];
  let product = {
    id: "product-1",
    slug: "markers",
    title: "Маркеры",
    description: null,
    usageInstructions: null as string | null,
    characteristics: [] as Array<
      (typeof characteristics)[number] & {
        id: string;
        productId: string;
        sortOrder: number;
      }
    >,
    categoryId: null,
    category: null,
    coloringCollection: null,
    status: ProductStatus.DRAFT,
    isHit: false,
    isOutOfStock: false,
    isOzonDeliveryAvailable: true,
    price: 199000,
    currency: "RUB",
    images: [],
    tags: [],
    createdAt: new Date("2026-09-16T00:00:00Z"),
    updatedAt: new Date("2026-09-16T00:00:00Z"),
  };

  function mutate(
    operation: string,
    { data }: { data: Record<string, unknown> },
  ) {
    writes.push({ operation, data });
    const nested = data.characteristics as
      | {
          create: Array<
            (typeof characteristics)[number] & { sortOrder: number }
          >;
        }
      | undefined;
    product = {
      ...product,
      ...Object.fromEntries(
        Object.entries(data).filter(([key]) => key !== "characteristics"),
      ),
      characteristics: nested
        ? nested.create.map((item) => ({
            ...item,
            id: `row-${item.sortOrder}`,
            productId: product.id,
          }))
        : product.characteristics,
    };
    return Promise.resolve(product);
  }

  const prisma = {
    product: {
      create: (args: { data: Record<string, unknown> }) =>
        mutate("create", args),
      update: (args: { data: Record<string, unknown> }) =>
        mutate("update", args),
      findUnique: async (args: unknown) => {
        reads.push(args);
        return product;
      },
      findFirst: async (args: unknown) => {
        reads.push(args);
        return product;
      },
      findMany: async (args: unknown) => {
        reads.push(args);
        return [product];
      },
    },
  };

  return {
    service: new ProductsService(prisma as unknown as PrismaService),
    writes,
    reads,
  };
}

describe("Product characteristics and instructions", () => {
  it("creates ordered trimmed rows and instructions in the same product write", async () => {
    const { service, writes } = createHarness();
    const result = await service.createProduct({
      ...baseInput,
      characteristics: [
        {
          ...characteristics[0]!,
          name: "  Количество цветов  ",
          value: " 168 ",
        },
        characteristics[1]!,
      ],
      usageInstructions:
        "  Встряхните маркер.\nЗакройте после использования.  ",
    });

    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0]?.data.characteristics, {
      create: characteristics.map((row, sortOrder) => ({ ...row, sortOrder })),
    });
    assert.equal(
      writes[0]?.data.usageInstructions,
      "Встряхните маркер.\nЗакройте после использования.",
    );
    assert.deepEqual(result.characteristics, characteristics);
    assert.equal(result.price, 199000);
    assert.equal(result.priceRub, 1990);
    assert.ok(!Object.hasOwn(result.characteristics[0]!, "id"));
    assert.ok(!Object.hasOwn(result.characteristics[0]!, "sortOrder"));
    await transform(ProductDTO, result);
  });

  it("defaults a new product to no characteristics or usage instructions", async () => {
    const { service, writes } = createHarness();
    const result = await service.createProduct(baseInput);
    assert.deepEqual(result.characteristics, []);
    assert.equal(result.usageInstructions, undefined);
    assert.deepEqual(writes[0]?.data.characteristics, { create: [] });
    assert.equal(writes[0]?.data.usageInstructions, null);
  });

  it("updates and reorders the complete array atomically alongside the title", async () => {
    const { service, writes } = createHarness();
    await service.createProduct({ ...baseInput, characteristics });
    const replacement = [
      {
        ...characteristics[1]!,
        value: "Нейлоновая кисть",
        isHighlighted: true,
      },
      characteristics[0]!,
    ];
    const result = await service.updateProduct("product-1", {
      title: "Акриловые маркеры",
      characteristics: replacement,
    });
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[1]?.data, {
      title: "Акриловые маркеры",
      characteristics: {
        deleteMany: {},
        create: replacement.map((row, sortOrder) => ({ ...row, sortOrder })),
      },
    });
    assert.deepEqual(result.characteristics, replacement);
  });

  it("preserves omitted fields and explicitly clears an empty array and blank instruction", async () => {
    const { service, writes } = createHarness();
    await service.createProduct({
      ...baseInput,
      characteristics,
      usageInstructions: "Встряхните.",
    });
    const preserved = await service.updateProduct("product-1", {
      title: "Новый заголовок",
    });
    assert.deepEqual(writes[1]?.data, { title: "Новый заголовок" });
    assert.deepEqual(preserved.characteristics, characteristics);
    assert.equal(preserved.usageInstructions, "Встряхните.");
    const cleared = await service.updateProduct("product-1", {
      characteristics: [],
      usageInstructions: " \n ",
    });
    assert.deepEqual(writes[2]?.data, {
      characteristics: { deleteMany: {}, create: [] },
      usageInstructions: null,
    });
    assert.deepEqual(cleared.characteristics, []);
    assert.equal(cleared.usageInstructions, undefined);
  });

  it("includes ordered characteristics on public and admin reads", async () => {
    const { service, reads } = createHarness();
    await service.createProduct({
      ...baseInput,
      characteristics,
      usageInstructions: "Встряхните.",
    });
    const results = [
      await service.getAdminProduct("product-1"),
      await service.getPublishedProductBySlug("markers"),
      ...(await service.getAdminProducts()),
      ...(await service.getPublishedProducts()),
    ];
    assert.equal(results.length, 4);
    for (const result of results) {
      assert.deepEqual(result.characteristics, characteristics);
      assert.equal(result.usageInstructions, "Встряхните.");
    }
    for (const read of reads) {
      assert.deepEqual(
        (read as { include: { characteristics: unknown } }).include
          .characteristics,
        { orderBy: { sortOrder: "asc" } },
      );
    }
  });

  it("validates and trims the HTTP create and update contracts", async () => {
    for (const type of [CreateProductRequestDTO, UpdateProductRequestDTO]) {
      const dto = await transform(type, {
        ...baseInput,
        characteristics: [
          { name: " Цвета ", value: " 168 ", isHighlighted: false },
        ],
        usageInstructions: " Инструкция\n ",
      });
      assert.deepEqual(JSON.parse(JSON.stringify(dto.characteristics)), [
        { name: "Цвета", value: "168", isHighlighted: false },
      ]);
      assert.equal(dto.usageInstructions, "Инструкция");
      const omitted = await transform(type, baseInput);
      assert.equal(omitted.characteristics, undefined);
      assert.equal(omitted.usageInstructions, undefined);
      assert.deepEqual(
        (
          await transform(type, {
            ...baseInput,
            characteristics: [],
            usageInstructions: " ",
          })
        ).characteristics,
        [],
      );
    }
  });

  const invalidCharacteristics: unknown[] = [
    null,
    "string",
    {},
    [null],
    ["string"],
    [[]],
    [{ name: "", value: "168", isHighlighted: false }],
    [{ name: " \n ", value: "168", isHighlighted: false }],
    [{ name: "Цвета", value: " \n ", isHighlighted: false }],
    [{ name: "a".repeat(81), value: "168", isHighlighted: false }],
    [{ name: "Цвета", value: "a".repeat(501), isHighlighted: false }],
    [{ name: "<b>Цвета</b>", value: "168", isHighlighted: false }],
    [
      {
        name: "Цвета",
        value: "<script>alert(1)</script>",
        isHighlighted: false,
      },
    ],
    [{ name: "Цвета", value: "168", isHighlighted: "false" }],
    [{ name: "Цвета", value: 168, isHighlighted: false }],
    [{ name: "Цвета", value: "168" }],
    [
      { name: " ЦВЕТА ", value: "168", isHighlighted: true },
      { name: "цвета", value: "169", isHighlighted: false },
    ],
    Array.from({ length: 3 }, (_, index) => ({
      name: `Имя ${index}`,
      value: "168",
      isHighlighted: true,
    })),
    Array.from({ length: 31 }, (_, index) => ({
      name: `Имя ${index}`,
      value: "168",
      isHighlighted: false,
    })),
  ];

  for (const [index, invalid] of invalidCharacteristics.entries()) {
    it(`rejects invalid characteristic payload ${index + 1} before any write through DTO and service`, async () => {
      for (const type of [CreateProductRequestDTO, UpdateProductRequestDTO]) {
        await assert.rejects(
          transform(type, { ...baseInput, characteristics: invalid }),
          BadRequestException,
        );
      }
      const { service, writes } = createHarness();
      await assert.rejects(
        service.createProduct({
          ...baseInput,
          characteristics: invalid,
        } as CreateProductRequestDTO),
        BadRequestException,
      );
      await assert.rejects(
        service.updateProduct("product-1", {
          characteristics: invalid,
        } as UpdateProductRequestDTO),
        BadRequestException,
      );
      assert.equal(writes.length, 0);
    });
  }

  for (const [index, invalid] of [
    null,
    42,
    [],
    {},
    "a".repeat(6001),
    "<p>Инструкция</p>",
  ].entries()) {
    it(`rejects invalid instruction payload ${index + 1} before any write through DTO and service`, async () => {
      for (const type of [CreateProductRequestDTO, UpdateProductRequestDTO]) {
        await assert.rejects(
          transform(type, { ...baseInput, usageInstructions: invalid }),
          BadRequestException,
        );
      }
      const { service, writes } = createHarness();
      await assert.rejects(
        service.createProduct({
          ...baseInput,
          usageInstructions: invalid,
        } as CreateProductRequestDTO),
        BadRequestException,
      );
      await assert.rejects(
        service.updateProduct("product-1", {
          usageInstructions: invalid,
        } as UpdateProductRequestDTO),
        BadRequestException,
      );
      assert.equal(writes.length, 0);
    });
  }

  it("accepts maximum lengths, 30 distinct rows and 2 highlights", async () => {
    const { service } = createHarness();
    const rows = Array.from({ length: 30 }, (_, index) => ({
      name: `${index}`.padEnd(80, "a"),
      value: "я".repeat(500),
      isHighlighted: index < 2,
    }));
    const dto = await transform(CreateProductRequestDTO, {
      ...baseInput,
      characteristics: rows,
      usageInstructions: "я".repeat(6000),
    });
    const result = await service.createProduct(dto);
    assert.equal(result.characteristics.length, 30);
    assert.equal(result.usageInstructions?.length, 6000);
  });

  it("does not allow clients to set internal row IDs, product IDs or positions", async () => {
    for (const field of ["id", "productId", "sortOrder"]) {
      await assert.rejects(
        transform(UpdateProductRequestDTO, {
          characteristics: [{ ...characteristics[0], [field]: "other" }],
        }),
        BadRequestException,
      );
    }
  });
});
