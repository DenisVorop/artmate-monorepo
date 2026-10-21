import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/features/auth/lib/flow-form-values.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", output)(require, loaded, loaded.exports);
const { passwordLoginSchema, passwordCreationSchema, registrationSchema, contactProfileSchema } =
  loaded.exports;

test("existing password login preserves the secret and accepts older short passwords", () => {
  const values = passwordLoginSchema.parse({
    email: "  anna@example.com  ",
    password: " x ",
  });
  assert.equal(values.email, "anna@example.com");
  assert.equal(values.password, " x ");
  assert.equal(passwordLoginSchema.safeParse({ email: values.email, password: "" }).success, false);
});

test("registration and guest activation require a matching password confirmation", () => {
  for (const schema of [passwordCreationSchema, registrationSchema]) {
    const profile = { name: "Анна", phone: "+7 999 123-45-67" };
    for (const passwordConfirm of ["", "Different2026"]) {
      const result = schema.safeParse({
        ...profile,
        password: "Example2026",
        passwordConfirm,
      });
      assert.equal(result.success, false);
      assert.ok(result.error.issues.some((issue) => issue.path[0] === "passwordConfirm"));
    }
    assert.equal(
      schema.safeParse({
        ...profile,
        password: "1234567",
        passwordConfirm: "1234567",
      }).success,
      false,
    );
    const result = schema.parse({
      ...profile,
      password: " Example2026 ",
      passwordConfirm: " Example2026 ",
    });
    assert.equal(result.password, " Example2026 ");
  }
});

test("guest activation needs no contact fields while registration validates them", () => {
  const passwords = { password: "Example2026", passwordConfirm: "Example2026" };
  assert.deepEqual(passwordCreationSchema.parse(passwords), passwords);
  assert.equal(registrationSchema.safeParse(passwords).success, false);
  const invalid = registrationSchema.safeParse({
    ...passwords,
    name: " ",
    phone: "123",
  });
  assert.equal(invalid.success, false);
  assert.deepEqual(
    new Set(invalid.error.issues.map((issue) => issue.path[0])),
    new Set(["name", "phone"]),
  );
  const valid = registrationSchema.parse({
    ...passwords,
    name: " Анна ",
    phone: " +7 999 123-45-67 ",
  });
  assert.equal(valid.name, "Анна");
  assert.equal(valid.phone, "+7 999 123-45-67");
});

test("masked Russian phone requires all digits", () => {
  assert.equal(
    contactProfileSchema.safeParse({ name: "Анна", phone: "+7 (916) 192 64 0" }).success,
    false,
  );
  assert.equal(
    contactProfileSchema.parse({ name: "Анна", phone: "+7 (916) 192 64 06" }).phone,
    "+7 (916) 192 64 06",
  );
});
