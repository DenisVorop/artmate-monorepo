import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOzonPostingNumbers,
  ozonPostingsFormSchema,
} from "../src/features/orders-crm/lib/ozon-postings-form.ts";

const url = "https://seller.ozon.ru/app/postings/fbo/0121544692-0182-3";

test("Ozon posting links preserve leading zeroes and collapse duplicate URLs", () => {
  assert.deepEqual(
    buildOzonPostingNumbers({
      links: ` ${url}\r\n\n${url}/?from=orders\n${url.replace(/-3$/, "-4")}`,
    }),
    ["0121544692-0182-3", "0121544692-0182-4"],
  );
});

test("a malformed link rejects the whole list instead of silently excluding a shipment", () => {
  for (const invalid of [
    url.replace("seller.ozon.ru", "seller.ozon.ru.example.com"),
    url.replace("https:", "http:"),
    url.replace("seller.ozon.ru", "seller.ozon.ru@evil.test"),
    url.replace("/fbo/", "/fbs/"),
    `${url}/extra`,
    "0121544692-0182-3",
  ]) {
    assert.equal(
      ozonPostingsFormSchema.safeParse({ links: `${url}\n${invalid}` }).success,
      false,
      invalid,
    );
    assert.throws(() =>
      buildOzonPostingNumbers({ links: `${url}\n${invalid}` }),
    );
  }
});

test("an empty list clears the explicitly linked shipments", () => {
  assert.deepEqual(buildOzonPostingNumbers({ links: " \n " }), []);
});
