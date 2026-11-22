import type { Contest } from "../../generated/prisma/client";
import { contestPrizes, prizeProductGroups } from "../prize-definitions";
import type { PromoPrizeTerms } from "../../promocodes/contracts/prize-template.publication";
import { contestLegalPacket, type LegalText } from "./contest-legal.constants";

export type PrizeProductSnapshot = { id: string; title: string; slug: string };
export function legalReadiness(
  contest: Pick<
    Contest,
    | "selectionMode"
    | "manualCriteria"
    | "manualTieBreak"
    | "manualEvaluator"
    | "prizeAlbumQuantity"
    | "prizeAlbumIds"
    | "prizePromoTerms"
    | "prizeMode"
    | "prizePlaces"
    | "prize"
    | "prizeDetail"
    | "prizeMarkerQuantity"
    | "prizeMarkerIds"
    | "prizePromoCodeId"
    | "winnersCount"
  >,
) {
  const errors: string[] = [];
  const prizes = contestPrizes(contest);
  if (
    !prizes.length ||
    (contest.prizeMode === "PLACES" && prizes.length !== contest.winnersCount)
  )
    errors.push("Настройте приз для каждого места");
  for (const prize of prizes) {
    if (
      !prize.prize.trim() ||
      (!prizeProductGroups(prize).length && !prize.prizePromoTerms)
    )
      errors.push("Настройте товары или промокод в призе");
    if (
      prizeProductGroups(prize).some(
        (group) => group.productIds.length < group.quantity,
      )
    )
      errors.push("Выберите достаточно призовых товаров");
  }
  if (
    contest.selectionMode === "MANUAL" &&
    [
      contest.manualCriteria,
      contest.manualTieBreak,
      contest.manualEvaluator,
    ].some((value) => !value?.trim())
  )
    errors.push(
      "Заполните критерии, порядок оценки, правило равных оценок и того, кто выбирает победителей",
    );
  return errors;
}
function stamp(value: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
function money(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value / 100)} ₽`;
}
function albumWord(quantity: number) {
  const form = new Intl.PluralRules("ru-RU").select(quantity);
  return form === "one"
    ? "альбом"
    : form === "few"
      ? "разных альбома"
      : "разных альбомов";
}
export function buildContestConditions(
  contest: Contest,
  albums: PrizeProductSnapshot[],
): LegalText {
  const error = legalReadiness(contest);
  if (error.length) throw new Error(error.join(". "));
  const sections: LegalText["sections"] = [];
  const section = (title: string, paragraphs: string[]) => {
    const n = sections.length + 1;
    sections.push({
      title: `${n}. ${title}`,
      paragraphs: paragraphs.map((text, i) => `${n}.${i + 1}. ${text}`),
    });
  };
  section("Мероприятие и участие", [
    `Наименование: «${contest.title}». Страница мероприятия: https://artmate.ru/contests/${contest.slug}. Организатор: ИП Воропаев Денис Юрьевич, ИНН 772459963613, ОГРНИП 324774600166803; support@artmate.ru.`,
    `Участвовать можно с 18 лет. Участие бесплатное; новая покупка и чек не нужны. Один человек подаёт одну заявку с одной фотографией. Применяются Правила конкурсов Artmate в редакции от 22 ноября 2026 года, версия ${contestLegalPacket.edition}.`,
    `Задание: ${contest.task}`,
    ...contest.rules.filter(
      (rule) =>
        !["Одна работа от участника.", "Одна заявка от участника."].includes(
          rule.trim(),
        ),
    ),
  ]);
  section("Сроки", [
    `Начало приёма: ${stamp(contest.opensAt)}. Окончание приёма: ${stamp(contest.closesAt)}. После указанного времени новые работы не принимаются.`,
    `Выбор победителей — ${stamp(contest.drawAt)}. Время московское, UTC+3. Если проверка не завершена или произошёл сбой, организатор сообщает на странице конкурса причину задержки и новый срок объявления результатов.`,
  ]);
  section("Победители", [
    contest.selectionMode === "AUTOMATIC"
      ? "После завершения проверки программа случайно перемешивает зафиксированный список одобренных заявок и выбирает победителей без повторов. У всех допущенных заявок равные шансы. Лайки и покупки на результат не влияют. Результат сохраняется и повторным запуском не меняется."
      : `Работы оценивает: ${contest.manualEvaluator}. Критерии и порядок оценки: ${contest.manualCriteria}. При равенстве оценок: ${contest.manualTieBreak}. Решение сохраняется вместе с основаниями выбора.`,
    contest.prizeMode === "PLACES"
      ? `Число призовых мест: ${contest.winnersCount}. Места распределяются последовательно: первый выбранный участник получает первое место, следующий — второе и так далее. При случайном выборе используется сохранённый порядок перемешанного списка; при оценке работ — порядок, определённый по объявленным критериям. Один человек не может занять несколько мест. Если допущенных работ меньше числа мест, заполняются первые места по порядку; остальные остаются незанятыми. При отсутствии допущенных работ победители не определяются.`
      : `Число победителей: ${contest.winnersCount}. Все победители получают одинаковые призы, места не распределяются. Если допущенных работ меньше этого числа, выигрывают все допущенные участники. При отсутствии допущенных работ победители не определяются.`,
    "Результаты публикуются на странице конкурса с соблюдением согласия на распространение данных. Приз появляется в разделе «Мои призы» аккаунта победителя.",
  ]);
  const prizes: string[] = [];
  for (const [index, prize] of contestPrizes(contest).entries()) {
    prizes.push(
      `${contest.prizeMode === "PLACES" ? `${index + 1}-е место` : "Каждому победителю"}: ${prize.prize}.${prize.prizeDetail ? ` ${prize.prizeDetail}` : ""}`,
    );
    for (const group of prizeProductGroups(prize)) {
      const products = group.productIds.map((id) =>
        albums.find((product) => product.id === id),
      );
      if (products.some((product) => !product))
        throw new Error("Не удалось сохранить список призовых товаров");
      const names = products.map((product) => product!.title).join("; ");
      prizes.push(
        group.productIds.length === group.quantity
          ? `Победитель получает по одной единице каждого товара: ${names}.`
          : `Победитель выбирает ${group.quantity} ${group.kind === "albums" ? albumWord(group.quantity) : "набора маркеров"} из списка: ${names}. Каждый товар можно выбрать один раз. Выбор альбомов и наборов маркеров учитывается отдельно: одну часть приза нельзя заменить другой.`,
      );
    }
    if (prize.prizePromoTerms)
      prizes.push(...promoConditions(prize.prizePromoTerms));
  }
  if (contestPrizes(contest).some((prize) => prizeProductGroups(prize).length))
    prizes.push(
      "Товары и доставка в доступный ПВЗ Ozon в России оплачиваются организатором. Он оформляет заказ и передаёт его в доставку в течение 30 календарных дней после получения полного выбора товаров, необходимых данных получателя и доступного ПВЗ. Срок обращения за призом не ограничен. Сроки перевозки и хранения зависят от доставки Ozon. Если товара нет, организатор согласует исполнение с победителем; право на приз сохраняется.",
    );
  section("Призы и получение", prizes);
  if (contest.participationPromoTerms)
    section("Приз за участие", [
      "Персональный промокод получают участники с одобренной и допущенной к подведению итогов работой, которые не стали победителями. Отклонённые, скрытые и не допущенные заявки права на этот код не дают. Состав получателей фиксируется вместе с итогами. Один участник получает один код за участие; победителям этот код не выдаётся.",
      ...promoConditions(
        contest.participationPromoTerms as unknown as PromoPrizeTerms,
      ),
    ]);
  section("Документы и данные", [
    "Публикация работ, использование фотографии, налоги и обращения регулируются Правилами. Согласия на обработку и распространение персональных данных предоставляются отдельно, каждое на 15 лет с правом досрочного прекращения по закону.",
    "До отправки заявки участник видит Правила, эти Условия и свои согласия. Организатор сохраняет принятую редакцию. Использование фотографии в социальных сетях и рекламе разрешено в пределах лицензии и оснований обработки данных. Подписка на рекламу для участия не нужна.",
    "Вопросы по участию, правам на работу, публикации и призу принимаются по support@artmate.ru. Условия не ограничивают предусмотренные законом права и способы защиты.",
  ]);
  return {
    title: `Условия конкурса «${contest.title}»`,
    lead: `В Условиях указаны задание, сроки и приз конкурса «${contest.title}». Они применяются вместе с Правилами конкурсов Artmate.`,
    sections,
  };
}

function promoConditions(terms: PromoPrizeTerms): string[] {
  const discount =
    terms.type === "FIXED"
      ? money(terms.amountKopecks!)
      : `${new Intl.NumberFormat("ru-RU").format(terms.basisPoints! / 100)}%`;
  return [
    `Персональный промокод даёт скидку ${discount} на товары заказа на сайте Artmate при сумме товаров от ${money(terms.minSubtotalKopecks)}, без учёта доставки. ${terms.maxDiscountKopecks !== null ? `Максимальная скидка — ${money(terms.maxDiscountKopecks)}.` : "Скидка не превышает стоимость товаров в заказе."}`,
    `${terms.startsAt ? `Код действует не ранее ${stamp(terms.startsAt)}.` : "Код действует с момента выдачи после подведения итогов."} ${terms.endsAt ? `Код перестаёт действовать ${stamp(terms.endsAt)}.` : "Срок окончания действия не установлен."}`,
    "Код используется один раз в аккаунте получателя. На заказ действует один промокод. Скидка рассчитывается от текущих цен товаров, включая сниженные, и не уменьшает стоимость доставки. Неиспользованный остаток скидки деньгами не выплачивается. Бесплатная доставка по коду не предоставляется.",
    "Код можно скопировать в «Моих призах» или выбрать среди личных промокодов в корзине при оформлении заказа. Временное резервирование не считается отдельным использованием. Код используется либо снова становится доступным в зависимости от состояния заказа.",
  ];
}
