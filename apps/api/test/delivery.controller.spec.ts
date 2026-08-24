import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DeliveryController } from "../src/delivery/delivery.controller";
import type { DeliveryProxyThrottleService } from "../src/delivery/delivery-proxy-throttle.service";
import type { DeliveryService } from "../src/delivery/delivery.service";

describe("DeliveryController Ozon proxy protection", () => {
  it("throttles both public Ozon proxy handlers before delegation", async () => {
    const throttleCalls: unknown[] = [];
    const deliveryService = {
      getOzonDeliveryMap: async () => ({ clusters: [] }),
      getOzonDeliveryPoints: async () => [],
    } as unknown as DeliveryService;
    const throttle = {
      assertAllowed: (input: unknown) => throttleCalls.push(input),
    } as unknown as DeliveryProxyThrottleService;
    const controller = new DeliveryController(deliveryService, throttle);
    const identity = {
      cookieHeader: "cart_id=cart-1",
      forwardedFor: "203.0.113.10",
      realIp: undefined,
      requestIp: "127.0.0.1",
    };

    await controller.getOzonDeliveryMap(
      {
        viewport: {
          leftBottom: { lat: 55.7, long: 37.5 },
          rightTop: { lat: 55.8, long: 37.7 },
        },
        zoom: 12,
      },
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
    );
    await controller.getOzonDeliveryPoints(
      { mapPointIds: ["11"] },
      identity.cookieHeader,
      identity.forwardedFor,
      identity.realIp,
      identity.requestIp,
    );

    assert.deepEqual(throttleCalls, [identity, identity]);
  });
});
