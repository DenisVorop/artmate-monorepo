import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  ForbiddenException,
  type INestApplication,
  MiddlewareConsumer,
  Module,
  type NestModule,
  NotFoundException,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AuthGuard } from "../src/auth/auth.guard";
import { AuthService } from "../src/auth/auth.service";
import { CsrfMiddleware } from "../src/common/csrf.middleware";
import { UsersService } from "../src/users/users.service";
import { PublicWorkshopService } from "../src/workshops/public-workshop.service";
import { WorkshopAdminGuard } from "../src/workshops/workshop-admin.guard";
import {
  PublicWorkshopController,
  WorkshopController,
  WorkshopModerationController,
} from "../src/workshops/workshop.controller";
import { WorkshopModerationService } from "../src/workshops/workshop-moderation.service";
import { WorkshopService } from "../src/workshops/workshop.service";

const authService = {
  getTokenFromRequest: (authorization?: string) =>
    authorization?.replace(/^Bearer\s+/i, ""),
  verifyAccessToken: async (token: string) => ({
    id: token === "customer-token" ? "customer-1" : "admin-1",
    roles: token === "customer-token" ? ["customer"] : ["admin"],
  }),
};
const usersService = {
  assertRole: (user: { roles: string[] }, role: string) => {
    if (!user.roles.includes(role)) {
      throw new ForbiddenException("Admin role required");
    }
  },
};
let revisionCalls = 0;
let latestRevisionArguments: unknown[] = [];
const workshopService = {
  createRevision: async (...arguments_: unknown[]) => {
    revisionCalls += 1;
    latestRevisionArguments = arguments_;
    return workResponse();
  },
  getOwnerAsset: async (userId: string, revisionId: string) => {
    if (userId !== "customer-1" || revisionId !== "a".repeat(32)) {
      throw new NotFoundException("Workshop resource not found");
    }
    return Buffer.from("owner-webp");
  },
};
const publicService = {
  getAsset: async (publicId: string) => {
    if (publicId !== "public-work") {
      throw new NotFoundException("Club resource not found");
    }
    return Buffer.from("public-webp");
  },
};
let moderationDecisions = 0;
const moderationService = {
  list: async () => [moderationListResponse(false)],
  get: async () => moderationResponse(true),
  decide: async () => {
    moderationDecisions += 1;
    return moderationResponse(true);
  },
  getAsset: async () => Buffer.from("admin-webp"),
};

@Module({
  controllers: [
    WorkshopController,
    PublicWorkshopController,
    WorkshopModerationController,
  ],
  providers: [
    AuthGuard,
    WorkshopAdminGuard,
    CsrfMiddleware,
    { provide: AuthService, useValue: authService },
    { provide: UsersService, useValue: usersService },
    { provide: WorkshopService, useValue: workshopService },
    { provide: PublicWorkshopService, useValue: publicService },
    { provide: WorkshopModerationService, useValue: moderationService },
  ],
})
class TestWorkshopModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes("*");
  }
}

describe("Workshop HTTP security contract", () => {
  let app: INestApplication;
  let baseUrl: string;

  before(async () => {
    app = await NestFactory.create(TestWorkshopModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it("rejects unauthenticated upload before malformed multipart parsing", async () => {
    const response = await fetch(
      `${baseUrl}/workshops/me/collections/forest/colorings/01/revisions`,
      {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=broken",
          "x-artmate-csrf": "1",
        },
        body: "broken",
      },
    );
    assert.equal(response.status, 401);
    assert.equal(revisionCalls, 0);
  });

  it("rejects missing CSRF before malformed multipart parsing", async () => {
    const response = await fetch(
      `${baseUrl}/workshops/me/collections/forest/colorings/01/revisions`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer customer-token",
          "content-type": "multipart/form-data; boundary=broken",
        },
        body: "broken",
      },
    );
    assert.equal(response.status, 403);
    assert.equal(revisionCalls, 0);
  });

  it("rejects a URL hidden after a newline in workshop plain text", async () => {
    const callsBefore = revisionCalls;
    const body = new FormData();
    body.set(
      "payload",
      JSON.stringify({
        intent: "DRAFT",
        caption: "My work\nhttps://spam.example",
        crop: { rotation: 0, zoom: 1, x: 0, y: 0 },
        materials: [{ toolId: "a".repeat(32) }],
        symbolMappings: [],
      }),
    );

    const response = await fetch(
      `${baseUrl}/workshops/me/collections/forest/colorings/01/revisions`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer customer-token",
          "x-artmate-csrf": "1",
        },
        body,
      },
    );

    assert.equal(response.status, 400);
    assert.equal(revisionCalls, callsBefore);
  });

  it("rejects missing or invalid required nested multipart payloads", async () => {
    const callsBefore = revisionCalls;
    const formDataWithPayload = (payload: unknown) => {
      const body = new FormData();
      body.set("payload", JSON.stringify(payload));
      return body;
    };
    const bodies = [
      new FormData(),
      formDataWithPayload({
        intent: "DRAFT",
        materials: [{ toolId: "a".repeat(32) }],
        symbolMappings: [],
      }),
      formDataWithPayload([]),
      formDataWithPayload({
        intent: "DRAFT",
        crop: [],
        materials: [{ toolId: "a".repeat(32) }],
        symbolMappings: [],
      }),
      formDataWithPayload({
        intent: "DRAFT",
        crop: { rotation: 0, zoom: 1, x: 0, y: 0 },
        materials: [[]],
        symbolMappings: [],
      }),
      formDataWithPayload({
        intent: "DRAFT",
        crop: { rotation: 0, zoom: 1, x: 0, y: 0 },
        materials: [{ toolId: "a".repeat(32) }],
        symbolMappings: [[]],
      }),
    ];

    for (const body of bodies) {
      const response = await fetch(
        `${baseUrl}/workshops/me/collections/forest/colorings/01/revisions`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer customer-token",
            "x-artmate-csrf": "1",
          },
          body,
        },
      );

      assert.equal(response.status, 400);
    }

    assert.equal(revisionCalls, callsBefore);
  });

  it("parses and validates a valid nested multipart revision payload", async () => {
    const callsBefore = revisionCalls;
    const body = new FormData();
    body.set(
      "payload",
      JSON.stringify({
        intent: "DRAFT",
        caption: "  My finished work  ",
        advertisingConsent: false,
        crop: { rotation: 90, zoom: 1.25, x: -0.5, y: 0.5 },
        materials: [{ toolId: "a".repeat(32) }],
        symbolMappings: [
          {
            symbol: " A ",
            materialPosition: 1,
            markerNumber: " 001-A ",
            officialMarkerColorId: "marker-color-001",
          },
        ],
      }),
    );

    const response = await fetch(
      `${baseUrl}/workshops/me/collections/forest/colorings/01/revisions`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer customer-token",
          "x-artmate-csrf": "1",
        },
        body,
      },
    );

    assert.equal(response.status, 201);
    assert.equal(revisionCalls, callsBefore + 1);
    assert.equal(latestRevisionArguments[0], "customer-1");
    assert.equal(latestRevisionArguments[1], "forest");
    assert.equal(latestRevisionArguments[2], 1);
    assert.deepEqual(JSON.parse(JSON.stringify(latestRevisionArguments[3])), {
      intent: "DRAFT",
      caption: "My finished work",
      advertisingConsent: false,
      crop: { rotation: 90, zoom: 1.25, x: -0.5, y: 0.5 },
      materials: [{ toolId: "a".repeat(32) }],
      symbolMappings: [
        {
          symbol: "A",
          materialPosition: 1,
          markerNumber: "001-A",
          officialMarkerColorId: "marker-color-001",
        },
      ],
    });
    assert.equal(latestRevisionArguments[4], undefined);
  });

  it("enforces admin role and CSRF before moderation transitions", async () => {
    const url = `${baseUrl}/admin/workshop-moderation/${"a".repeat(32)}/decision`;
    const body = JSON.stringify({ decision: "APPROVE" });
    const customer = await fetch(url, {
      method: "POST",
      headers: {
        authorization: "Bearer customer-token",
        "content-type": "application/json",
        "x-artmate-csrf": "1",
      },
      body,
    });
    const missingCsrf = await fetch(url, {
      method: "POST",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json",
      },
      body,
    });
    const admin = await fetch(url, {
      method: "POST",
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json",
        "x-artmate-csrf": "1",
      },
      body,
    });

    assert.equal(customer.status, 403);
    assert.equal(missingCsrf.status, 403);
    assert.equal(admin.status, 200);
    assert.equal(moderationDecisions, 1);
    assert.deepEqual(await admin.json(), moderationResponse(true));
  });

  it("exposes published revision state in moderation list and detail", async () => {
    const headers = { authorization: "Bearer admin-token" };
    const list = await fetch(`${baseUrl}/admin/workshop-moderation`, {
      headers,
    });
    const detail = await fetch(
      `${baseUrl}/admin/workshop-moderation/${"a".repeat(32)}`,
      { headers },
    );

    assert.equal(list.status, 200);
    assert.equal(detail.status, 200);
    assert.deepEqual(await list.json(), [moderationListResponse(false)]);
    assert.deepEqual(await detail.json(), moderationResponse(true));
  });

  it("serves authorized owner/admin assets with anti-indexing no-store headers", async () => {
    for (const [path, token, expected] of [
      [
        `/workshops/me/revisions/${"a".repeat(32)}/assets/web`,
        "customer-token",
        "owner-webp",
      ],
      [
        `/admin/workshop-moderation/${"a".repeat(32)}/assets/web`,
        "admin-token",
        "admin-webp",
      ],
    ] as const) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(
        response.headers.get("x-robots-tag"),
        "noindex, noimageindex",
      );
      assert.equal(
        Buffer.from(await response.arrayBuffer()).toString(),
        expected,
      );
    }
  });

  it("never reveals inaccessible owner or public assets and public success is no-store", async () => {
    const foreign = await fetch(
      `${baseUrl}/workshops/me/revisions/${"b".repeat(32)}/assets/web`,
      { headers: { authorization: "Bearer customer-token" } },
    );
    const privateAsset = await fetch(
      `${baseUrl}/club/works/private-work/assets/web`,
    );
    const publicAsset = await fetch(
      `${baseUrl}/club/works/public-work/assets/thumb`,
    );

    assert.equal(foreign.status, 404);
    assert.equal(privateAsset.status, 404);
    assert.equal(publicAsset.status, 200);
    assert.equal(publicAsset.headers.get("cache-control"), "private, no-store");
    assert.equal(
      publicAsset.headers.get("x-robots-tag"),
      "noindex, noimageindex",
    );
  });
});

function workResponse() {
  return {
    id: "b".repeat(32),
    publicId: "0123456789abcdef01234567",
    attemptNumber: 1,
    isPublicationEnabled: false,
    isIndexable: false,
    createdAt: "2026-09-01T10:00:00.000Z",
  };
}

function moderationListResponse(isPublishedRevision: boolean) {
  return {
    revisionId: "a".repeat(32),
    workId: "b".repeat(32),
    status: "APPROVED",
    isPublishedRevision,
    author: { id: "user-1", name: "Author" },
    workshopHandle: "0123456789abcdefabcd",
    collection: { id: "c".repeat(32), slug: "forest", title: "Forest" },
    coloring: { id: "d".repeat(32), number: 1, title: "Forest" },
    suspectedOfficialCopy: false,
    submittedAt: "2026-09-01T10:00:00.000Z",
    createdAt: "2026-09-01T09:00:00.000Z",
  };
}

function moderationResponse(isPublishedRevision: boolean) {
  return {
    ...moderationListResponse(isPublishedRevision),
    officialComparison: { revisionId: "official-1", coloredUrl: "/official" },
    materials: [],
    symbolMappings: [],
    decisionHistory: [],
    assets: { normalized: "/normalized", web: "/web", thumb: "/thumb" },
  };
}
