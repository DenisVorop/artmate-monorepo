import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { BadRequestException, ValidationPipe } from "@nestjs/common";

import { parseOrderRefundRequest } from "../src/orders/refunds/refund-request";
import { CreateOrderRefundRequestDTO } from "../src/orders/dto";

const valid = {
  requestId: "00000000-0000-4000-8000-000000000001",
  reference: " bank-ref-1 ",
  reason: " confirmed by operator ",
  items: [{ productId: "product-1", quantity: 1 }],
  deliveryKopecks: 0,
  confirmed: true,
};

describe("parseOrderRefundRequest", () => {
  it("normalizes auditable strings and creates a stable fingerprint", () => {
    const first = parseOrderRefundRequest(valid);
    const second = parseOrderRefundRequest({
      ...valid,
      reference: "bank-ref-1",
      reason: "confirmed by operator",
    });

    assert.equal(first.reference, "bank-ref-1");
    assert.equal(first.reason, "confirmed by operator");
    assert.equal(first.requestFingerprint, second.requestFingerprint);
  });

  it("rejects coercible numbers, duplicate products and unconfirmed requests", () => {
    for (const request of [
      { ...valid, deliveryKopecks: "0" },
      { ...valid, items: [{ productId: "product-1", quantity: 1.5 }] },
      {
        ...valid,
        items: [
          { productId: "product-1", quantity: 1 },
          { productId: "product-1", quantity: 1 },
        ],
      },
      { ...valid, confirmed: false },
      { ...valid, requestId: "not-a-uuid" },
    ]) {
      assert.throws(() => parseOrderRefundRequest(request));
    }
  });

  it("allows delivery-only and zero-price item operations but rejects a no-op", () => {
    assert.doesNotThrow(() =>
      parseOrderRefundRequest({ ...valid, items: [], deliveryKopecks: 1 }),
    );
    assert.doesNotThrow(() => parseOrderRefundRequest(valid));
    assert.throws(() =>
      parseOrderRefundRequest({ ...valid, items: [], deliveryKopecks: 0 }),
    );
  });

  it("rejects non-integer JSON values at the DTO boundary", async () => {
    const dto = plainToInstance(CreateOrderRefundRequestDTO, {
      ...valid,
      deliveryKopecks: "0",
    });
    assert.equal((await validate(dto)).length > 0, true);
  });

  it("returns HTTP 400 semantics from the real Nest validation pipe", async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    await assert.rejects(
      pipe.transform(
        { ...valid, confirmed: false },
        { type: "body", metatype: CreateOrderRefundRequestDTO },
      ),
      BadRequestException,
    );
  });
});
