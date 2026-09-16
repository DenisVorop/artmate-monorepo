import assert from "node:assert/strict";
import test from "node:test";

import {
  affiliateCodeFormSchema,
  buildCreateAffiliateCodeInput,
  buildUpdateAffiliateCodeInput,
  getCommissionSplit,
} from "../src/features/affiliate-codes/lib/form-values.ts";

test("calculates both shares from the fixed 20 percent budget", () => {
  assert.deepEqual(getCommissionSplit(0), {
    buyerPercent: 20,
    partnerPercent: 0,
  });
  assert.deepEqual(getCommissionSplit(10), {
    buyerPercent: 10,
    partnerPercent: 10,
  });
  assert.deepEqual(getCommissionSplit(15), {
    buyerPercent: 5,
    partnerPercent: 15,
  });
});

test("accepts a generated code request and normalizes an empty comment", () => {
  const values = affiliateCodeFormSchema.parse({
    code: "",
    comment: "   ",
    partnerPercent: 10,
  });

  assert.deepEqual(buildCreateAffiliateCodeInput(values), {
    comment: null,
    partnerPercent: 10,
  });
});

test("normalizes a custom code and comment for create", () => {
  const values = affiliateCodeFormSchema.parse({
    code: "  artm-blog_2026  ",
    comment: "  Осенний ролик  ",
    partnerPercent: 12,
  });

  assert.deepEqual(buildCreateAffiliateCodeInput(values), {
    code: "ARTM-BLOG_2026",
    comment: "Осенний ролик",
    partnerPercent: 12,
  });
});

test("rejects invalid custom codes, fractional shares, and long comments", () => {
  assert.equal(
    affiliateCodeFormSchema.safeParse({
      code: "a!",
      comment: "",
      partnerPercent: 10,
    }).success,
    false,
  );
  assert.equal(
    affiliateCodeFormSchema.safeParse({
      code: "VALID",
      comment: "",
      partnerPercent: 10.5,
    }).success,
    false,
  );
  assert.equal(
    affiliateCodeFormSchema.safeParse({
      code: "VALID",
      comment: "x".repeat(501),
      partnerPercent: 10,
    }).success,
    false,
  );
});

test("accepts inclusive share and code length boundaries", () => {
  for (const partnerPercent of [0, 15]) {
    assert.equal(
      affiliateCodeFormSchema.safeParse({
        code: "A".repeat(partnerPercent === 0 ? 3 : 40),
        comment: "",
        partnerPercent,
      }).success,
      true,
    );
  }
});

test("rejects shares and code lengths outside boundaries", () => {
  for (const [code, partnerPercent] of [
    ["AA", 0],
    ["A".repeat(41), 15],
    ["VALID", -1],
    ["VALID", 16],
  ] as const) {
    assert.equal(
      affiliateCodeFormSchema.safeParse({
        code,
        comment: "",
        partnerPercent,
      }).success,
      false,
    );
  }
});

test("builds an update without the immutable code", () => {
  assert.deepEqual(
    buildUpdateAffiliateCodeInput({
      code: "CANNOT-CHANGE",
      comment: "  Новый комментарий ",
      partnerPercent: 7,
    }),
    { comment: "Новый комментарий", partnerPercent: 7 },
  );
});
