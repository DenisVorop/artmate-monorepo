import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { OzonAcquiringService } from "../src/ozon/ozon-acquiring.service";
import { TBankAcquiringService } from "../src/tbank/tbank-acquiring.service";

const originalFetch = globalThis.fetch;
const envNames = [
  "TBANK_ACQUIRING_BASE_URL",
  "TBANK_ACQUIRING_PASSWORD",
  "TBANK_ACQUIRING_TAX",
  "TBANK_ACQUIRING_TAXATION",
  "TBANK_ACQUIRING_TERMINAL_KEY",
  "OZON_ACQUIRING_ACCESS_KEY",
  "OZON_ACQUIRING_BASE_URL",
  "OZON_ACQUIRING_NOTIFICATION_SECRET_KEY",
  "OZON_ACQUIRING_SECRET_KEY",
] as const;
const originalEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);

const commonInput = {
  amount: 3_387,
  customer: {
    email: "buyer@example.com",
    name: "Buyer",
    phone: "+79990000000",
  },
  deliveryPrice: 490,
  deliveryProvider: "ozon" as const,
  failUrl: "https://site.test/fail",
  items: [
    {
      id: "product-1",
      image: "/product.jpg",
      lineTotal: 2_997,
      price: 999,
      quantity: 3,
      slug: "product-1",
      title: "Product",
    },
  ],
  notificationUrl: "https://api.test/notification",
  orderId: "order-acceptance-1",
  receiptPricing: [
    {
      id: "product-1",
      priceGroups: [
        { quantity: 2, totalKopecks: 193_134, unitPriceKopecks: 96_567 },
        { quantity: 1, totalKopecks: 96_566, unitPriceKopecks: 96_566 },
      ],
    },
  ],
  successUrl: "https://site.test/success",
};

type TBankInitRequest = {
  Amount: number;
  Receipt: {
    Items: Array<{ Amount: number; Price: number; Quantity: number }>;
    Payments: { Electronic: number };
  };
};

type OzonCreateOrderRequest = {
  amount: { currencyCode: string; value: string };
  items: Array<{
    extId: string;
    name: string;
    needMark: boolean;
    price: { currencyCode: string; value: string };
    quantity: number;
    vat: string;
  }>;
};

describe("promocode acquiring payloads", () => {
  beforeEach(() => {
    process.env.TBANK_ACQUIRING_BASE_URL = "https://tbank.test";
    process.env.TBANK_ACQUIRING_PASSWORD = "test-password";
    process.env.TBANK_ACQUIRING_TAX = "none";
    process.env.TBANK_ACQUIRING_TAXATION = "usn_income";
    process.env.TBANK_ACQUIRING_TERMINAL_KEY = "test-terminal";
    process.env.OZON_ACQUIRING_ACCESS_KEY = "test-access";
    process.env.OZON_ACQUIRING_BASE_URL = "https://ozon.test";
    process.env.OZON_ACQUIRING_NOTIFICATION_SECRET_KEY = "test-notification";
    process.env.OZON_ACQUIRING_SECRET_KEY = "test-secret";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const name of envNames) {
      const value = originalEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("sends exact reduced T-Bank groups plus unchanged shipping", async () => {
    let request: TBankInitRequest | undefined;
    globalThis.fetch = async (_url, init) => {
      request = JSON.parse(String(init?.body)) as TBankInitRequest;
      return new Response(
        JSON.stringify({
          OrderId: "order-acceptance-1",
          PaymentId: 7001,
          PaymentURL: "https://pay.test/tbank",
          Success: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    await new TBankAcquiringService().createCheckoutPayment(commonInput);

    assert.equal(request?.Amount, 338_700);
    assert.equal(request?.Receipt.Payments.Electronic, 338_700);
    assert.deepEqual(
      request?.Receipt.Items.map(
        (item: { Amount: number; Price: number; Quantity: number }) => ({
          amount: item.Amount,
          price: item.Price,
          quantity: item.Quantity,
        }),
      ),
      [
        { amount: 193_134, price: 96_567, quantity: 2 },
        { amount: 96_566, price: 96_566, quantity: 1 },
        { amount: 49_000, price: 49_000, quantity: 1 },
      ],
    );
  });

  it("sends exact reduced Ozon groups with unique extIds and currency 643", async () => {
    let request: OzonCreateOrderRequest | undefined;
    globalThis.fetch = async (_url, init) => {
      request = JSON.parse(String(init?.body)) as OzonCreateOrderRequest;
      return new Response(
        JSON.stringify({
          order: {
            item: { id: "ozon-order-1", payLink: "https://pay.test/ozon" },
          },
          paymentDetails: { paymentId: "payment-1" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    await new OzonAcquiringService().createCheckoutPayment(commonInput);

    assert.deepEqual(request?.amount, { currencyCode: "643", value: "338700" });
    assert.deepEqual(
      request?.items.map(
        (item: {
          extId: string;
          price: { currencyCode: string; value: string };
          quantity: number;
        }) => ({
          extId: item.extId,
          price: item.price,
          quantity: item.quantity,
        }),
      ),
      [
        {
          extId: "order-acceptance-1-item-0-price-0",
          price: { currencyCode: "643", value: "96567" },
          quantity: 2,
        },
        {
          extId: "order-acceptance-1-item-0-price-1",
          price: { currencyCode: "643", value: "96566" },
          quantity: 1,
        },
        {
          extId: "order-acceptance-1-delivery",
          price: { currencyCode: "643", value: "49000" },
          quantity: 1,
        },
      ],
    );
    assert.equal(
      new Set(request?.items.map((item: { extId: string }) => item.extId)).size,
      3,
    );
  });

  it("preserves the original unsplit payload without a promocode snapshot", async () => {
    const requests: Array<TBankInitRequest | OzonCreateOrderRequest> = [];
    globalThis.fetch = async (url, init) => {
      requests.push(
        JSON.parse(String(init?.body)) as
          | TBankInitRequest
          | OzonCreateOrderRequest,
      );
      const isTBank = String(url).includes("tbank");
      return new Response(
        JSON.stringify(
          isTBank
            ? { PaymentURL: "https://pay.test/tbank", Success: true }
            : { order: { item: { payLink: "https://pay.test/ozon" } } },
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const input = {
      ...commonInput,
      amount: 3_487,
      receiptPricing: undefined,
    };

    await new TBankAcquiringService().createCheckoutPayment(input);
    await new OzonAcquiringService().createCheckoutPayment(input);

    const tbankRequest = requests[0] as TBankInitRequest;
    const ozonRequest = requests[1] as OzonCreateOrderRequest;
    assert.deepEqual(
      tbankRequest.Receipt.Items.slice(0, 1).map(
        (item: { Price: number; Quantity: number }) => [
          item.Price,
          item.Quantity,
        ],
      ),
      [[99_900, 3]],
    );
    assert.deepEqual(ozonRequest.items[0], {
      extId: "product-1",
      name: "Product",
      needMark: false,
      price: { currencyCode: "643", value: "99900" },
      quantity: 3,
      vat: "VAT_NONE",
    });
  });
});
