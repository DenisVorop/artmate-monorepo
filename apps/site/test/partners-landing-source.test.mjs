import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

function readPartnerFile(file) {
  return readFile(new URL(`../src/_pages/partners/ui/${file}`, import.meta.url), "utf8");
}

test("partner journey presents four required steps in order", async () => {
  const source = await readPartnerFile("steps.tsx");
  const titles = [
    "Оставляете заявку",
    "Подписываем договор",
    "Выкладываете промокоды",
    "Выводите вознаграждение",
  ];
  const positions = titles.map((title) => source.indexOf(title));
  const descriptions = [
    "Расскажите о себе и оставьте ссылку на блог.",
    "Обсудим условия, подпишем договор и откроем вам кабинет.",
    "Создавайте промокоды и делитесь ими с подписчиками.",
    "Следите за доходом и запрашивайте выплату в кабинете.",
  ];

  assert.ok(positions.every((position) => position >= 0), "all four partner steps must exist");
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
  for (const description of descriptions) {
    assert.match(source, new RegExp(description.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.doesNotMatch(source, /5\s?000|₽/u);
  assert.doesNotMatch(source, /Запускайте партнёрство|Три ясных шага/u);
});

test("partner journey keeps anchors and responsive semantic structure", async () => {
  const source = await readPartnerFile("steps.tsx");

  assert.match(source, /<section[\s\S]*id="how-it-works"[\s\S]*aria-labelledby="partner-steps-title"/u);
  assert.match(source, /<ol[^>]*className="[^"]*grid[^"]*sm:grid-cols-2[^"]*lg:grid-cols-4/u);
  assert.match(source, /<li key=\{number\}/u);
  assert.match(source, /import \{ routes \} from "@\/shared\/constants"/u);
  assert.match(source, /href=\{`\$\{routes\.partners\}#partner-application`\}/u);
  assert.match(source, /<a href=\{`\$\{routes\.partners\}#partner-application`\}>/u);
  assert.match(source, /<ArrowDownRight\s+aria-hidden/u);
  assert.doesNotMatch(source, /CtaGradientLink/u);
  assert.doesNotMatch(source, /href="#partner-application"/u);
  assert.match(source, /aria-hidden/u);
});

test("partner cards preserve title space without hover movement", async () => {
  const source = await readPartnerFile("steps.tsx");

  assert.match(source, /lg:px-5 xl:px-7/u);
  assert.match(source, /transition-\[background-color,box-shadow\]/u);
  assert.match(source, /motion-reduce:transition-none/u);
  assert.doesNotMatch(source, /(?:hover|group-hover(?:\/[\w-]+)?):[^\s"]*(?:translate|scale|rotate)/u);
  assert.doesNotMatch(source, /transition-\[[^\]]*transform/u);
  assert.match(source, /Начните с заявки — мы свяжемся с вами и обсудим условия\./u);
  assert.doesNotMatch(source, /Последовательный путь от первого контакта/u);
});

test("benefit builder keeps its flow and explains individual reward terms", async () => {
  const source = await readPartnerFile("benefit-builder.tsx");

  assert.match(source, /<BenefitFlow\s*\/>/u);
  assert.match(
    source,
    /Для авторов с хорошими результатами можем индивидуально увеличить процент вознаграждения\.\s+Условия обсуждаем отдельно\./u,
  );
});
