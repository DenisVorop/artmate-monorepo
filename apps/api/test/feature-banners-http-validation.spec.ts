import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";

import {
  CreateFeatureBannerRequestDTO,
  FeatureBannerDTO,
  UpdateFeatureBannerRequestDTO,
} from "../src/feature-banners/dto";

const pipe = new ValidationPipe({
  forbidNonWhitelisted: true,
  transform: true,
  whitelist: true,
});

describe("feature banner HTTP validation", () => {
  it("accepts a nonempty unique OR audience array", async () => {
    const dto = await transform(CreateFeatureBannerRequestDTO, {
      slug: "welcome-bonus",
      title: "Welcome",
      description: "Description",
      audiences: ["anonymous", "telegram_unlinked"],
    });

    assert.deepEqual(dto.audiences, ["anonymous", "telegram_unlinked"]);
  });

  it("rejects null, scalar, empty, duplicate, unknown and mixed ALL audiences", async () => {
    for (const audiences of [
      null,
      "anonymous",
      [],
      ["anonymous", "anonymous"],
      ["unknown"],
      ["all", "anonymous"],
    ]) {
      await assert.rejects(
        transform(CreateFeatureBannerRequestDTO, {
          slug: "welcome-bonus",
          title: "Welcome",
          description: "Description",
          audiences,
        }),
      );
    }
  });

  it("allows omitted audiences on create and PATCH but rejects the scalar alias", async () => {
    assert.equal(
      (
        await transform(CreateFeatureBannerRequestDTO, {
          slug: "welcome-bonus",
          title: "Welcome",
          description: "Description",
        })
      ).audiences,
      undefined,
    );
    assert.equal(
      (await transform(UpdateFeatureBannerRequestDTO, { enabled: false }))
        .audiences,
      undefined,
    );
    await assert.rejects(
      transform(UpdateFeatureBannerRequestDTO, { audience: "anonymous" }),
    );
  });

  it("rejects an invalid audience selection in the response contract", async () => {
    await assert.rejects(
      transform(FeatureBannerDTO, {
        id: "banner-1",
        slug: "welcome-bonus",
        title: "Welcome",
        description: "Description",
        audiences: ["all", "anonymous"],
        tone: "info",
        enabled: true,
        sortOrder: 0,
        createdAt: "2026-08-31T12:00:00.000Z",
        updatedAt: "2026-08-31T12:00:00.000Z",
      }),
    );
  });
});

function transform<T extends object>(type: new () => T, value: unknown) {
  return pipe.transform(value, {
    metatype: type,
    type: "body",
  } as ArgumentMetadata) as Promise<T>;
}
