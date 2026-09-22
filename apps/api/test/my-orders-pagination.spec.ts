import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import type { PrismaService } from "../src/prisma/prisma.service";
import { MyOrdersQueryDTO } from "../src/orders/dto";
import { OrdersStorage } from "../src/orders/orders.storage";

describe("MyOrdersQueryDTO", () => {
  it("defaults to the first 20 orders", async () => {
    const query = plainToInstance(MyOrdersQueryDTO, {});

    assert.deepEqual(
      { limit: query.limit, offset: query.offset },
      { limit: 20, offset: 0 },
    );
    assert.deepEqual(await validate(query), []);
  });

  it("accepts numeric query strings and rejects out-of-range values", async () => {
    const validQuery = plainToInstance(MyOrdersQueryDTO, {
      limit: "50",
      offset: "10",
    });
    assert.deepEqual(await validate(validQuery), []);

    const invalidQuery = plainToInstance(MyOrdersQueryDTO, {
      limit: "51",
      offset: "-1",
    });
    assert.deepEqual(
      (await validate(invalidQuery)).map((error) => error.property).sort(),
      ["limit", "offset"],
    );
  });
});

describe("OrdersStorage.getOrdersByUserId", () => {
  it("applies database pagination and scopes each query to its user", async () => {
    const calls: unknown[] = [];
    const prisma = {
      order: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [];
        },
      },
    } as unknown as PrismaService;
    const storage = new OrdersStorage(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await storage.getOrdersByUserId("user-a", { limit: 7, offset: 14 });
    await storage.getOrdersByUserId("user-b", { limit: 7, offset: 14 });

    assert.deepEqual(
      calls.map((call) => {
        const { where, orderBy, take, skip } = call as {
          where: unknown;
          orderBy: unknown;
          take: number;
          skip: number;
        };
        return { where, orderBy, take, skip };
      }),
      [
        {
          where: { userId: "user-a" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 7,
          skip: 14,
        },
        {
          where: { userId: "user-b" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 7,
          skip: 14,
        },
      ],
    );
  });
});
