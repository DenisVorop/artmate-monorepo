import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { MaterialSetsService } from "../src/materials/material-sets.service";
import {
  materialImportHash,
  parseMaterialColors,
} from "../src/materials/material-import";
import { PreviewMaterialImportRequestDTO } from "../src/materials/dto/material-import.dto";

const input: PreviewMaterialImportRequestDTO = {
  title: "Тестовый набор",
  slug: "test-set",
  brand: "Brand",
  kind: "MARKER",
  source: "code,hex,name,pantone\n040,#ff8844,Оранжевый,\nB-12,#123456,,",
};

describe("Material CSV import", () => {
  it("preserves marker codes and normalizes HEX without requiring Pantone", () => {
    assert.deepEqual(parseMaterialColors(input.source), {
      colors: [
        {
          code: "040",
          hex: "#FF8844",
          name: "Оранжевый",
          pantone: null,
          position: 0,
        },
        {
          code: "B-12",
          hex: "#123456",
          name: null,
          pantone: null,
          position: 1,
        },
      ],
      issues: [],
    });
  });

  for (const separator of [",", ";", "\t"]) {
    it(`accepts BOM, empty lines, CRLF and separator ${JSON.stringify(separator)}`, () => {
      const parsed = parseMaterialColors(
        '\uFEFF\r\n"code"' +
          separator +
          '"hex"\r\n\r\n006' +
          separator +
          "#aabbcc\r\n",
      );
      assert.equal(parsed.issues.length, 0);
      assert.equal(parsed.colors[0]?.code, "006");
      assert.equal(parsed.colors[0]?.hex, "#AABBCC");
    });
  }

  it("reads quoted delimiters, escaped quotes and multiline names", () => {
    const parsed = parseMaterialColors(
      'code,hex,name\n040,#123456,"Red, ""warm""\nlight"\n041,#123456,Second',
    );
    assert.equal(parsed.colors[0]?.name, 'Red, "warm"\nlight');
    assert.equal(parsed.issues[0]?.row, 4);
    assert.equal(parsed.issues[0]?.severity, "warning");
    assert.equal(parsed.colors.length, 2);
  });

  it("reports duplicate codes as errors and identical HEX values only as warnings", () => {
    const parsed = parseMaterialColors(
      "code,hex\n040,#abcdef\n040,#AABBCC\n041,#ABCDEF",
    );
    assert.ok(
      parsed.issues.some(
        (issue) =>
          issue.row === 3 &&
          issue.field === "code" &&
          issue.severity === "error",
      ),
    );
    assert.ok(
      parsed.issues.some(
        (issue) =>
          issue.row === 4 &&
          issue.field === "hex" &&
          issue.severity === "warning",
      ),
    );
    assert.deepEqual(
      parsed.colors.map((color) => color.code),
      ["040", "041"],
    );
  });

  for (const source of [
    "",
    "code,hex",
    "number,color\n040,#AABBCC",
    "code,hex,code\n040,#123456,041",
    'code,hex\n040,"#AABBCC',
    'code,hex\n040,"#AABBCC"x',
    'code,hex\n04"0,#AABBCC',
    "code,hex\n040,#123456,extra",
    "code,hex\n040,red",
    "code,hex\n,#123456",
    "code,hex\n040,#12ZZ56",
    "code,hex\n\u0000,#123456",
    "code,hex,name\n040,#123456,\uFFFD",
    'code,hex\n"0\n40",#123456',
  ]) {
    it(`rejects malformed or incomplete input ${JSON.stringify(source)}`, () => {
      assert.ok(
        parseMaterialColors(source).issues.some(
          (issue) => issue.severity === "error",
        ),
      );
    });
  }

  it("bounds UTF-8 bytes, row count and optional field lengths", () => {
    assert.equal(parseMaterialColors("я".repeat(25001)).colors.length, 0);
    assert.match(
      parseMaterialColors("я".repeat(25001)).issues[0]!.message,
      /50 КБ/,
    );
    const rows = Array.from(
      { length: 1000 },
      (_, index) => `${index},#123456`,
    ).join("\n");
    assert.equal(parseMaterialColors("code,hex\n" + rows).colors.length, 1000);
    assert.match(
      parseMaterialColors("code,hex\n" + rows + "\n1001,#123456").issues[0]!
        .message,
      /1000/,
    );
    assert.ok(
      parseMaterialColors(
        "code,hex,name,pantone\n" +
          "1".repeat(41) +
          ",#123456," +
          "a".repeat(121) +
          "," +
          "p".repeat(41),
      ).issues.length === 3,
    );
  });

  it("fingerprints source and every metadata field, not object property order", () => {
    const hash = materialImportHash(input);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hash, materialImportHash({ ...input, line: "" }));
    for (const change of [
      { title: "Changed" },
      { slug: "changed" },
      { brand: "Other" },
      { line: "New line" },
      { kind: "PENCIL" as const },
      { source: input.source + "\n" },
    ])
      assert.notEqual(materialImportHash({ ...input, ...change }), hash);
  });

  it("validates and trims metadata, rejecting whitespace titles and unknown kinds", () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    const valid = plainToInstance(PreviewMaterialImportRequestDTO, {
      ...input,
      title: "  Набор  ",
    });
    assert.equal(valid.title, "Набор");
    assert.equal(validateSync(valid, options).length, 0);
    for (const change of [
      { title: "   " },
      { slug: "Upper Case" },
      { brand: "" },
      { kind: "REVISIONS" },
      { source: null },
      { colors: [] },
      { title: "x".repeat(161) },
    ])
      assert.ok(
        validateSync(
          plainToInstance(PreviewMaterialImportRequestDTO, {
            ...input,
            ...change,
          }),
          options,
        ).length > 0,
      );
  });
});

describe("MaterialSetsService", () => {
  it("returns explicit color IDs and leading-zero codes for assignments without changing the catalog", async () => {
    const colors = [
      {
        id: "color-001",
        code: "001",
        hex: "#123456",
        name: null,
        pantone: null,
        position: 0,
      },
    ];
    const record = {
      id: "set-1",
      slug: "set-one",
      title: "Set",
      brand: "Brand",
      line: null,
      kind: "MARKER",
      isArchived: false,
      _count: { colors: 1 },
      colors,
    };
    const prisma = {
      materialSet: {
        findUnique: async (args: { where: { id: string } }) => {
          assert.equal(args.where.id, "set-1");
          return record;
        },
      },
    };
    const result = await new MaterialSetsService(
      prisma as unknown as PrismaService,
    ).get("set-1");
    assert.deepEqual(result.colors, colors);
    assert.equal(result.colorCount, 1);
    assert.equal("_count" in result, false);
    await assert.rejects(
      new MaterialSetsService({
        materialSet: { findUnique: async () => null },
      } as unknown as PrismaService).get("missing"),
      /Набор не найден/,
    );
  });

  function fixture(existing = false, race = false) {
    const writes: unknown[] = [];
    const record = {
      id: "set-1",
      title: input.title,
      slug: input.slug,
      brand: input.brand,
      line: null,
      kind: "MARKER",
      isArchived: false,
      _count: { colors: 2 },
    };
    const prisma = {
      materialSet: {
        findUnique: async () => (existing ? { id: "set-1" } : null),
        findMany: async () => [record],
        create: async (args: unknown) => {
          writes.push(args);
          if (race)
            throw new Prisma.PrismaClientKnownRequestError("unique", {
              code: "P2002",
              clientVersion: "test",
            });
          return record;
        },
      },
    };
    return {
      service: new MaterialSetsService(prisma as unknown as PrismaService),
      writes,
    };
  }

  it("previews without writes, then atomically creates the catalog and its rows", async () => {
    const { service, writes } = fixture();
    const preview = await service.preview(input);
    assert.equal(preview.canImport, true);
    assert.equal(writes.length, 0);
    const result = await service.import({
      ...input,
      confirmationHash: preview.confirmationHash,
    });
    assert.equal(result.colorCount, 2);
    assert.equal("_count" in result, false);
    const write = writes[0] as {
      data: { colors: { createMany: { data: unknown[] } } };
    };
    assert.deepEqual(write.data.colors.createMany.data, preview.colors);
    assert.equal(writes.length, 1);
    assert.equal((await service.list())[0]?.colorCount, 2);
  });

  it("requires rechecking changes, and validates rows again during creation", async () => {
    const { service, writes } = fixture();
    const preview = await service.preview(input);
    await assert.rejects(
      service.import({
        ...input,
        title: "Changed",
        confirmationHash: preview.confirmationHash,
      }),
      BadRequestException,
    );
    const invalid = { ...input, source: "code,hex\n040,wrong" };
    await assert.rejects(
      service.import({
        ...invalid,
        confirmationHash: materialImportHash(invalid),
      }),
      BadRequestException,
    );
    assert.equal(writes.length, 0);
  });

  it("does not overwrite existing sets and translates concurrent duplicate creates to a conflict", async () => {
    const existing = fixture(true);
    const preview = await existing.service.preview(input);
    assert.equal(preview.canImport, false);
    assert.equal(preview.issues[0]?.field, "slug");
    await assert.rejects(
      existing.service.import({
        ...input,
        confirmationHash: materialImportHash(input),
      }),
      ConflictException,
    );
    assert.equal(existing.writes.length, 0);
    await assert.rejects(
      fixture(false, true).service.import({
        ...input,
        confirmationHash: materialImportHash(input),
      }),
      ConflictException,
    );
  });

  it("allows confirmed same-HEX warnings without merging materials", async () => {
    const { service } = fixture();
    const sameHex = { ...input, source: "code,hex\n040,#123456\n041,#123456" };
    const preview = await service.preview(sameHex);
    assert.equal(preview.canImport, true);
    assert.equal(preview.colors.length, 2);
    assert.equal(preview.issues[0]?.severity, "warning");
    await service.import({
      ...sameHex,
      confirmationHash: preview.confirmationHash,
    });
  });
});
