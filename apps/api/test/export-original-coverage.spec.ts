import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  localCoverageDatabaseUrl,
  originalsSchemaMode,
} from "../src/colorings/export-original-coverage";

describe("Local read-only export boundary", () => {
  it("accepts only explicit local PostgreSQL URLs", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const url = `postgresql://user:secret@${host}:5432/artmate_api?schema=public`;
      assert.equal(localCoverageDatabaseUrl(url), url);
    }
  });
  it("rejects remote URLs and connection-string overrides without leaking credentials", () => {
    for (const value of [
      undefined,
      "broken-secret",
      "https://localhost/db",
      "postgres://user:secret@remote/db",
      "postgres://localhost/db?host=remote",
      "postgres://localhost/db?options=anything",
      "postgres://localhost/db?schema=other",
      "postgres://localhost/",
      "postgres://localhost/db#secret",
    ]) {
      assert.throws(
        () => localCoverageDatabaseUrl(value),
        (error) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message.includes("secret"), false);
          return true;
        },
      );
    }
  });
  it("distinguishes complete, absent and partial originals schemas", () => {
    assert.equal(
      originalsSchemaMode({ artworks: true, originals: true, colors: true }),
      "present",
    );
    assert.equal(
      originalsSchemaMode({ artworks: false, originals: false, colors: false }),
      "legacy-only",
    );
    for (let mask = 1; mask < 7; mask++) {
      assert.throws(
        () =>
          originalsSchemaMode({
            artworks: Boolean(mask & 1),
            originals: Boolean(mask & 2),
            colors: Boolean(mask & 4),
          }),
        /Partial originals schema/,
      );
    }
  });
});
