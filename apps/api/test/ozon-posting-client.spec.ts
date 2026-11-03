import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  OzonPostingClient,
  OzonPostingError,
} from "../src/delivery-tracking/ozon-posting.client";

const postingNumber = "0121544692-0182-3";
const originalClientId = process.env.OZON_CLIENT_ID;
const originalApiKey = process.env.OZON_API_KEY;

beforeEach(() => {
  process.env.OZON_CLIENT_ID = "test-client";
  process.env.OZON_API_KEY = "test-key";
});

afterEach(() => {
  if (originalClientId === undefined) delete process.env.OZON_CLIENT_ID;
  else process.env.OZON_CLIENT_ID = originalClientId;

  if (originalApiKey === undefined) delete process.env.OZON_API_KEY;
  else process.env.OZON_API_KEY = originalApiKey;
});

test("posting request uses the fixed endpoint, credentials, timeout and no redirects", async (t) => {
  const signal = new AbortController().signal;
  const timeout = t.mock.method(AbortSignal, "timeout", () => signal);
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      result: { posting_number: postingNumber, status: "delivered" },
    }),
  );

  assert.equal(
    await new OzonPostingClient().getState(postingNumber, "fbo"),
    "delivered",
  );
  assert.deepEqual(timeout.mock.calls[0]?.arguments, [8_000]);
  assert.deepEqual(fetchMock.mock.calls[0]?.arguments, [
    "https://api-seller.ozon.ru/v2/posting/fbo/get",
    {
      method: "POST",
      redirect: "error",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Client-Id": "test-client",
        "Api-Key": "test-key",
      },
      body: JSON.stringify({ posting_number: postingNumber }),
    },
  ]);
});

test("posting statuses map conservatively, including arrival at a pickup point", async (t) => {
  const cases = [
    ["awaiting_packaging", "pending"],
    ["awaiting_deliver", "pending"],
    ["delivering", "in_transit"],
    ["delivered", "delivered"],
    ["cancelled", "cancelled"],
    ["new_provider_status", "unknown"],
    ["posting_in_pickup_point", "unknown"],
    ["", "unknown"],
  ];

  for (const [status, expected] of cases) {
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      Response.json({
        result: {
          posting_number: postingNumber,
          status,
          substatus: "posting_in_pickup_point",
        },
      }),
    );
    assert.equal(
      await new OzonPostingClient().getState(postingNumber, "fbo"),
      expected,
    );
    fetchMock.mock.restore();
  }
});

test("missing credentials disable tracking without making a request", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected fetch");
  });
  const client = new OzonPostingClient();
  assert.equal(client.isConfigured(), true);

  for (const key of ["OZON_CLIENT_ID", "OZON_API_KEY"]) {
    const previous = process.env[key];
    process.env[key] = "   ";
    assert.equal(client.isConfigured(), false);
    await assert.rejects(client.getState(postingNumber, "fbo"), {
      message: "Ozon posting tracking is not configured",
    });
    process.env[key] = previous;
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("invalid posting numbers never reach the API", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected fetch");
  });
  for (const invalid of [
    "",
    "1-2",
    "1-2-3-4",
    "1-2-x",
    "1-2-3\n",
    " 1-2-3",
    "https://seller.ozon.ru/app/postings/fbo/1-2-3",
    `${"1".repeat(61)}-2-3`,
  ]) {
    await assert.rejects(new OzonPostingClient().getState(invalid, "fbo"), {
      message: "Invalid Ozon posting number",
    });
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("malformed and mismatched responses cannot confirm delivery", async (t) => {
  for (const body of [
    null,
    [],
    {},
    { result: null },
    { result: [] },
    { result: { posting_number: "1-2-3", status: "delivered" } },
    { result: { status: "delivered" } },
    { result: { posting_number: postingNumber } },
    { result: { posting_number: postingNumber, status: 1 } },
  ]) {
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      Response.json(body),
    );
    await assert.rejects(
      new OzonPostingClient().getState(postingNumber, "fbo"),
      {
        message: "Unable to check Ozon posting status",
      },
    );
    fetchMock.mock.restore();
  }
});

test("HTTP, network and JSON errors expose no upstream data", async (t) => {
  const failures = [
    async () => new Response("private-upstream-body", { status: 403 }),
    async () => new Response("private-invalid-json", { status: 200 }),
    async () => {
      throw new Error("private-network-error test-key");
    },
    async () => {
      throw new DOMException("private-timeout-details", "TimeoutError");
    },
  ];
  for (const failure of failures) {
    const fetchMock = t.mock.method(globalThis, "fetch", failure);
    await assert.rejects(
      new OzonPostingClient().getState(postingNumber, "fbo"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Unable to check Ozon posting status");
        assert.equal(error.cause, undefined);
        assert.doesNotMatch(error.stack ?? "", /private-|test-key/);
        return true;
      },
    );
    fetchMock.mock.restore();
  }
});

test("denied access has a safe actionable classification without leaking upstream details", async (t) => {
  for (const status of [401, 403, 503]) {
    const fetchMock = t.mock.method(
      globalThis,
      "fetch",
      async () => new Response("private response test-key", { status }),
    );
    await assert.rejects(
      new OzonPostingClient().getState(postingNumber, "fbo"),
      (error: unknown) => {
        assert.ok(error instanceof OzonPostingError);
        assert.equal(
          error.reason,
          status === 503 ? "provider_unavailable" : "access_denied",
        );
        assert.doesNotMatch(error.stack ?? "", /private response|test-key/);
        return true;
      },
    );
    fetchMock.mock.restore();
  }
});

test("FBS uses its own endpoint with the same response validation and status mapping", async (t) => {
  for (const [status, expected] of [
    ["awaiting_packaging", "pending"],
    ["delivering", "in_transit"],
    ["delivered", "delivered"],
    ["cancelled", "cancelled"],
    ["unknown_status", "unknown"],
  ]) {
    const mock = t.mock.method(globalThis, "fetch", async () =>
      Response.json({ result: { posting_number: postingNumber, status } }),
    );
    assert.equal(
      await new OzonPostingClient().getState(postingNumber, "fbs"),
      expected,
    );
    assert.equal(
      mock.mock.calls[0]?.arguments[0],
      "https://api-seller.ozon.ru/v3/posting/fbs/get",
    );
    mock.mock.restore();
  }
  const mock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ result: { posting_number: "other", status: "delivered" } }),
  );
  await assert.rejects(
    new OzonPostingClient().getState(postingNumber, "fbs"),
    /Unable to check Ozon posting status/,
  );
  assert.equal(mock.mock.callCount(), 1);
});
