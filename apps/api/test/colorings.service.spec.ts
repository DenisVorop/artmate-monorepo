import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  GUARDS_METADATA,
  HEADERS_METADATA,
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { DECORATORS } from "@nestjs/swagger";

import {
  ColoringCollectionStatus,
  ColoringStatus,
  Prisma,
  ProductStatus,
  ProductTagGroup,
} from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { AdminColoringsController } from "../src/colorings/colorings.controller";
import { ColoringsService } from "../src/colorings/colorings.service";
import type { ColoringRevisionsService } from "../src/colorings/coloring-revisions.service";
import {
  ColoringDTO,
  CreateColoringRequestDTO,
  UpdateColoringRequestDTO,
} from "../src/colorings/dto";
import { ProductsService } from "../src/products/products.service";
import type { UsersService } from "../src/users/users.service";

const coloringUpdatedAt = "2026-08-28T10:00:00.000Z";

describe("ColoringsService", () => {
  it("creates a draft and maps its collection product and sorted themes", async () => {
    const stored = createStoredColoring();
    const writes: Array<Record<string, unknown>> = [];
    const tx = {
      $queryRaw: async () => [
        {
          expectedColoringCount: 25,
          id: stored.collection.id,
          status: "draft" as const,
        },
      ],
      coloring: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          writes.push(data);
          return { id: stored.id };
        },
        findUnique: async () => stored,
        findMany: async () => [],
      },
      coloringCollection: {
        findUnique: async () => ({ id: stored.collection.id }),
      },
      productTag: {
        findMany: async () => stored.themes.map(({ tag }) => tag),
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    const result = await service.createColoring({
      collectionId: stored.collectionId,
      title: "  Лесные друзья  ",
      description: "  Сюжет с лесными животными  ",
      position: 0,
      themeTagIds: ["theme-animals", "theme-forest"],
    });

    assert.deepEqual(writes, [
      {
        collectionId: "collection-1",
        number: 1,
        title: "Лесные друзья",
        description: "Сюжет с лесными животными",
        position: 0,
        status: ColoringStatus.DRAFT,
        themes: {
          create: [{ tagId: "theme-animals" }, { tagId: "theme-forest" }],
        },
      },
    ]);
    assert.deepEqual(result, {
      id: "coloring-1",
      collectionId: "collection-1",
      number: 1,
      title: "Лесные друзья",
      description: "Сюжет с лесными животными",
      position: 0,
      status: "draft",
      collection: {
        id: "collection-1",
        slug: "mysterious-forest",
        title: "Загадочный лес",
        product: {
          id: "product-1",
          slug: "album-1",
          title: "Альбом 1",
        },
      },
      themes: [
        { id: "theme-animals", slug: "animals", title: "Животные" },
        { id: "theme-forest", slug: "forest", title: "Лес" },
      ],
      createdAt: "2026-08-28T10:00:00.000Z",
      updatedAt: "2026-08-28T10:00:00.000Z",
    });
  });

  it("assigns the smallest available number while the parent collection is locked", async () => {
    const stored = { ...createStoredColoring(), number: 2 };
    let createdNumber: unknown;
    const tx = {
      $queryRaw: async () => [
        {
          expectedColoringCount: 4,
          id: stored.collection.id,
          status: "draft" as const,
        },
      ],
      coloring: {
        findMany: async () => [{ number: 1 }, { number: 3 }],
        create: async ({ data }: { data: { number?: unknown } }) => {
          createdNumber = data.number;
          return { id: stored.id };
        },
        findUnique: async () => stored,
      },
      productTag: { findMany: async () => [] },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await service.createColoring({
      collectionId: stored.collectionId,
      title: "Лесные друзья",
      position: 1,
    });

    assert.equal(createdNumber, 2);
  });

  it("rejects create into an archived collection returned by the SQL lock", async () => {
    let coloringReadCalled = false;
    let coloringCreateCalled = false;
    const tx = {
      $queryRaw: async () => [
        {
          expectedColoringCount: 25,
          id: "collection-1",
          status: "archived" as const,
        },
      ],
      coloring: {
        findMany: async () => {
          coloringReadCalled = true;
          return [];
        },
        create: async () => {
          coloringCreateCalled = true;
        },
      },
      productTag: { findMany: async () => [] },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.createColoring({
        collectionId: "collection-1",
        title: "Лесные друзья",
        position: 0,
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message ===
          "Archived coloring collection cannot receive colorings",
    );
    assert.equal(coloringReadCalled, false);
    assert.equal(coloringCreateCalled, false);
  });

  it("rejects create when the parent collection does not exist", async () => {
    let transactionCalled = false;
    const tx = {
      $queryRaw: async () => [],
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => {
        transactionCalled = true;
        return callback(tx);
      },
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.createColoring({
        collectionId: "missing-collection",
        title: "Лесные друзья",
        position: 0,
      }),
      (error: unknown) =>
        error instanceof NotFoundException &&
        error.message === "Coloring collection not found",
    );
    assert.equal(transactionCalled, true);
  });

  it("rejects create when a requested tag is not a theme", async () => {
    let transactionCalled = false;
    const tx = {
      coloringCollection: {
        findUnique: async () => ({ id: "collection-1" }),
      },
      productTag: {
        findMany: async () => [
          {
            id: "format-a4",
            group: ProductTagGroup.FORMAT,
          },
        ],
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => {
        transactionCalled = true;
        return callback(tx);
      },
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.createColoring({
        collectionId: "collection-1",
        title: "Лесные друзья",
        position: 0,
        themeTagIds: ["format-a4"],
      }),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message === "Theme tags must exist and belong to the theme group",
    );
    assert.equal(transactionCalled, true);
  });

  for (const operation of ["create", "update"] as const) {
    it(`rejects a blank title on ${operation}`, async () => {
      const tx = {
        $queryRaw: async () => [
          {
            expectedColoringCount: 25,
            id: "collection-1",
            status: "draft" as const,
          },
        ],
        coloring: {
          findUnique: async () => createStoredColoring(),
          findMany: async () => [],
        },
        coloringCollection: {
          findUnique: async () => ({ id: "collection-1" }),
        },
        productTag: {
          findMany: async () => [],
        },
      };
      const prisma = {
        $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
          callback(tx),
      };
      const service = new ColoringsService(prisma as unknown as PrismaService);

      const promise =
        operation === "create"
          ? service.createColoring({
              collectionId: "collection-1",
              title: "   ",
              position: 0,
            })
          : service.updateColoring("coloring-1", {
              title: "   ",
              updatedAt: coloringUpdatedAt,
            });

      await assert.rejects(
        promise,
        (error: unknown) =>
          error instanceof BadRequestException &&
          error.message === "title must be a non-empty string",
      );
    });
  }

  it("preserves theme assignments when update omits themeTagIds", async () => {
    const stored = {
      ...createStoredColoring(),
      title: "Обновлённые лесные друзья",
    };
    const writes: Array<Record<string, unknown>> = [];
    const updateWheres: unknown[] = [];
    const serverUpdatedAts: Date[] = [];
    let relationMutationCalled = false;
    const tx = {
      coloring: {
        findUnique: async () => stored,
        updateMany: async ({
          data,
          where,
        }: {
          data: Record<string, unknown>;
          where: unknown;
        }) => {
          updateWheres.push(where);
          serverUpdatedAts.push(data.updatedAt as Date);
          const metadata = { ...data };
          delete metadata.updatedAt;
          writes.push(metadata);
          return { count: 1 };
        },
      },
      coloringThemeAssignment: {
        deleteMany: async () => {
          relationMutationCalled = true;
        },
        createMany: async () => {
          relationMutationCalled = true;
        },
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    const result = await service.updateColoring("coloring-1", {
      title: "  Обновлённые лесные друзья  ",
      updatedAt: coloringUpdatedAt,
    });

    assert.deepEqual(writes, [{ title: "Обновлённые лесные друзья" }]);
    assert.deepEqual(updateWheres, [
      {
        id: "coloring-1",
        status: ColoringStatus.DRAFT,
        updatedAt: new Date(coloringUpdatedAt),
      },
    ]);
    assert.equal(
      serverUpdatedAts[0]!.getTime() > Date.parse(coloringUpdatedAt),
      true,
    );
    assert.equal(relationMutationCalled, false);
    assert.deepEqual(
      result.themes.map((theme) => theme.id),
      ["theme-animals", "theme-forest"],
    );
  });

  it("clears theme assignments when update receives an empty themeTagIds array", async () => {
    const stored = {
      ...createStoredColoring(),
      themes: [],
    };
    const deletedFor: string[] = [];
    let createManyCalled = false;
    const tx = {
      coloring: {
        findUnique: async () => stored,
        updateMany: async () => ({ count: 1 }),
      },
      coloringThemeAssignment: {
        deleteMany: async ({ where }: { where: { coloringId: string } }) => {
          deletedFor.push(where.coloringId);
        },
        createMany: async () => {
          createManyCalled = true;
        },
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    const result = await service.updateColoring("coloring-1", {
      themeTagIds: [],
      updatedAt: coloringUpdatedAt,
    });

    assert.deepEqual(deletedFor, ["coloring-1"]);
    assert.equal(createManyCalled, false);
    assert.deepEqual(result.themes, []);
  });

  it("updates collection metadata and replaces validated theme assignments atomically", async () => {
    const stored = {
      ...createStoredColoring(),
      collectionId: "collection-2",
      number: 3,
      title: "Морские друзья",
      description: null,
      position: 3,
      collection: {
        ...createStoredColoring().collection,
        id: "collection-2",
        slug: "ocean",
        title: "Океан",
        product: {
          ...createStoredColoring().collection.product,
          id: "product-2",
          slug: "album-2",
          title: "Альбом 2",
        },
      },
      themes: [createStoredColoring().themes[0]],
    };
    const writes: Array<Record<string, unknown>> = [];
    const replacementCalls: unknown[] = [];
    const tx = {
      $queryRaw: async () => [
        {
          expectedColoringCount: 25,
          id: "collection-2",
          status: "draft" as const,
        },
      ],
      coloring: {
        findUnique: async () => stored,
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          const metadata = { ...data };
          delete metadata.updatedAt;
          writes.push(metadata);
          return { count: 1 };
        },
      },
      coloringCollection: {
        findUnique: async () => ({ id: "collection-2" }),
      },
      productTag: {
        findMany: async () => [
          { id: "theme-forest", group: ProductTagGroup.THEME },
        ],
      },
      coloringThemeAssignment: {
        deleteMany: async (args: unknown) => {
          replacementCalls.push(args);
        },
        createMany: async (args: unknown) => {
          replacementCalls.push(args);
        },
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    const result = await service.updateColoring("coloring-1", {
      collectionId: " collection-2 ",
      number: 3,
      title: " Морские друзья ",
      description: null,
      position: 3,
      themeTagIds: ["theme-forest"],
      updatedAt: coloringUpdatedAt,
    });

    assert.deepEqual(writes, [
      {
        collectionId: "collection-2",
        number: 3,
        title: "Морские друзья",
        description: null,
        position: 3,
      },
    ]);
    assert.deepEqual(replacementCalls, [
      { where: { coloringId: "coloring-1" } },
      {
        data: [{ coloringId: "coloring-1", tagId: "theme-forest" }],
      },
    ]);
    assert.equal(result.collection.id, "collection-2");
    assert.equal(result.collection.product.id, "product-2");
    assert.deepEqual(result.themes, [
      { id: "theme-forest", slug: "forest", title: "Лес" },
    ]);
  });

  it("rejects moving a draft into an archived collection returned by the SQL lock", async () => {
    let mutationCalled = false;
    const tx = {
      $queryRaw: async () => [
        {
          expectedColoringCount: 25,
          id: "collection-2",
          status: "archived" as const,
        },
      ],
      coloring: {
        findUnique: async () => createStoredColoring(),
        updateMany: async () => {
          mutationCalled = true;
          return { count: 1 };
        },
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.updateColoring("coloring-1", {
        collectionId: "collection-2",
        updatedAt: coloringUpdatedAt,
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message ===
          "Archived coloring collection cannot receive colorings",
    );
    assert.equal(mutationCalled, false);
  });

  it("rejects a number above the target collection expected count", async () => {
    let mutationCalled = false;
    const tx = {
      $queryRaw: async () => [
        {
          expectedColoringCount: 4,
          id: "collection-1",
          status: "draft" as const,
        },
      ],
      coloring: {
        findUnique: async () => createStoredColoring(),
        updateMany: async () => {
          mutationCalled = true;
          return { count: 1 };
        },
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.updateColoring("coloring-1", {
        number: 5,
        updatedAt: coloringUpdatedAt,
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message ===
          "Coloring number exceeds the collection expected count",
    );
    assert.equal(mutationCalled, false);
  });

  it("rejects metadata changes after a coloring is published", async () => {
    let mutationCalled = false;
    const tx = {
      coloring: {
        findUnique: async () => ({
          id: "coloring-1",
          status: ColoringStatus.PUBLISHED,
          updatedAt: new Date("2026-08-28T10:00:00.000Z"),
        }),
        update: async () => {
          mutationCalled = true;
        },
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.updateColoring("coloring-1", {
        title: "Новое название",
        updatedAt: coloringUpdatedAt,
      }),
      ConflictException,
    );
    assert.equal(mutationCalled, false);
  });

  it("rejects a stale client metadata token before mutation", async () => {
    let mutationCalled = false;
    const tx = {
      coloring: {
        findUnique: async () => ({
          id: "coloring-1",
          status: ColoringStatus.DRAFT,
          updatedAt: new Date("2026-08-28T10:00:00.000Z"),
        }),
        updateMany: async () => {
          mutationCalled = true;
          return { count: 1 };
        },
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.updateColoring("coloring-1", {
        title: "Новое название",
        updatedAt: "2026-08-28T09:59:59.000Z",
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message === "Coloring changed concurrently",
    );
    assert.equal(mutationCalled, false);
  });

  it("rejects a mutation-time metadata CAS race", async () => {
    const tx = {
      coloring: {
        findUnique: async () => ({
          collectionId: "collection-1",
          collection: {
            expectedColoringCount: 25,
            id: "collection-1",
            status: ColoringCollectionStatus.DRAFT,
          },
          id: "coloring-1",
          number: 1,
          status: ColoringStatus.DRAFT,
          updatedAt: new Date(coloringUpdatedAt),
        }),
        updateMany: async () => ({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.updateColoring("coloring-1", {
        title: "Новое название",
        updatedAt: coloringUpdatedAt,
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message === "Coloring changed concurrently",
    );
  });

  for (const uniqueConflict of [
    {
      target: ["collection_id", "number"],
      message: "Coloring number already exists for this collection",
    },
    {
      target: ["collection_id", "position"],
      message: "Coloring position already exists for this collection",
    },
  ]) {
    it(`maps ${uniqueConflict.target.join("+")} conflicts to ConflictException`, async () => {
      const prisma = {
        coloringCollection: {
          findUnique: async () => ({ id: "collection-1" }),
        },
        $transaction: async () => {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "7.8.0",
              meta: { target: uniqueConflict.target },
            },
          );
        },
      };
      const service = new ColoringsService(prisma as unknown as PrismaService);

      await assert.rejects(
        service.createColoring({
          collectionId: "collection-1",
          title: "Лесные друзья",
          position: 0,
        }),
        (error: unknown) =>
          error instanceof ConflictException &&
          error.message === uniqueConflict.message,
      );
    });
  }

  for (const prismaError of [
    {
      code: "P2003",
      errorType: ConflictException,
      message: "Coloring collection or theme tag no longer exists",
    },
    {
      code: "P2025",
      errorType: NotFoundException,
      message: "Coloring not found",
    },
  ] as const) {
    it(`maps create ${prismaError.code} races to an HTTP exception`, async () => {
      const tx = {
        $queryRaw: async () => [
          {
            expectedColoringCount: 25,
            id: "collection-1",
            status: "draft" as const,
          },
        ],
        productTag: {
          findMany: async () => [],
        },
        coloring: {
          findMany: async () => [],
          create: async () => {
            throw new Prisma.PrismaClientKnownRequestError("Mutation failed", {
              code: prismaError.code,
              clientVersion: "7.8.0",
            });
          },
        },
      };
      const prisma = {
        $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
          callback(tx),
      };
      const service = new ColoringsService(prisma as unknown as PrismaService);

      await assert.rejects(
        service.createColoring({
          collectionId: "collection-1",
          title: "Лесные друзья",
          position: 0,
        }),
        (error: unknown) =>
          error instanceof prismaError.errorType &&
          error.message === prismaError.message,
      );
    });
  }

  it("returns NotFound for an unknown coloring detail id", async () => {
    const prisma = {
      coloring: {
        findUnique: async () => null,
      },
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.getColoring("missing-coloring"),
      (error: unknown) =>
        error instanceof NotFoundException &&
        error.message === "Coloring not found",
    );
  });

  it("lists colorings as stable domain DTOs", async () => {
    const stored = createStoredColoring();
    const calls: unknown[] = [];
    const prisma = {
      coloring: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [stored];
        },
      },
    };
    const service = new ColoringsService(prisma as unknown as PrismaService);

    const result = await service.getColorings();

    assert.deepEqual(calls, [
      {
        include: {
          collection: { include: { product: true } },
          themes: { include: { tag: true } },
        },
        orderBy: [{ collectionId: "asc" }, { position: "asc" }],
      },
    ]);
    assert.deepEqual(result, [
      {
        id: "coloring-1",
        collectionId: "collection-1",
        number: 1,
        title: "Лесные друзья",
        description: "Сюжет с лесными животными",
        position: 0,
        status: "draft",
        collection: {
          id: "collection-1",
          slug: "mysterious-forest",
          title: "Загадочный лес",
          product: { id: "product-1", slug: "album-1", title: "Альбом 1" },
        },
        themes: [
          { id: "theme-animals", slug: "animals", title: "Животные" },
          { id: "theme-forest", slug: "forest", title: "Лес" },
        ],
        createdAt: "2026-08-28T10:00:00.000Z",
        updatedAt: "2026-08-28T10:00:00.000Z",
      },
    ]);
  });

  it("does not allow status in the update DTO contract", () => {
    const dto = plainToInstance(UpdateColoringRequestDTO, {
      title: "Лесные друзья",
      status: "published",
      updatedAt: coloringUpdatedAt,
    });
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    assert.equal(
      errors.some((error) => error.property === "status"),
      true,
    );
  });

  for (const property of [
    "collectionId",
    "number",
    "title",
    "position",
    "themeTagIds",
  ] as const) {
    it(`rejects null ${property} in the update DTO`, () => {
      const dto = plainToInstance(UpdateColoringRequestDTO, {
        [property]: null,
        updatedAt: coloringUpdatedAt,
      });

      const errors = validateSync(dto);

      assert.equal(
        errors.some((error) => error.property === property),
        true,
      );
    });
  }

  it("accepts null description in the update DTO", () => {
    const dto = plainToInstance(UpdateColoringRequestDTO, {
      description: null,
      updatedAt: coloringUpdatedAt,
    });

    assert.deepEqual(validateSync(dto), []);
  });

  for (const [name, value] of [
    ["omitted", undefined],
    ["null", null],
    ["malformed", "not-a-date"],
  ] as const) {
    it(`rejects ${name} updatedAt in the update DTO`, () => {
      const dto = plainToInstance(UpdateColoringRequestDTO, {
        title: "Лесные друзья",
        ...(value === undefined ? {} : { updatedAt: value }),
      });

      assert.equal(
        validateSync(dto).some((error) => error.property === "updatedAt"),
        true,
      );
    });
  }

  it("accepts an ISO updatedAt client token in the update DTO", () => {
    const dto = plainToInstance(UpdateColoringRequestDTO, {
      updatedAt: coloringUpdatedAt,
    });

    assert.deepEqual(validateSync(dto), []);
  });

  it("allows an omitted themeTagIds but rejects null on create", () => {
    const base = {
      collectionId: "collection-1",
      title: "Лесные друзья",
      position: 0,
    };

    assert.deepEqual(
      validateSync(plainToInstance(CreateColoringRequestDTO, base)),
      [],
    );
    assert.equal(
      validateSync(
        plainToInstance(CreateColoringRequestDTO, {
          ...base,
          themeTagIds: null,
        }),
      ).some((error) => error.property === "themeTagIds"),
      true,
    );
  });

  it("rejects positions outside the PostgreSQL integer range", () => {
    const createDto = plainToInstance(CreateColoringRequestDTO, {
      collectionId: "collection-1",
      title: "Лесные друзья",
      position: 2_147_483_648,
    });
    const updateDto = plainToInstance(UpdateColoringRequestDTO, {
      position: 2_147_483_648,
      updatedAt: coloringUpdatedAt,
    });

    assert.equal(
      validateSync(createDto).some((error) => error.property === "position"),
      true,
    );
    assert.equal(
      validateSync(updateDto).some((error) => error.property === "position"),
      true,
    );
  });

  it("does not treat null themeTagIds as a command to clear assignments", () => {
    const dto = plainToInstance(UpdateColoringRequestDTO, {
      themeTagIds: null,
      updatedAt: coloringUpdatedAt,
    });

    assert.equal(
      validateSync(dto).some((error) => error.property === "themeTagIds"),
      true,
    );
  });

  it("requires collection in the response DTO", () => {
    const responseWithoutCollection: Partial<
      ReturnType<typeof createColoringResponse>
    > = createColoringResponse();

    delete responseWithoutCollection.collection;
    const dto = plainToInstance(ColoringDTO, responseWithoutCollection);

    assert.equal(
      validateSync(dto).some((error) => error.property === "collection"),
      true,
    );
  });
});

describe("AdminColoringsController", () => {
  it("reserves public coloring routes by mounting all endpoints under admin", () => {
    assert.equal(
      Reflect.getMetadata(PATH_METADATA, AdminColoringsController),
      "admin/colorings",
    );
    assert.deepEqual(
      [
        "getColorings",
        "getColoring",
        "createColoring",
        "updateColoring",
        "createRevision",
        "getRevisions",
        "getRevisionAsset",
        "reviewRevision",
        "publishRevision",
      ].map((methodName) => {
        const handler =
          AdminColoringsController.prototype[
            methodName as keyof AdminColoringsController
          ];

        return handler
          ? {
              method: Reflect.getMetadata(METHOD_METADATA, handler),
              path: Reflect.getMetadata(PATH_METADATA, handler),
            }
          : undefined;
      }),
      [
        { method: 0, path: "/" },
        { method: 0, path: ":id" },
        { method: 1, path: "/" },
        { method: 4, path: ":id" },
        { method: 1, path: ":coloringId/revisions" },
        { method: 0, path: ":coloringId/revisions" },
        {
          method: 0,
          path: ":coloringId/revisions/:revisionId/assets/:kind/content",
        },
        { method: 1, path: ":coloringId/revisions/:revisionId/review" },
        { method: 1, path: ":coloringId/revisions/:revisionId/publish" },
      ],
    );
  });

  it("checks the admin role in a guard before multipart parsing", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminColoringsController,
    ) as Array<{ name?: string }>;

    assert.deepEqual(
      guards.map((guard) => guard.name),
      ["AuthGuard", "AdminColoringsGuard"],
    );
  });

  it("declares multipart, protected asset and publish response metadata", () => {
    const createHandler = AdminColoringsController.prototype.createRevision;
    const assetHandler = AdminColoringsController.prototype.getRevisionAsset;
    const publishHandler = AdminColoringsController.prototype.publishRevision;

    assert.equal(
      (Reflect.getMetadata(INTERCEPTORS_METADATA, createHandler) as unknown[])
        .length,
      2,
    );
    const bodyParameter = (
      Reflect.getMetadata(DECORATORS.API_PARAMETERS, createHandler) as Array<{
        in?: string;
        schema?: {
          required?: string[];
          properties?: Record<string, { format?: string }>;
        };
      }>
    ).find((parameter) => parameter.in === "body");

    assert.deepEqual(bodyParameter?.schema?.required, [
      "outline",
      "colored",
      "markerColorIds",
      "outlineAlt",
      "coloredAlt",
    ]);
    assert.equal(bodyParameter?.schema?.properties?.outline?.format, "binary");
    assert.equal(bodyParameter?.schema?.properties?.colored?.format, "binary");
    assert.deepEqual(Reflect.getMetadata(HEADERS_METADATA, assetHandler), [
      { name: "Content-Type", value: "image/webp" },
      { name: "Cache-Control", value: "private, no-store" },
    ]);
    assert.equal(Reflect.getMetadata(HTTP_CODE_METADATA, publishHandler), 200);
  });

  it("checks the admin role for every endpoint before delegating", async () => {
    const calls: string[] = [];
    const service = {
      getColorings: async () => {
        calls.push("list");
        return [];
      },
      getColoring: async (id: string) => {
        calls.push(`detail:${id}`);
        return {};
      },
      createColoring: async () => {
        calls.push("create");
        return {};
      },
      updateColoring: async (id: string) => {
        calls.push(`update:${id}`);
        return {};
      },
    };
    const usersService = {
      assertRole: (_user: unknown, role: string) => {
        calls.push(`role:${role}`);
      },
    };
    const revisionsService = {
      createRevision: async () => {
        calls.push("revision:create");
        return {};
      },
      getRevisions: async () => {
        calls.push("revision:list");
        return [];
      },
      getRevisionAsset: async (
        _coloringId: string,
        _revisionId: string,
        kind: string,
      ) => {
        calls.push(`revision:asset:${kind}`);
        return Buffer.from("asset");
      },
      reviewRevision: async () => {
        calls.push("revision:review");
        return {};
      },
      publishRevision: async () => {
        calls.push("revision:publish");
        return {};
      },
    };
    const controller = new AdminColoringsController(
      service as unknown as ColoringsService,
      usersService as unknown as UsersService,
      revisionsService as unknown as ColoringRevisionsService,
    );
    const request = { user: { id: "admin-1", roles: ["admin"] } } as never;

    await controller.getColorings(request);
    await controller.getColoring("coloring-1", request);
    await controller.createColoring(
      {
        collectionId: "collection-1",
        title: "Лесные друзья",
        position: 0,
      },
      request,
    );
    await controller.updateColoring(
      "coloring-1",
      { title: "Лес", updatedAt: coloringUpdatedAt },
      request,
    );
    await controller.createRevision(
      "coloring-1",
      {
        outline: [
          {
            buffer: Buffer.from("outline"),
            mimetype: "image/png",
            originalname: "o.png",
            size: 7,
          },
        ],
        colored: [
          {
            buffer: Buffer.from("colored"),
            mimetype: "image/png",
            originalname: "c.png",
            size: 7,
          },
        ],
      },
      {
        markerColorIds: ["marker-color-104"],
        outlineAlt: "Контур",
        coloredAlt: "Цветная версия",
      },
      request,
    );
    await controller.getRevisions("coloring-1", request);
    await controller.getRevisionAsset(
      "coloring-1",
      "revision-1",
      "outline",
      request,
    );
    await controller.reviewRevision(
      "coloring-1",
      "revision-1",
      { decision: "approved" },
      request,
    );
    await controller.publishRevision("coloring-1", "revision-1", request);

    assert.deepEqual(calls, [
      "role:admin",
      "list",
      "role:admin",
      "detail:coloring-1",
      "role:admin",
      "create",
      "role:admin",
      "update:coloring-1",
      "role:admin",
      "revision:create",
      "role:admin",
      "revision:list",
      "role:admin",
      "revision:asset:outline",
      "role:admin",
      "revision:review",
      "role:admin",
      "revision:publish",
    ]);
  });
});

describe("ProductsService coloring constraints", () => {
  it("maps product deletion blocked by colorings to ConflictException", async () => {
    const prisma = {
      product: {
        findUnique: async () => createStoredProduct(),
        delete: async () => {
          throw createPrismaError("P2003");
        },
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.deleteProduct("product-1"),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message === "Product contains colorings and cannot be deleted",
    );
  });

  it("maps a concurrent product deletion to NotFoundException", async () => {
    const prisma = {
      product: {
        findUnique: async () => createStoredProduct(),
        delete: async () => {
          throw createPrismaError("P2025");
        },
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.deleteProduct("product-1"),
      (error: unknown) =>
        error instanceof NotFoundException &&
        error.message === "Product not found",
    );
  });

  it("maps theme group changes blocked by colorings to ConflictException", async () => {
    const prisma = {
      productTag: {
        update: async () => {
          throw createPrismaError("P2003");
        },
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.updateProductTag("theme-forest", { group: "mood" }),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message ===
          "Product tag is in use and cannot be changed or deleted",
    );
  });

  it("maps theme deletion blocked by colorings to ConflictException", async () => {
    const prisma = {
      productTag: {
        delete: async () => {
          throw createPrismaError("P2003");
        },
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await assert.rejects(
      service.deleteProductTag("theme-forest"),
      (error: unknown) =>
        error instanceof ConflictException &&
        error.message ===
          "Product tag is in use and cannot be changed or deleted",
    );
  });
});

function createStoredColoring() {
  const now = new Date("2026-08-28T10:00:00.000Z");

  return {
    id: "coloring-1",
    collectionId: "collection-1",
    number: 1,
    title: "Лесные друзья",
    description: "Сюжет с лесными животными",
    position: 0,
    status: ColoringStatus.DRAFT,
    createdAt: now,
    updatedAt: now,
    collection: {
      id: "collection-1",
      productId: "product-1",
      slug: "mysterious-forest",
      title: "Загадочный лес",
      description: null,
      position: 0,
      expectedColoringCount: 25,
      status: ColoringCollectionStatus.DRAFT,
      coverUrl: null,
      coverAlt: null,
      coverWidth: null,
      coverHeight: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      product: {
        id: "product-1",
        slug: "album-1",
        title: "Альбом 1",
        description: null,
        status: ProductStatus.PUBLISHED,
        isHit: false,
        isOutOfStock: false,
        isOzonDeliveryAvailable: true,
        categoryId: null,
        price: 100_000,
        currency: "RUB",
        createdAt: now,
        updatedAt: now,
      },
    },
    themes: [
      {
        coloringId: "coloring-1",
        tagId: "theme-forest",
        tag: {
          id: "theme-forest",
          slug: "forest",
          title: "Лес",
          group: ProductTagGroup.THEME,
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        coloringId: "coloring-1",
        tagId: "theme-animals",
        tag: {
          id: "theme-animals",
          slug: "animals",
          title: "Животные",
          group: ProductTagGroup.THEME,
          createdAt: now,
          updatedAt: now,
        },
      },
    ],
  };
}

function createColoringResponse() {
  const stored = createStoredColoring();

  return {
    id: stored.id,
    collectionId: stored.collectionId,
    number: stored.number,
    title: stored.title,
    description: stored.description,
    position: stored.position,
    status: "draft",
    collection: {
      id: stored.collection.id,
      slug: stored.collection.slug,
      title: stored.collection.title,
      product: {
        id: stored.collection.product.id,
        slug: stored.collection.product.slug,
        title: stored.collection.product.title,
      },
    },
    themes: stored.themes.map(({ tag }) => ({
      id: tag.id,
      slug: tag.slug,
      title: tag.title,
    })),
    createdAt: stored.createdAt.toISOString(),
    updatedAt: stored.updatedAt.toISOString(),
  };
}

function createStoredProduct() {
  const now = new Date("2026-08-28T10:00:00.000Z");

  return {
    id: "product-1",
    slug: "album-1",
    title: "Альбом 1",
    description: null,
    status: ProductStatus.DRAFT,
    isHit: false,
    isOutOfStock: false,
    isOzonDeliveryAvailable: true,
    categoryId: null,
    price: 100_000,
    currency: "RUB",
    createdAt: now,
    updatedAt: now,
    category: null,
    images: [],
    tags: [],
  };
}

function createPrismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("Mutation failed", {
    code,
    clientVersion: "7.8.0",
  });
}
