import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  ForbiddenException,
  type INestApplication,
  Module,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AuthGuard } from "../src/auth/auth.guard";
import { AuthService } from "../src/auth/auth.service";
import { AdminColoringsGuard } from "../src/colorings/admin-colorings.guard";
import { AdminMarkerColorsController } from "../src/colorings/marker-colors.controller";
import { MarkerColorsService } from "../src/colorings/marker-colors.service";
import { UsersService } from "../src/users/users.service";

const catalog = [
  {
    id: "marker-color-104",
    colorNumber: 104,
    pantone: "11-0601TCX",
    hex: "#F4F9FF",
    catalogPosition: 1,
    markerNumber: "006",
  },
  {
    id: "marker-color-173",
    colorNumber: 173,
    pantone: "5595C",
    hex: "#BFCEC2",
    catalogPosition: 158,
    markerNumber: "027",
  },
];

let returnInvalidResponse = false;

const authService = {
  getTokenFromRequest: (authorization?: string) =>
    authorization?.replace(/^Bearer\s+/i, ""),
  verifyAccessToken: async (token: string) => ({
    id: token === "customer-token" ? "customer-1" : "admin-1",
    roles: token === "customer-token" ? ["customer"] : ["admin"],
  }),
};

const usersService = {
  assertRole: (user: { roles?: string[] } | undefined, role: string) => {
    if (!user?.roles?.includes(role)) {
      throw new ForbiddenException("Admin role required");
    }
  },
};

const markerColorsService = {
  getMarkerColors: async () =>
    returnInvalidResponse ? [{ ...catalog[0], markerNumber: "6" }] : catalog,
};

@Module({
  controllers: [AdminMarkerColorsController],
  providers: [
    AuthGuard,
    AdminColoringsGuard,
    { provide: AuthService, useValue: authService },
    { provide: UsersService, useValue: usersService },
    { provide: MarkerColorsService, useValue: markerColorsService },
  ],
})
class TestMarkerColorsModule {}

describe("Admin marker colors HTTP contract", () => {
  let app: INestApplication;
  let baseUrl: string;

  before(async () => {
    app = await NestFactory.create(TestMarkerColorsModule, { logger: false });
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it("requires authentication and the admin role", async () => {
    const url = `${baseUrl}/admin/marker-colors`;
    const unauthenticated = await fetch(url);
    const customer = await fetch(url, {
      headers: { authorization: "Bearer customer-token" },
    });

    assert.equal(unauthenticated.status, 401);
    assert.equal(customer.status, 403);
  });

  it("returns the bounded catalog and preserves leading zeroes", async () => {
    const response = await fetch(`${baseUrl}/admin/marker-colors`, {
      headers: { authorization: "Bearer admin-token" },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), catalog);
  });

  it("fails closed when a catalog row violates the public DTO", async () => {
    returnInvalidResponse = true;

    try {
      const response = await fetch(`${baseUrl}/admin/marker-colors`, {
        headers: { authorization: "Bearer admin-token" },
      });

      assert.equal(response.status, 500);
      assert.equal(
        ((await response.json()) as { message?: string }).message,
        "Response validation failed",
      );
    } finally {
      returnInvalidResponse = false;
    }
  });

  it("publishes the authenticated marker catalog OpenAPI contract", () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const operation = document.paths["/admin/marker-colors"]?.get;
    const schema = document.components?.schemas?.MarkerColorDTO;

    assert.deepEqual(operation?.security, [{ bearer: [] }]);
    assert.deepEqual(
      Object.keys(
        (schema as { properties?: object } | undefined)?.properties ?? {},
      ),
      [
        "id",
        "colorNumber",
        "pantone",
        "hex",
        "catalogPosition",
        "markerNumber",
      ],
    );
    assert.deepEqual(
      (schema as { required?: string[] } | undefined)?.required,
      [
        "id",
        "colorNumber",
        "pantone",
        "hex",
        "catalogPosition",
        "markerNumber",
      ],
    );
  });
});
