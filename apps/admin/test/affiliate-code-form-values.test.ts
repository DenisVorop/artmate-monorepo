import assert from "node:assert/strict";
import test from "node:test";

import {
  affiliateCodeFormSchema,
  getUpdateAffiliateCodeInput,
  type AffiliateCodeFormValues,
} from "../src/features/partners-management/lib/code-form-values.ts";

const validValues: AffiliateCodeFormValues = {
  comment: "Кампания сентября",
  isActive: true,
  partnerPercent: 10,
};

test("affiliate percentage accepts integer boundaries 0 and 15", () => {
  assert.equal(
    affiliateCodeFormSchema.safeParse({
      ...validValues,
      partnerPercent: 0,
    }).success,
    true,
  );
  assert.equal(
    affiliateCodeFormSchema.safeParse({
      ...validValues,
      partnerPercent: 15,
    }).success,
    true,
  );
});

test("affiliate percentage rejects fractions and values outside 0 through 15", () => {
  for (const partnerPercent of [-1, 1.5, 16]) {
    assert.equal(
      affiliateCodeFormSchema.safeParse({
        ...validValues,
        partnerPercent,
      }).success,
      false,
    );
  }
});

test("comment length is checked after trimming", () => {
  const normalizedLimit = affiliateCodeFormSchema.safeParse({
    ...validValues,
    comment: `  ${"я".repeat(500)}  `,
  });
  const overLimit = affiliateCodeFormSchema.safeParse({
    ...validValues,
    comment: ` ${"я".repeat(501)} `,
  });

  assert.equal(normalizedLimit.success, true);
  assert.equal(
    normalizedLimit.success ? normalizedLimit.data.comment.length : 0,
    500,
  );
  assert.equal(overLimit.success, false);
});

test("affiliate update mapper trims comments, nulls blanks and cannot change code", () => {
  assert.deepEqual(
    getUpdateAffiliateCodeInput({
      ...validValues,
      comment: "  Важный комментарий  ",
    }),
    {
      comment: "Важный комментарий",
      isActive: true,
      partnerPercent: 10,
    },
  );

  const blankCommentInput = getUpdateAffiliateCodeInput({
    ...validValues,
    comment: "   ",
  });

  assert.equal(blankCommentInput.comment, null);
  assert.equal("code" in blankCommentInput, false);
});
