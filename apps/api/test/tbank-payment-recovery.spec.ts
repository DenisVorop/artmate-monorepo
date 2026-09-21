import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import { BadGatewayException, BadRequestException } from "@nestjs/common";

import {
  TBankAcquiringService,
  type TBankAcquiringReconciliationInput,
} from "../src/tbank/tbank-acquiring.service";

const input = { orderId: "order-1", amountKopecks: 12_345 };
const originalFetch = globalThis.fetch;
const envNames = [
  "TBANK_ACQUIRING_BASE_URL",
  "TBANK_ACQUIRING_TERMINAL_KEY",
  "TBANK_ACQUIRING_PASSWORD",
] as const;
const originalEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);

function payment(status = "NEW", overrides: Record<string, unknown> = {}) {
  return {
    PaymentId: "7001",
    Amount: 12_345,
    Status: status,
    Success: true,
    ...overrides,
  };
}

function history(
  payments: unknown = [payment()],
  overrides: Record<string, unknown> = {},
) {
  return {
    TerminalKey: "test-terminal",
    OrderId: "order-1",
    Success: true,
    ErrorCode: "0",
    Payments: payments,
    ...overrides,
  };
}

function state(status = "CONFIRMED", overrides: Record<string, unknown> = {}) {
  return {
    TerminalKey: "test-terminal",
    OrderId: "order-1",
    Success: true,
    ErrorCode: "0",
    PaymentId: "7001",
    Amount: 12_345,
    Status: status,
    ...overrides,
  };
}

function mockResponses(
  checkResponse: unknown,
  stateResponse: unknown = state(),
) {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(init?.method, "POST");
    assert.ok(init.signal instanceof AbortSignal);
    const path = new URL(String(url)).pathname;
    assert.ok(
      ["/v2/CheckOrder", "/v2/GetState"].includes(path),
      "Recovery must never create/charge/cancel a payment",
    );
    const { Token, ...body } = JSON.parse(String(init.body)) as Record<
      string,
      unknown
    >;
    const expected = crypto
      .createHash("sha256")
      .update(
        Object.entries({ ...body, Password: "test-password" })
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, value]) => String(value))
          .join(""),
      )
      .digest("hex");
    assert.equal(Token, expected);
    requests.push({ path, body });
    return Response.json(
      path === "/v2/CheckOrder" ? checkResponse : stateResponse,
    );
  };
  return requests;
}

describe("T-Bank uncertain payment reconciliation", () => {
  beforeEach(() => {
    process.env.TBANK_ACQUIRING_BASE_URL = "https://tbank.test";
    process.env.TBANK_ACQUIRING_TERMINAL_KEY = "test-terminal";
    process.env.TBANK_ACQUIRING_PASSWORD = "test-password";
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const name of envNames) {
      const value = originalEnv[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("resolves an unknown original PaymentId and confirms payment only by fresh signed GetState", async () => {
    const requests = mockResponses(history(), state());
    assert.deepEqual(
      await new TBankAcquiringService().reconcilePayment(input),
      { state: "paid", paymentId: "7001" },
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

  it("resolves the unique live attempt among closed attempts regardless of array order", async () => {
    for (const payments of [
      [payment("CANCELED", { PaymentId: "old" }), payment("CONFIRMED")],
      [payment("CONFIRMED"), payment("DEADLINE_EXPIRED", { PaymentId: "old" })],
    ]) {
      mockResponses(history(payments));
      assert.deepEqual(
        await new TBankAcquiringService().reconcilePayment(input),
        { state: "paid", paymentId: "7001" },
      );
    }
  });

  it("requires exact supplied PaymentId and never chooses a different live attempt", async () => {
    for (const payments of [
      [payment()],
      [payment(), payment("CANCELED", { PaymentId: "old" })],
    ]) {
      const requests = mockResponses(history(payments));
      assert.deepEqual(
        await new TBankAcquiringService().reconcilePayment({
          ...input,
          paymentId: "old",
        }),
        { state: "attention", reason: "identity_mismatch" },
      );
      assert.equal(requests.length, 1);
    }
  });

  it("does not arbitrarily select multiple active/successful/all-closed unknown attempts", async () => {
    for (const statuses of [
      ["NEW", "NEW"],
      ["CONFIRMED", "CONFIRMED"],
      ["CONFIRMED", "AUTHORIZED"],
      ["CANCELED", "DEADLINE_EXPIRED"],
    ]) {
      const payments = statuses.map((status, index) =>
        payment(status, { PaymentId: String(index + 1) }),
      );
      const requests = mockResponses(history(payments));
      assert.deepEqual(
        await new TBankAcquiringService().reconcilePayment(input),
        { state: "attention", reason: "payment_ambiguous" },
      );
      assert.equal(requests.length, 1);
      if (statuses[0] !== "CANCELED") {
        assert.equal(
          (
            await new TBankAcquiringService().reconcilePayment({
              ...input,
              paymentId: "1",
            })
          ).state,
          "attention",
        );
      }
    }
  });

  it("confirms closure only when the whole history and exact fresh state are closed", async () => {
    for (const status of ["CANCELED", "DEADLINE_EXPIRED"]) {
      mockResponses(
        history([payment(status, { Success: "true", ErrorCode: "0" })]),
        state(status),
      );
      assert.deepEqual(
        await new TBankAcquiringService().reconcilePayment(input),
        { state: "closed_unpaid", paymentId: "7001" },
      );
      mockResponses(
        history([payment("CANCELED", { PaymentId: "old" }), payment(status)]),
        state(status),
      );
      assert.deepEqual(
        await new TBankAcquiringService().reconcilePayment({
          ...input,
          paymentId: "7001",
        }),
        { state: "closed_unpaid", paymentId: "7001" },
      );
    }
  });

  it("keeps holds and active processing pending, never treats AUTHORIZED as paid", async () => {
    for (const status of [
      "NEW",
      "FORM_SHOWED",
      "PREAUTHORIZING",
      "AUTHORIZING",
      "3DS_CHECKING",
      "3DS_CHECKED",
      "AUTHORIZED",
      "CONFIRMING",
      "CONFIRM_CHECKING",
      "PAY_CHECKING",
    ]) {
      mockResponses(history([payment(status)]), state(status));
      assert.deepEqual(
        await new TBankAcquiringService().reconcilePayment(input),
        { state: "pending", paymentId: "7001" },
      );
    }
    mockResponses(history(), state("CANCELED"));
    assert.deepEqual(
      await new TBankAcquiringService().reconcilePayment(input),
      { state: "pending", paymentId: "7001", reason: "closure_unconfirmed" },
    );
  });

  it("never closes rejected, refunded, reversed or unknown histories", async () => {
    for (const status of [
      "REJECTED",
      "AUTH_FAIL",
      "ATTEMPTS_EXPIRED",
      "REFUNDED",
      "PARTIAL_REFUNDED",
      "REFUNDING",
      "ASYNC_REFUNDING",
      "REVERSED",
      "PARTIAL_REVERSED",
      "REVERSING",
      "UNKNOWN",
    ]) {
      const requests = mockResponses(history([payment(status)]), state(status));
      assert.deepEqual(
        await new TBankAcquiringService().reconcilePayment(input),
        { state: "attention", reason: "closure_unconfirmed" },
      );
      assert.equal(requests.length, 1);
      mockResponses(
        history([payment("CANCELED"), payment(status, { PaymentId: "other" })]),
        state("CANCELED"),
      );
      assert.equal(
        (
          await new TBankAcquiringService().reconcilePayment({
            ...input,
            paymentId: "7001",
          })
        ).state,
        "attention",
      );
    }
  });

  it("requires a fresh capture and preserves confirmed evidence that contradicts earlier closure", async () => {
    for (const fresh of [
      "NEW",
      "AUTHORIZED",
      "REJECTED",
      "CANCELED",
      "REFUNDED",
      "UNKNOWN",
    ]) {
      mockResponses(history([payment("CONFIRMED")]), state(fresh));
      assert.equal(
        (await new TBankAcquiringService().reconcilePayment(input)).state,
        "attention",
      );
    }
    mockResponses(history([payment("CANCELED")]), state("CONFIRMED"));
    assert.deepEqual(
      await new TBankAcquiringService().reconcilePayment(input),
      { state: "paid", paymentId: "7001" },
    );
    mockResponses(history([payment("CANCELED")]), state("NEW"));
    assert.equal(
      (await new TBankAcquiringService().reconcilePayment(input)).state,
      "attention",
    );
  });

  it("rejects empty/malformed/unsuccessful histories without any GetState or guessed closure", async () => {
    for (const checked of [
      null,
      [],
      "not found",
      {},
      history([]),
      history(null),
      history([null]),
      history([payment(), payment()]),
      history(undefined, { Success: false }),
      history(undefined, { Success: "true" }),
      history(undefined, { ErrorCode: 0 }),
      history(undefined, { TerminalKey: "other" }),
      history(undefined, { OrderId: "other" }),
    ]) {
      const requests = mockResponses(checked);
      assert.equal(
        (await new TBankAcquiringService().reconcilePayment(input)).state,
        "attention",
      );
      assert.equal(requests.length, 1);
    }
    for (const overrides of [
      { PaymentId: 7001 },
      { PaymentId: " 7001" },
      { PaymentId: "" },
      { PaymentId: "1".repeat(21) },
      { Success: false },
      { Success: 1 },
      { ErrorCode: "1" },
      { Status: null },
    ]) {
      mockResponses(history([payment("CONFIRMED", overrides)]));
      assert.equal(
        (await new TBankAcquiringService().reconcilePayment(input)).state,
        "attention",
      );
    }
  });

  it("requires safe exact amounts on every history attempt and on fresh state", async () => {
    for (const amount of [
      undefined,
      null,
      "12345",
      12_344,
      -1,
      12_345.1,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      mockResponses(
        history([
          payment("CANCELED", { PaymentId: "old", Amount: amount }),
          payment(),
        ]),
      );
      assert.deepEqual(
        await new TBankAcquiringService().reconcilePayment(input),
        { state: "attention", reason: "amount_mismatch" },
      );
      mockResponses(history(), state("CONFIRMED", { Amount: amount }));
      assert.deepEqual(
        await new TBankAcquiringService().reconcilePayment(input),
        { state: "attention", reason: "amount_mismatch" },
      );
    }
  });

  it("requires exact success, terminal, order and payment identities in GetState", async () => {
    for (const fresh of [
      null,
      [],
      {},
      state("CONFIRMED", { Success: false }),
      state("CONFIRMED", { Success: "true" }),
      state("CONFIRMED", { ErrorCode: 0 }),
      state("CONFIRMED", { TerminalKey: "other" }),
      state("CONFIRMED", { OrderId: "other" }),
      state("CONFIRMED", { PaymentId: "other" }),
      state("CONFIRMED", { PaymentId: 7001 }),
      state("CONFIRMED", { Status: null }),
    ]) {
      mockResponses(history(), fresh);
      assert.equal(
        (await new TBankAcquiringService().reconcilePayment(input)).state,
        "attention",
      );
    }
  });

  it("throws transport/HTTP/JSON errors so the durable caller can retry without releasing", async () => {
    for (const failingPath of ["/v2/CheckOrder", "/v2/GetState"]) {
      for (const failure of ["network", "http", "json"]) {
        globalThis.fetch = async (url) => {
          if (new URL(String(url)).pathname !== failingPath)
            return Response.json(history());
          if (failure === "network") throw new Error("unavailable");
          if (failure === "http")
            return Response.json({ Success: false }, { status: 503 });
          return new Response("invalid json", {
            headers: { "content-type": "application/json" },
          });
        };
        await assert.rejects(
          new TBankAcquiringService().reconcilePayment(input),
          BadGatewayException,
        );
      }
    }
  });

  it("rejects invalid caller identity and amount before querying the provider", async () => {
    globalThis.fetch = async () => {
      throw new Error("must not fetch");
    };
    for (const overrides of [
      { orderId: "" },
      { orderId: " order-1" },
      { orderId: "1".repeat(51) },
      { paymentId: "" },
      { paymentId: null },
      { paymentId: 7001 },
      { paymentId: "1".repeat(21) },
      { amountKopecks: 0 },
      { amountKopecks: -1 },
      { amountKopecks: 1.5 },
      { amountKopecks: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      await assert.rejects(
        new TBankAcquiringService().reconcilePayment({
          ...input,
          ...overrides,
        } as TBankAcquiringReconciliationInput),
        BadRequestException,
      );
    }
  });
});
