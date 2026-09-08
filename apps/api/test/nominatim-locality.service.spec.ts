import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BadGatewayException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { NominatimLocalityService } from "../src/delivery/nominatim-locality.service";

const city = {
  code: 44,
  countryCode: "RU",
  latitude: 1,
  longitude: 1,
  name: "Москва",
  region: "Москва",
};

describe("Nominatim locality resolver", () => {
  it("queries only the exact server-selected locality at a configurable endpoint", async () => {
    const previousEndpoint = process.env.NOMINATIM_BASE_URL;
    const previousFetch = globalThis.fetch;
    process.env.NOMINATIM_BASE_URL = "https://geo.example.test/nominatim";
    let requestUrl: URL | undefined;
    let requestInit: RequestInit | undefined;
    globalThis.fetch = async (input, init) => {
      requestUrl = new URL(String(input));
      requestInit = init;
      return Response.json([candidate()]);
    };
    try {
      const service = new NominatimLocalityService(createCache() as never);
      await service.resolve(city as never);
      assert.equal(requestUrl?.origin, "https://geo.example.test");
      assert.equal(requestUrl?.pathname, "/nominatim/search");
      assert.equal(requestUrl?.searchParams.get("q"), "Москва");
      assert.deepEqual(Object.fromEntries(requestUrl?.searchParams ?? []), {
        "accept-language": "ru",
        addressdetails: "1",
        countrycodes: "ru",
        format: "jsonv2",
        limit: "10",
        namedetails: "1",
        polygon_geojson: "1",
        q: "Москва",
      });
      assert.equal(requestInit?.redirect, "error");
      assert.ok(requestInit?.signal instanceof AbortSignal);
      assert.match(
        String((requestInit?.headers as Record<string, string>)["user-agent"]),
        /Artmate.*https:\/\/artmate\.ru/u,
      );
    } finally {
      globalThis.fetch = previousFetch;
      if (previousEndpoint === undefined) delete process.env.NOMINATIM_BASE_URL;
      else process.env.NOMINATIM_BASE_URL = previousEndpoint;
    }
  });

  it("rejects unsafe configured URLs before making a request", async () => {
    const previousEndpoint = process.env.NOMINATIM_BASE_URL;
    const previousFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => ((calls += 1), Response.json([]));
    try {
      for (const endpoint of [
        "ftp://geo.example.test",
        "https://user:pass@geo.example.test",
        "https://geo.example.test?token=secret",
        "https://geo.example.test#fragment",
      ]) {
        process.env.NOMINATIM_BASE_URL = endpoint;
        await assert.rejects(
          new NominatimLocalityService(createCache() as never).resolve(
            city as never,
          ),
          ServiceUnavailableException,
        );
      }
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousEndpoint === undefined) delete process.env.NOMINATIM_BASE_URL;
      else process.env.NOMINATIM_BASE_URL = previousEndpoint;
    }
  });

  it("does not expose an upstream body or secret marker on timeout/protocol failure", async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("secret-marker raw upstream body");
    };
    try {
      await assert.rejects(
        new NominatimLocalityService(createCache() as never).resolve(
          city as never,
        ),
        (error) =>
          error instanceof BadGatewayException &&
          /Не удалось определить границу города/u.test(error.message) &&
          !/secret-marker/u.test(error.message),
      );
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("uses only fresh cached boundaries and refreshes a stale source synchronously", async () => {
    const previousFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => ((calls += 1), Response.json([candidate()]));
    try {
      const cache = createCache();
      cache.entry = {
        payload: {
          status: "ok",
          boundary: {
            type: "MultiPolygon",
            coordinates: [[square()]],
            bbox: [0, 0, 2, 2],
          },
        },
        freshUntil: new Date(Date.now() - 1),
        expiresAt: new Date(Date.now() + 100_000),
      };
      await new NominatimLocalityService(cache as never).resolve(city as never);
      assert.equal(calls, 1);
      assert.equal(cache.publishCalls, 1);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});

function createCache() {
  type Entry = { payload: unknown; freshUntil: Date; expiresAt: Date };
  const cache = {
    entry: null as Entry | null,
    publishCalls: 0,
    cleanup: async () => undefined,
    find: async () => cache.entry,
    tryAcquireLease: async () => true,
    releaseLease: async () => undefined,
    publish: async (
      _key: string,
      _token: string,
      payload: unknown,
      freshTtlMs: number,
      maxTtlMs: number,
    ) => {
      cache.publishCalls += 1;
      cache.entry = {
        payload,
        freshUntil: new Date(Date.now() + freshTtlMs),
        expiresAt: new Date(Date.now() + maxTtlMs),
      };
      return true;
    },
    withNominatimGate: async (request: () => Promise<unknown>) => request(),
  };
  return cache;
}

function candidate() {
  return {
    address: { country_code: "ru" },
    addresstype: "city",
    category: "place",
    geojson: { type: "Polygon", coordinates: [square()] },
    name: "Москва",
    namedetails: { "name:ru": "Москва" },
    place_rank: 16,
    type: "city",
  };
}

function square() {
  return [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
    [0, 0],
  ];
}
