import "reflect-metadata";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateContestRequestDTO } from "../src/contests/dto/contest-request.dto";
import { contestAppearances } from "../src/contests/contests.types";

const valid = {
  slug: "new-year",
  title: "Новый год",
  description: "Фото с украшениями",
  task: "Сфотографируйте раскраску",
  rules: ["Одна работа"],
  appearance: "new-year",
  prize: "Альбом",
  prizeDetail: "Один альбом",
  winnersCount: 1,
  selectionMode: "AUTOMATIC",
  opensAt: "2026-12-01T00:00:00+03:00",
  closesAt: "2026-12-28T23:59:00+03:00",
  drawAt: "2026-12-30T18:00:00+03:00",
  published: false,
};
test("contest input trims text, retains rules and accepts every supported appearance", () => {
  for (const appearance of contestAppearances) {
    const input = plainToInstance(CreateContestRequestDTO, {
      ...valid,
      appearance,
      title: "  Конкурс  ",
      rules: ["  Одна работа  "],
    });
    assert.deepEqual(validateSync(input), []);
    assert.equal(input.title, "Конкурс");
    assert.deepEqual(input.rules, ["Одна работа"]);
  }
});
test("contest input rejects unknown themes, ambiguous dates, blank rules and invalid limits", () => {
  for (const patch of [
    { appearance: "christmas" },
    { selectionMode: "VOTES" },
    { selectionMode: undefined },
    { opensAt: "2026-12-01T12:00:00" },
    { closesAt: "2026-02-30T12:00:00Z" },
    { rules: [" "] },
    { rules: [] },
    { rules: Array(31).fill("Правило") },
    { winnersCount: 0 },
    { winnersCount: 101 },
    { winnersCount: 1.5 },
    { title: " " },
    { slug: "../contest" },
  ])
    assert.ok(
      validateSync(
        plainToInstance(CreateContestRequestDTO, { ...valid, ...patch }),
      ).length,
      JSON.stringify(patch),
    );
});
test("API and shared appearance picker expose the same identifiers", async () => {
  const source = await readFile(
    resolve(__dirname, "../../../packages/ui/src/contest-design/appearance.ts"),
    "utf8",
  );
  const keys = [...source.matchAll(/^ {2}(?:"([^"]+)"|(\w+)): \{/gm)].map(
    (match) => match[1] ?? match[2],
  );
  assert.deepEqual(keys.sort(), [...contestAppearances].sort());
});
