import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpException, HttpStatus } from "@nestjs/common";

import {
  ozonProxyIpMaxRequests,
  ozonProxySessionMaxRequests,
} from "../src/delivery/delivery.constants";
import { DeliveryProxyThrottleService } from "../src/delivery/delivery-proxy-throttle.service";

describe("DeliveryProxyThrottleService", () => {
  it("limits requests from one storefront session across different IPs", () => {
    const service = new DeliveryProxyThrottleService();

    for (let index = 0; index < ozonProxySessionMaxRequests; index += 1) {
      service.assertAllowed({
        cookieHeader: "cart_id=cart-1",
        requestIp: `198.51.100.${index + 1}`,
      });
    }

    assert.throws(
      () =>
        service.assertAllowed({
          cookieHeader: "cart_id=cart-1",
          requestIp: "203.0.113.1",
        }),
      isTooManyRequestsError,
    );
  });

  it("limits one client IP even when session IDs change", () => {
    const service = new DeliveryProxyThrottleService();

    for (let index = 0; index < ozonProxyIpMaxRequests; index += 1) {
      service.assertAllowed({
        cookieHeader: `cart_id=cart-${index}`,
        requestIp: "203.0.113.10",
      });
    }

    assert.throws(
      () =>
        service.assertAllowed({
          cookieHeader: "cart_id=another-cart",
          requestIp: "203.0.113.10",
        }),
      isTooManyRequestsError,
    );
  });

  it("uses a forwarded IP only when the direct peer is trusted", () => {
    const service = new DeliveryProxyThrottleService();

    for (let index = 0; index < ozonProxyIpMaxRequests; index += 1) {
      service.assertAllowed({
        forwardedFor: "203.0.113.20",
        requestIp: "127.0.0.1",
      });
    }

    assert.throws(
      () =>
        service.assertAllowed({
          forwardedFor: "203.0.113.20",
          requestIp: "127.0.0.1",
        }),
      isTooManyRequestsError,
    );
  });

  it("does not trust spoofed leading entries in a forwarded IP chain", () => {
    const service = new DeliveryProxyThrottleService();

    for (let index = 0; index < ozonProxyIpMaxRequests; index += 1) {
      service.assertAllowed({
        forwardedFor: `198.51.100.${index + 1}, 203.0.113.20`,
        requestIp: "127.0.0.1",
      });
    }

    assert.throws(
      () =>
        service.assertAllowed({
          forwardedFor: "192.0.2.1, 203.0.113.20",
          requestIp: "127.0.0.1",
        }),
      isTooManyRequestsError,
    );
  });
});

function isTooManyRequestsError(error: unknown) {
  return (
    error instanceof HttpException &&
    error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
  );
}
