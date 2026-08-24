import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { NotificationQueueService } from "../src/notifications/notification-queue.service";
import type { OrderDTO } from "../src/orders/dto";
import { OrdersTelegramService } from "../src/orders/orders-telegram.service";

const providerCases = [
  ["ozon", "Ozon"],
  ["cdek", "СДЭК"],
] as const;

const messageCases = [
  {
    name: "created admin",
    send: (service: OrdersTelegramService, order: OrderDTO) =>
      service.sendOrderCreated(order),
  },
  {
    name: "paid admin",
    send: (service: OrdersTelegramService, order: OrderDTO) =>
      service.sendOrderPaid(order),
  },
  {
    name: "created customer",
    send: (service: OrdersTelegramService, order: OrderDTO) =>
      service.sendOrderCreatedToCustomer({ chatId: "customer-chat", order }),
  },
] as const;

describe("Orders Telegram delivery provider", { concurrency: false }, () => {
  for (const [provider, label] of providerCases) {
    for (const messageCase of messageCases) {
      it(`uses the stored ${provider} provider in the ${messageCase.name} message`, async () => {
        const previousChatId = process.env.TELEGRAM_ORDERS_CHAT_ID;
        const { messages, service } = createServiceFixture();

        process.env.TELEGRAM_ORDERS_CHAT_ID = "test-chat";

        try {
          const order = createOrder(provider);

          await messageCase.send(service, order);

          assert.equal(messages.length, 1);
          const message = messages[0] ?? "";

          assert.match(message, new RegExp(`^<b>Доставка:</b> ${label}$`, "m"));

          if (messageCase.name === "created admin") {
            assert.match(
              message,
              new RegExp(
                `^<b>ПВЗ:</b> ${order.delivery.pickupPoint.address}$`,
                "m",
              ),
            );
            assert.match(message, /^<b>Стоимость:<\/b> 200.*₽$/m);
          }

          if (messageCase.name === "created customer") {
            assert.match(message, /^<b>Доставка:<\/b> 200.*₽$/m);
          }
        } finally {
          if (previousChatId === undefined) {
            delete process.env.TELEGRAM_ORDERS_CHAT_ID;
          } else {
            process.env.TELEGRAM_ORDERS_CHAT_ID = previousChatId;
          }
        }
      });
    }
  }

  for (const [provider, label] of providerCases) {
    it(`retains mandatory ${provider} delivery details in a long created admin message`, async () => {
      const previousChatId = process.env.TELEGRAM_ORDERS_CHAT_ID;
      const { messages, service } = createServiceFixture();

      process.env.TELEGRAM_ORDERS_CHAT_ID = "test-chat";

      try {
        const order = createLongOrder(provider);

        await service.sendOrderCreated(order);

        assert.equal(messages.length, 1);
        const message = messages[0] ?? "";
        const lines = message.split("\n");

        assert.ok(message.length <= 4096);
        assert.ok(lines.includes(`<b>Доставка:</b> ${label}`));
        assert.ok(
          lines.includes(`<b>ПВЗ:</b> ${order.delivery.pickupPoint.address}`),
        );
        assert.match(message, /^<b>Стоимость:<\/b> 200.*₽$/m);
        assertSafeTelegramHtml(message);
      } finally {
        if (previousChatId === undefined) {
          delete process.env.TELEGRAM_ORDERS_CHAT_ID;
        } else {
          process.env.TELEGRAM_ORDERS_CHAT_ID = previousChatId;
        }
      }
    });
  }

  it("compacts an oversized Ozon pickup address without losing mandatory details", async () => {
    const previousChatId = process.env.TELEGRAM_ORDERS_CHAT_ID;
    const { messages, service } = createServiceFixture();
    const boundaryPattern = 'Я😀<&>"';
    const address = `ПВЗ ${boundaryPattern.repeat(571)}Ю`;
    const order = createOrder("ozon");

    assert.equal(address.length, 4_002);
    order.delivery.pickupPoint.address = address;
    process.env.TELEGRAM_ORDERS_CHAT_ID = "test-chat";

    try {
      await service.sendOrderCreated(order);

      assert.equal(messages.length, 1);
      const message = messages[0] ?? "";
      const pickupPointLine = message
        .split("\n")
        .find((line) => line.startsWith("<b>ПВЗ:</b> "));

      assert.ok(
        message.length <= 4_096,
        `Telegram message has ${message.length} UTF-16 code units`,
      );
      assert.match(message, /^<b>Доставка:<\/b> Ozon$/m);
      assert.ok(pickupPointLine);
      assert.ok(pickupPointLine.endsWith("..."));
      assert.match(pickupPointLine, /Я😀&lt;&amp;&gt;&quot;/);
      assert.match(message, /^<b>Стоимость:<\/b> 200.*₽$/m);
      assert.match(message, /^<b>Статус:<\/b> Ожидает оплаты$/m);
      assert.match(message, /^<b>Итого:<\/b> .*₽$/m);
      assertSafeTelegramHtml(message);
      assertNoUnpairedSurrogates(message);
    } finally {
      if (previousChatId === undefined) {
        delete process.env.TELEGRAM_ORDERS_CHAT_ID;
      } else {
        process.env.TELEGRAM_ORDERS_CHAT_ID = previousChatId;
      }
    }
  });

  for (const [provider, label] of providerCases) {
    it(`retains the mandatory ${provider} core at the comment boundary`, async () => {
      const previousChatId = process.env.TELEGRAM_ORDERS_CHAT_ID;
      const { messages, service } = createServiceFixture();

      process.env.TELEGRAM_ORDERS_CHAT_ID = "test-chat";

      try {
        const order = createCommentBoundaryOrder(provider);

        await service.sendOrderCreated(order);

        assert.equal(messages.length, 1);
        const message = messages[0] ?? "";
        const lines = message.split("\n");

        assert.ok(message.length <= 4096);
        assert.ok(lines.includes(`<b>Доставка:</b> ${label}`));
        assert.ok(
          lines.includes(`<b>ПВЗ:</b> ${order.delivery.pickupPoint.address}`),
        );
        assert.match(message, /^<b>Стоимость:<\/b> 200.*₽$/m);
        assert.match(message, /^<b>Статус:<\/b> Ожидает оплаты$/m);
        assert.match(message, /^<b>Итого:<\/b> .*₽$/m);
        assertSafeTelegramHtml(message);
        assertWholeItemBlocks(message, "X".repeat(139));
      } finally {
        if (previousChatId === undefined) {
          delete process.env.TELEGRAM_ORDERS_CHAT_ID;
        } else {
          process.env.TELEGRAM_ORDERS_CHAT_ID = previousChatId;
        }
      }
    });
  }

  it("truncates every oversized message variant at safe HTML boundaries", async () => {
    const previousChatId = process.env.TELEGRAM_ORDERS_CHAT_ID;
    const { messages, service } = createServiceFixture();
    const order = {
      ...createOrder("cdek"),
      id: "<&>".repeat(2_000),
    };
    const shipmentStatus = {
      isReadyForPickup: true,
      nextStatusCode: "READY_FOR_PICKUP",
      nextStatusName: "Готов к выдаче",
      order,
    };

    process.env.TELEGRAM_ORDERS_CHAT_ID = "test-chat";

    try {
      await service.sendOrderCreated(order);
      await service.sendOrderPaid(order);
      await service.sendCdekShipmentStatusChanged(shipmentStatus);
      await service.sendOrderStatusChangedToCustomer({
        chatId: "customer-chat",
        nextStatus: "paid",
        order,
        previousStatus: "waiting_payment",
      });
      await service.sendOrderCreatedToCustomer({
        chatId: "customer-chat",
        order,
      });
      await service.sendCdekShipmentStatusChangedToCustomer({
        ...shipmentStatus,
        chatId: "customer-chat",
      });

      assert.equal(messages.length, 6);

      for (const message of messages) {
        assert.ok(message.length <= 4096);
        assert.ok(message.endsWith("\n\n..."));
        assertSafeTelegramHtml(message);
      }
    } finally {
      if (previousChatId === undefined) {
        delete process.env.TELEGRAM_ORDERS_CHAT_ID;
      } else {
        process.env.TELEGRAM_ORDERS_CHAT_ID = previousChatId;
      }
    }
  });

  it("rejects an unsupported stored delivery provider", async () => {
    const previousChatId = process.env.TELEGRAM_ORDERS_CHAT_ID;
    const { messages, service } = createServiceFixture();
    const order = createOrder("ozon");

    order.delivery.provider = "unsupported" as OrderDTO["delivery"]["provider"];
    process.env.TELEGRAM_ORDERS_CHAT_ID = "test-chat";

    try {
      await assert.rejects(
        service.sendOrderCreated(order),
        /Unsupported delivery provider/,
      );
      assert.equal(messages.length, 0);
    } finally {
      if (previousChatId === undefined) {
        delete process.env.TELEGRAM_ORDERS_CHAT_ID;
      } else {
        process.env.TELEGRAM_ORDERS_CHAT_ID = previousChatId;
      }
    }
  });
});

function createServiceFixture() {
  const messages: string[] = [];
  const queue = {
    enqueueTelegram: async ({ text }: { text: string }) => {
      messages.push(text);
    },
  };

  return {
    messages,
    service: new OrdersTelegramService(
      queue as unknown as NotificationQueueService,
    ),
  };
}

function createLongOrder(provider: OrderDTO["delivery"]["provider"]): OrderDTO {
  const order = createOrder(provider);
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: `product-${index + 1}`,
    title: `Product ${index + 1} ${"<&>".repeat(60)}`,
    slug: `product-${index + 1}`,
    price: 1_000,
    image: "/product.jpg",
    quantity: 1,
    lineTotal: 1_000,
  }));

  return {
    ...order,
    items,
    itemsCount: items.length,
    subtotal: 20_000,
    total: 20_200,
  };
}

function createCommentBoundaryOrder(
  provider: OrderDTO["delivery"]["provider"],
): OrderDTO {
  const order = createOrder(provider);
  const title = "X".repeat(139);
  const items = Array.from({ length: 22 }, (_, index) => ({
    id: `product-${index + 1}`,
    title,
    slug: `product-${index + 1}`,
    price: 1_000,
    image: "/product.jpg",
    quantity: 1,
    lineTotal: 1_000,
  }));

  return {
    ...order,
    comment: "note",
    delivery: {
      ...order.delivery,
      pickupPoint: {
        ...order.delivery.pickupPoint,
        address: "Тестовый адрес",
      },
    },
    items,
    itemsCount: items.length,
    subtotal: 22_000,
    total: 22_200,
  };
}

function assertWholeItemBlocks(message: string, title: string) {
  const lines = message.split("\n");
  const itemsStart = lines.indexOf("<b>Товары</b>");
  const deliveryStart = lines.indexOf("<b>Доставка</b>");

  assert.ok(itemsStart >= 0);
  assert.ok(deliveryStart > itemsStart);

  const itemLines = lines
    .slice(itemsStart + 1, deliveryStart)
    .filter((line) => line && line !== "...");

  assert.ok(itemLines.length > 0);
  assert.equal(itemLines.length % 2, 0);

  for (let index = 0; index < itemLines.length; index += 2) {
    const itemNumber = index / 2 + 1;

    assert.equal(itemLines[index], `<b>${itemNumber}.</b> ${title}`);
    assert.match(itemLines[index + 1] ?? "", /^1 шт\. x .* = .*₽$/);
  }
}

function assertSafeTelegramHtml(message: string) {
  const tagPattern = /<\/?(?:a|b|code)(?:\s+href="[^"]*")?>/g;
  const openTags: string[] = [];

  for (const tag of message.match(tagPattern) ?? []) {
    const tagName = /^<\/?([a-z]+)/.exec(tag)?.[1];

    assert.ok(tagName);

    if (tag.startsWith("</")) {
      assert.equal(openTags.pop(), tagName);
    } else {
      openTags.push(tagName);
    }
  }

  assert.deepEqual(openTags, []);
  assert.doesNotMatch(
    message.replace(tagPattern, ""),
    /[<>]|&(?!amp;|quot;|lt;|gt;)/,
  );
}

function assertNoUnpairedSurrogates(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);

      assert.ok(nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff);
      index += 1;
    } else {
      assert.ok(codeUnit < 0xdc00 || codeUnit > 0xdfff);
    }
  }
}

function createOrder(provider: OrderDTO["delivery"]["provider"]): OrderDTO {
  const otherProviderLabel = provider === "ozon" ? "СДЭК" : "Ozon";

  return {
    id: "AM-TEST",
    cartId: "cart-1",
    status: "waiting_payment",
    customer: {
      name: "Customer",
      phone: "+79990000000",
      email: "customer@example.com",
    },
    delivery: {
      provider,
      pickupPoint: {
        id: "point-1",
        title: `${otherProviderLabel} ПВЗ`,
        address: `${otherProviderLabel}, тестовый адрес`,
        workHours: "10:00-20:00",
        deliveryPrice: 200,
      },
    },
    payment: {
      method: "bank_card_mock",
      status: "pending",
      redirectUrl: "/checkout/success?orderId=AM-TEST",
    },
    items: [
      {
        id: "product-1",
        title: "Product",
        slug: "product",
        price: 1_000,
        image: "/product.jpg",
        quantity: 1,
        lineTotal: 1_000,
      },
    ],
    shipments: [],
    itemsCount: 1,
    subtotal: 1_000,
    deliveryPrice: 200,
    total: 1_200,
    currency: "RUB",
    createdAt: "2026-08-24T12:00:00.000Z",
  };
}
