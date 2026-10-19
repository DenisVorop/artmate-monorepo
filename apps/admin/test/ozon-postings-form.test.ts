import assert from "node:assert/strict";
import test from "node:test";

import {
  OzonPostingsFormMapper,
  ozonPostingsFormSchema,
} from "../src/features/orders-crm/lib/ozon-postings-form.ts";
import { OzonPostingUrl } from "../src/shared/lib/ozon-posting-url.ts";

const fbo =
  "https://seller.ozon.ru/app/postings/fbo/details?posting_number=46992314-0403-2";
const fbs =
  "https://seller.ozon.ru/app/postings/fbs?tab=delivering&postingDetails=46992314-0403-1";

test("current FBO and FBS links produce a mixed tracking list", () => {
  assert.deepEqual(OzonPostingsFormMapper.build({ links: `${fbo}\n${fbs}` }), {
    ozonPostings: [
      { number: "46992314-0403-1", scheme: "fbs" },
      { number: "46992314-0403-2", scheme: "fbo" },
    ],
  });
});

test("leading zeroes are preserved and duplicate links collapse across query parameters", () => {
  const url = fbo.replace("46992314", "0121544692");
  assert.deepEqual(
    OzonPostingsFormMapper.build({ links: ` ${url}\r\n\n${url}&from=orders` }),
    {
      ozonPostings: [{ number: "0121544692-0403-2", scheme: "fbo" }],
    },
  );
  assert.deepEqual(
    OzonPostingsFormMapper.build({
      links: `${fbs}\n${fbs.replace("tab=delivering&", "tab=all&")}`,
    }).ozonPostings,
    [{ number: "46992314-0403-1", scheme: "fbs" }],
  );
});

test("saved mixed shipments reopen with their original schemes and current URLs", () => {
  const payload = OzonPostingsFormMapper.build({ links: `${fbo}\n${fbs}` });
  const values = OzonPostingsFormMapper.getValues(payload.ozonPostings);
  assert.equal(values.links, `${fbs}\n${fbo}`);
  assert.deepEqual(OzonPostingsFormMapper.build(values), payload);
  assert.equal(
    OzonPostingUrl.build("0121544692-0182-3", "fbo"),
    "https://seller.ozon.ru/app/postings/fbo/details?posting_number=0121544692-0182-3",
  );
});

test("a malformed link rejects the whole list", () => {
  for (const invalid of [
    fbo.replace("seller.ozon.ru", "seller.ozon.ru.example.com"),
    fbs.replace("https:", "http:"),
    fbs.replace("seller.ozon.ru", "seller.ozon.ru@evil.test"),
    fbs.replace("/fbs?", "/fbs/extra?"),
    fbo.replace("/details?", "/details/extra?"),
    fbo.replace("posting_number", "postingDetails"),
    fbs.replace("postingDetails", "posting_number"),
    `${fbo}&posting_number=1-2-3`,
    `${fbs}&postingDetails=1-2-3`,
    fbo.replace("46992314-0403-2", ""),
    fbs.replace("46992314-0403-1", "1-2-x"),
    `${fbo}%0A`,
    fbo.replace("46992314-0403-2", `${"1".repeat(61)}-2-3`),
    "https://seller.ozon.ru/app/postings/fbo/46992314-0403-2",
    "46992314-0403-2",
  ]) {
    assert.equal(
      ozonPostingsFormSchema.safeParse({ links: `${fbo}\n${invalid}` }).success,
      false,
      invalid,
    );
    assert.throws(() =>
      OzonPostingsFormMapper.build({ links: `${fbo}\n${invalid}` }),
    );
  }
});

test("the same posting cannot belong to both schemes", () => {
  assert.equal(
    ozonPostingsFormSchema.safeParse({
      links: `${fbo}\n${fbs.replace(/-1$/, "-2")}`,
    }).success,
    false,
  );
});

test("an empty list clears both tracking lists and the 50-link limit still applies", () => {
  assert.deepEqual(OzonPostingsFormMapper.build({ links: " \n " }), {
    ozonPostings: [],
  });
  assert.equal(
    ozonPostingsFormSchema.safeParse({ links: Array(51).fill(fbs).join("\n") })
      .success,
    false,
  );
});
