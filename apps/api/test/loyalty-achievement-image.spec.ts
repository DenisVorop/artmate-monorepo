import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, it } from "node:test";
import { PassThrough } from "node:stream";
import {
  BadRequestException,
  type ExecutionContext,
  ForbiddenException,
  type NestInterceptor,
  type Type,
} from "@nestjs/common";
import {
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
} from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import sharp from "sharp";
import { lastValueFrom, of } from "rxjs";

import { AuthGuard } from "../src/auth/auth.guard";
import type { AuthUser } from "../src/auth/auth.types";
import {
  CreateAchievementDraftDTO,
  AchievementDraftDTO,
} from "../src/loyalty/achievement-drafts.dto";
import {
  AchievementImageUploadDTO,
  LoyaltyAchievementImageController,
} from "../src/loyalty/achievement-image.controller";
import {
  LoyaltyAchievementImageService,
  maxAchievementImageBytes,
} from "../src/loyalty/achievement-image.service";
import { AdminAchievementsGuard } from "../src/loyalty/admin-achievements.guard";
import { UsersService } from "../src/users/users.service";

const upload = (buffer: Buffer, mimetype = "image/png") => ({
  buffer,
  mimetype,
  size: buffer.length,
});

async function withStorage(
  run: (service: LoyaltyAchievementImageService, root: string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "artmate-achievement-images-"));
  class TestImageService extends LoyaltyAchievementImageService {
    protected getUploadsRoot() {
      return root;
    }
    protected getApiPublicUrl() {
      return "http://localhost:43123";
    }
  }
  try {
    await run(new TestImageService(), root);
  } finally {
    assert.ok(basename(root).startsWith("artmate-achievement-images-"));
    await rm(root, { recursive: true, force: true });
  }
}

describe("achievement raster uploads", () => {
  it("accepts a real single-file multipart body through the configured upload interceptor", async () => {
    const buffer = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: "red",
      },
    })
      .png()
      .toBuffer();
    const boundary = "achievement-upload-test-boundary";
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const request = Object.assign(new PassThrough(), {
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(body.length),
      },
      method: "POST",
      file: undefined as
        | { buffer: Buffer; mimetype: string; size: number }
        | undefined,
    });
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
    const interceptors = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      LoyaltyAchievementImageController.prototype.upload,
    ) as (Type<NestInterceptor> | NestInterceptor)[];
    const interceptorType = interceptors.find(
      (interceptor) => typeof interceptor === "function",
    ) as Type<NestInterceptor>;
    assert.ok(interceptorType);
    const pending = new interceptorType().intercept(context, {
      handle: () => of(request.file),
    });
    request.end(body);
    const uploaded = await lastValueFrom(await pending);
    assert.equal(uploaded.mimetype, "image/png");
    assert.equal(uploaded.size, buffer.length);
    assert.deepEqual(uploaded.buffer, buffer);
  });

  it("decodes JPEG, PNG and WebP and writes distinct safe WebP files with stripped metadata", async () => {
    await withStorage(async (service, root) => {
      for (const format of ["jpeg", "png", "webp"] as const) {
        const source = await sharp({
          create: {
            width: 2048,
            height: 1024,
            channels: 4,
            background: { r: 80, g: 110, b: 200, alpha: 0.4 },
          },
        })
          .withMetadata({ exif: { IFD0: { Copyright: "private" } } })
          .toFormat(format)
          .toBuffer();
        const first = await service.upload(upload(source, `image/${format}`));
        const second = await service.upload(upload(source, `image/${format}`));
        assert.notEqual(first.url, second.url);
        assert.match(
          first.url,
          /^http:\/\/localhost:43123\/uploads\/loyalty-achievements\/[0-9a-f-]{36}\.webp$/,
        );
        assert.deepEqual(
          validateSync(plainToInstance(AchievementImageUploadDTO, first)),
          [],
        );
        const output = await readFile(
          join(root, "loyalty-achievements", basename(first.url)),
        );
        const metadata = await sharp(output).metadata();
        assert.equal(metadata.format, "webp");
        assert.equal(metadata.width, 1024);
        assert.equal(metadata.height, 512);
        assert.equal(metadata.exif, undefined);
        assert.equal(metadata.icc, undefined);
        if (format !== "jpeg") assert.equal(metadata.hasAlpha, true);
      }
      assert.equal(
        (await readdir(join(root, "loyalty-achievements"))).length,
        6,
      );
    });
  });

  it("does not enlarge a small image", async () => {
    await withStorage(async (service, root) => {
      const source = await sharp({
        create: { width: 2, height: 3, channels: 4, background: "transparent" },
      })
        .png()
        .toBuffer();
      const result = await service.upload(upload(source));
      const metadata = await sharp(
        await readFile(
          join(root, "loyalty-achievements", basename(result.url)),
        ),
      ).metadata();
      assert.equal(metadata.width, 2);
      assert.equal(metadata.height, 3);
      assert.equal(metadata.hasAlpha, true);
    });
  });

  it("rejects missing, oversized, mismatched, corrupt and non-raster uploads before storage", async () => {
    await withStorage(async (service, root) => {
      const png = await sharp({
        create: { width: 2, height: 2, channels: 3, background: "red" },
      })
        .png()
        .toBuffer();
      for (const file of [
        undefined,
        upload(Buffer.alloc(0)),
        upload(Buffer.alloc(maxAchievementImageBytes + 1)),
        { ...upload(png), size: png.length + 1 },
        upload(png, "image/jpeg"),
        upload(png, "text/plain"),
        upload(
          Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
          "image/svg+xml",
        ),
        upload(
          Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
          "image/png",
        ),
        upload(png.subarray(0, 20)),
      ])
        await assert.rejects(service.upload(file), BadRequestException);
      assert.deepEqual(await readdir(root), []);
    });
  });

  it("rejects images above the decode pixel limit", async () => {
    await withStorage(async (service, root) => {
      const tooManyPixels = await sharp({
        create: {
          width: 5000,
          height: 4801,
          channels: 3,
          background: "red",
        },
      })
        .png()
        .toBuffer();
      assert.ok(tooManyPixels.length < maxAchievementImageBytes);
      await assert.rejects(
        service.upload(upload(tooManyPixels)),
        BadRequestException,
      );
      assert.deepEqual(await readdir(root), []);
    });
  });

  it("requires both authentication and the admin guard before multipart handling", () => {
    assert.deepEqual(
      Reflect.getMetadata(GUARDS_METADATA, LoyaltyAchievementImageController),
      [AuthGuard, AdminAchievementsGuard],
    );
    const guard = new AdminAchievementsGuard(
      Object.create(UsersService.prototype) as UsersService,
    );
    const user: AuthUser = {
      id: "user",
      provider: "credentials",
      providerUserId: "identity",
      roles: ["customer"],
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    assert.throws(() => guard.canActivate(context), ForbiddenException);
    user.roles = ["admin"];
    assert.equal(guard.canActivate(context), true);
  });

  it("uses the existing public base URL precedence and supports local upload URLs in request and response DTOs", () => {
    class UrlService extends LoyaltyAchievementImageService {
      publicUrl() {
        return this.getApiPublicUrl();
      }
    }
    const old = {
      API_PUBLIC_URL: process.env.API_PUBLIC_URL,
      API_BASE_URL: process.env.API_BASE_URL,
      PORT: process.env.PORT,
    };
    try {
      process.env.API_PUBLIC_URL = "https://api.example.com///";
      process.env.API_BASE_URL = "http://internal.example";
      process.env.PORT = "43123";
      assert.equal(new UrlService().publicUrl(), "https://api.example.com");
      delete process.env.API_PUBLIC_URL;
      assert.equal(new UrlService().publicUrl(), "http://internal.example");
      delete process.env.API_BASE_URL;
      assert.equal(new UrlService().publicUrl(), "http://localhost:43123");
      delete process.env.PORT;
      assert.equal(new UrlService().publicUrl(), "http://localhost:3002");
    } finally {
      for (const [key, value] of Object.entries(old)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    for (const url of [
      "http://localhost:3002/uploads/loyalty-achievements/a.webp",
      "https://api.example.com/uploads/loyalty-achievements/a.webp",
    ]) {
      const draft = {
        title: "Image",
        description: "",
        imageUrl: url,
        conditionKind: "completed_order_count",
        target: 1,
        rewardPoints: 0,
        sortOrder: 0,
      };
      assert.deepEqual(
        validateSync(plainToInstance(CreateAchievementDraftDTO, draft)),
        [],
      );
      assert.deepEqual(
        validateSync(
          plainToInstance(AchievementDraftDTO, {
            ...draft,
            id: "16ba4cc4-de9f-4889-9ae9-ea64075450ef",
            version: 1,
            status: "draft",
            createdAt: "2026-09-21T00:00:00.000Z",
            updatedAt: "2026-09-21T00:00:00.000Z",
          }),
        ),
        [],
      );
    }
  });
});
