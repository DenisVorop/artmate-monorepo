import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import { BadGatewayException, BadRequestException } from "@nestjs/common";

import { TBankAcquiringService } from "../src/tbank/tbank-acquiring.service";

const input = { orderId: "order-1", paymentId: "7001", amountKopecks: 12_345 };
const originalFetch = globalThis.fetch;
const envNames = [
  "TBANK_ACQUIRING_BASE_URL",
  "TBANK_ACQUIRING_TERMINAL_KEY",
  "TBANK_ACQUIRING_PASSWORD",
] as const;
const originalEnv = Object.fromEntries(
  envNames.map((key) => [key, process.env[key]]),
);

function payment(overrides: Record<string, unknown> = {}) {
  return {
    PaymentId: "7001",
    Amount: 12_345,
    Status: "CANCELED",
    Success: true,
    ...overrides,
  };
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    TerminalKey: "test-terminal",
    OrderId: "order-1",
    Success: true,
    ErrorCode: "0",
    Payments: [payment()],
    ...overrides,
  };
}

function state(overrides: Record<string, unknown> = {}) {
  return {
    TerminalKey: "test-terminal",
    OrderId: "order-1",
    Success: true,
    ErrorCode: "0",
    PaymentId: "7001",
    Amount: 12_345,
    Status: "CANCELED",
    ...overrides,
  };
}

function mockResponses(
  checkResponse: unknown,
  stateResponse: unknown = state(),
) {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(init?.method, "POST");
    assert.ok(init.signal instanceof AbortSignal);
    const path = new URL(String(url)).pathname;
    assert.ok(path === "/v2/CheckOrder" || path === "/v2/GetState");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const { Token, ...unsigned } = body;
    const scalars = { ...unsigned, Password: "test-password" };
    const expectedToken = crypto
      .createHash("sha256")
      .update(
        Object.entries(scalars)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, value]) => String(value))
          .join(""),
      )
      .digest("hex");
    assert.equal(Token, expectedToken);
    requests.push({ path, body: unsigned });
    return Response.json(
      path === "/v2/CheckOrder" ? checkResponse : stateResponse,
    );
  };
  return requests;
}

describe("T-Bank authoritative unpaid closure", () => {
  beforeEach(() => {
    process.env.TBANK_ACQUIRING_BASE_URL = "https://tbank.test";
    process.env.TBANK_ACQUIRING_TERMINAL_KEY = "test-terminal";
    process.env.TBANK_ACQUIRING_PASSWORD = "test-password";
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const key of envNames) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("reads all attempts and the exact payment using signed read-only requests", async () => {
    const requests = mockResponses(
      order({
        Payments: [
          payment(),
          payment({
            PaymentId: "7002",
            Status: "DEADLINE_EXPIRED",
            Success: "true",
            ErrorCode: 0,
          }),
        ],
      }),
      state({ Status: "DEADLINE_EXPIRED" }),
    );
    assert.equal(
      await new TBankAcquiringService().verifyOrderClosedUnpaid(input),
      true,
    );
    assert.deepEqual(requests, [
      {
        path: "/v2/CheckOrder",
        body: { TerminalKey: "test-terminal", OrderId: "order-1" },
      },
      {
        path: "/v2/GetState",
        body: { TerminalKey: "test-terminal", PaymentId: "7001" },
      },
    ]);
  });

  it("refuses every active, paid, rejected, refunded or unknown attempt even when the requested payment is closed", async () => {
    for (const Status of [
      "NEW",
      "AUTHORIZED",
      "AUTH_FAIL",
      "CONFIRMED",
      "REJECTED",
      "REFUNDED",
      "REVERSED",
      "UNKNOWN",
      "",
      null,
    ]) {
      const requests = mockResponses(
        order({
          Payments: [payment(), payment({ PaymentId: "7002", Status })],
        }),
      );
      assert.equal(
        await new TBankAcquiringService().verifyOrderClosedUnpaid(input),
        false,
        String(Status),
      );
      assert.equal(requests.length, 1);
    }
  });

  it("refuses incomplete or inconsistent order-history responses", async () => {
    const invalid = [
      null,
      [],
      "not json",
      {},
      order({ TerminalKey: "other" }),
      order({ OrderId: "other" }),
      order({ Success: false }),
      order({ Success: "true" }),
      order({ ErrorCode: "9" }),
      order({ ErrorCode: undefined }),
      order({ Payments: [] }),
      order({ Payments: null }),
      order({ Payments: [null] }),
      order({ Payments: [payment({ PaymentId: "7002" })] }),
      order({ Payments: [payment(), payment()] }),
    ];
    for (const value of invalid) {
      mockResponses(value);
      assert.equal(
        await new TBankAcquiringService().verifyOrderClosedUnpaid(input),
        false,
        JSON.stringify(value),
      );
    }
  });

  it("checks success, exact identifiers and integer amounts for every listed attempt", async () => {
    const invalid = [
      { PaymentId: undefined },
      { PaymentId: 7002 },
      { PaymentId: " 7002" },
      { PaymentId: "" },
      { Amount: undefined },
      { Amount: "12345" },
      { Amount: 12_344 },
      { Amount: 12_345.5 },
      { Amount: Number.MAX_SAFE_INTEGER + 1 },
      { Success: false },
      { Success: undefined },
      { Success: "TRUE" },
      { ErrorCode: "9" },
    ];
    for (const patch of invalid) {
      mockResponses(
        order({
          Payments: [payment(), payment({ PaymentId: "7002", ...patch })],
        }),
      );
      assert.equal(
        await new TBankAcquiringService().verifyOrderClosedUnpaid(input),
        false,
        JSON.stringify(patch),
      );
    }
  });

  it("requires a consistent successful closed GetState response after history verification", async () => {
    const invalid = [
      null,
      [],
      {},
      state({ TerminalKey: "other" }),
      state({ OrderId: "other" }),
      state({ PaymentId: "7002" }),
      state({ PaymentId: 7001 }),
      state({ Amount: "12345" }),
      state({ Amount: 12_344 }),
      state({ Amount: undefined }),
      state({ Success: false }),
      state({ ErrorCode: "8" }),
      state({ Status: "REJECTED" }),
      state({ Status: "CONFIRMED" }),
      state({ Status: "AUTHORIZING" }),
      state({ Status: undefined }),
    ];
    for (const value of invalid) {
      mockResponses(order(), value);
      assert.equal(
        await new TBankAcquiringService().verifyOrderClosedUnpaid(input),
        false,
        JSON.stringify(value),
      );
    }
  });

  it("propagates transport, HTTP and unparseable JSON failures instead of confirming closure", async () => {
    for (const failingPath of ["/v2/CheckOrder", "/v2/GetState"]) {
      for (const failure of ["network", "http", "json"]) {
        globalThis.fetch = async (url) => {
          if (new URL(String(url)).pathname !== failingPath)
            return Response.json(order());
          if (failure === "network") throw new Error("connection lost");
          if (failure === "http")
            return Response.json({ Success: false }, { status: 503 });
          return new Response("{broken", {
            headers: { "content-type": "application/json" },
          });
        };
        await assert.rejects(
          new TBankAcquiringService().verifyOrderClosedUnpaid(input),
          BadGatewayException,
        );
      }
    }
  });

  it("rejects invalid local identity before contacting the bank", async () => {
    globalThis.fetch = async () => {
      throw new Error("unexpected bank request");
    };
    for (const patch of [
      { orderId: "" },
      { paymentId: "" },
      { amountKopecks: -1 },
      { amountKopecks: 1.5 },
      { amountKopecks: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      await assert.rejects(
        new TBankAcquiringService().verifyOrderClosedUnpaid({
          ...input,
          ...patch,
        }),
        BadRequestException,
      );
    }
  });
});
