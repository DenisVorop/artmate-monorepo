"""Build complete event conditions from a frozen contest read model.

This is an offline document builder, not a runtime publication endpoint.
It rejects missing prize configuration and manual evaluation terms.
"""

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

MOSCOW = ZoneInfo("Europe/Moscow")
MONTHS = ("января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря")


def stamp(value):
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("A timezone is required")
    date = date.astimezone(MOSCOW)
    return f"{date.day} {MONTHS[date.month - 1]} {date.year} года, {date:%H:%M:%S}"


def money(kopecks):
    if not isinstance(kopecks, int) or isinstance(kopecks, bool) or kopecks < 0:
        raise ValueError("A nonnegative integer amount in kopecks is required")
    whole, fraction = divmod(kopecks, 100)
    return f"{whole:,}".replace(",", " ") + (f",{fraction:02d}" if fraction else "") + " ₽"


def make_section(title, *paragraphs):
    return {"title": title, "paragraphs": list(paragraphs)}


def generate(contest, supplements):
    edition = json.loads(Path(__file__).with_name("documents.json").read_text(encoding="utf-8"))
    required = ("slug", "title", "task", "rules", "prize", "prizeDetail", "winnersCount", "selectionMode", "opensAt", "closesAt", "drawAt", "version")
    for key in required:
        if key not in contest or contest[key] is None:
            raise ValueError(f"Missing contest field: {key}")
    if contest["selectionMode"] not in ("AUTOMATIC", "MANUAL"):
        raise ValueError("Unsupported selection mode")
    dates = [datetime.fromisoformat(contest[key].replace("Z", "+00:00")) for key in ("opensAt", "closesAt", "drawAt")]
    if any(date.tzinfo is None for date in dates) or not dates[0] < dates[1] < dates[2]:
        raise ValueError("Сроки должны содержать часовой пояс и следовать в порядке начала, окончания и выбора")
    count = contest["winnersCount"]
    if not isinstance(count, int) or isinstance(count, bool) or count < 1:
        raise ValueError("winnersCount must be a positive integer")
    if not contest.get("prizePromoTerms") and not contest.get("prizeAlbumQuantity"):
        raise ValueError("Приз описан текстом, но состав альбомного приза или промокод не настроены")
    name = contest["title"]
    additional_rules = [rule for rule in contest["rules"] if rule.strip() not in {"Одна работа от участника.", "Одна заявка от участника."}]
    sections = [make_section("1. Мероприятие и участие",
        f"1.1. Наименование: «{name}». Страница мероприятия: https://artmate.ru/contests/{contest['slug']}. Организатор: ИП Воропаев Денис Юрьевич, ИНН 772459963613, ОГРНИП 324774600166803; support@artmate.ru.",
        f"1.2. Участвовать можно с 18 лет. Участие бесплатное; новая покупка и чек не нужны. Один человек подаёт одну заявку с одной фотографией. Применяются Правила конкурсов Artmate в редакции от {edition['editionLabel']}, версия {edition['version']}.",
        f"1.3. Задание: {contest['task']}",
        *(["1.4. " + " ".join(additional_rules)] if additional_rules else [])),
        make_section("2. Сроки",
            f"2.1. Начало приёма: {stamp(contest['opensAt'])}. Окончание приёма: {stamp(contest['closesAt'])}. После указанного времени новые работы не принимаются.",
            f"2.2. Выбор победителей — {stamp(contest['drawAt'])}. Время московское, UTC+3. Если проверка не завершена или произошёл сбой, организатор сообщает на странице конкурса причину задержки и новый срок объявления результатов.")]
    if contest["selectionMode"] == "AUTOMATIC":
        method = "3.1. После завершения проверки программа случайно перемешивает зафиксированный список одобренных заявок и выбирает победителей без повторов. У всех допущенных заявок равные шансы. Лайки и покупки на результат не влияют. Результат сохраняется и повторным запуском не меняется."
    else:
        for key in ("manualCriteria", "manualTieBreak", "manualEvaluator"):
            if not supplements.get(key):
                raise ValueError(f"Не заполнен порядок ручного выбора: {key}")
        method = f"3.1. Работы оценивает {supplements['manualEvaluator']}. Критерии и порядок оценки: {supplements['manualCriteria']}. При равенстве оценок: {supplements['manualTieBreak']}. Решение сохраняется с основаниями выбора."
    sections.append(make_section("3. Победители", method,
        f"3.2. Число победителей: {count}. Все победители равноправны, места не распределяются. Если допущенных работ меньше этого числа, выигрывают все допущенные участники. При отсутствии допущенных работ победители не определяются.",
        "3.3. Результаты публикуются на странице конкурса с соблюдением согласия на распространение данных. Приз появляется в разделе «Мои призы» аккаунта победителя."))
    detail = contest["prizeDetail"].strip()
    prize_paragraphs = ([f"4.1. Приз — {contest['prize']}. {detail}"]
                        if detail and detail != "Личный промокод победителю." else [])
    if contest.get("prizeAlbumQuantity"):
        ids = contest.get("prizeAlbumIds", [])
        quantity = contest["prizeAlbumQuantity"]
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1 or len(ids) < quantity or len(ids) != len(set(ids)):
            raise ValueError("Некорректное количество или список альбомов")
        catalog = supplements.get("albumSnapshot", {})
        if not ids or any(not catalog.get(product_id, {}).get("title") for product_id in ids):
            raise ValueError("Не сохранён полный список названий призовых альбомов")
        common = json.loads(Path(__file__).with_name("admin-field-map.json").read_text(encoding="utf-8"))["commonTerms"]
        days = common["albumDispatchCalendarDays"]
        if not isinstance(days, int) or isinstance(days, bool) or days < 1:
            raise ValueError("Не установлен срок передачи альбомного приза в доставку")
        titles = "; ".join(catalog[product_id]["title"] for product_id in ids)
        prize_paragraphs.extend([
            f"4.2. Каждый победитель выбирает {contest['prizeAlbumQuantity']} разных альбомов из списка: {titles}.",
            f"4.3. Альбомы и доставка в доступный ПВЗ Ozon в России оплачиваются организатором. Организатор оформляет заказ и передаёт его в доставку в течение {days} календарных дней после получения полного выбора альбомов, необходимых данных получателя и доступного ПВЗ. Срок обращения за призом не ограничен. Сроки перевозки и хранения зависят от доставки Ozon. Если товара нет, организатор согласует исполнение с победителем; право на приз сохраняется."
        ])
    terms = contest.get("prizePromoTerms")
    if terms:
        if terms.get("endsAt"):
            ending = datetime.fromisoformat(terms["endsAt"].replace("Z", "+00:00"))
            starting = datetime.fromisoformat(terms["startsAt"].replace("Z", "+00:00")) if terms.get("startsAt") else None
            if ending.tzinfo is None or ending <= dates[2] or (starting and (starting.tzinfo is None or starting >= ending)):
                raise ValueError("Промокод должен действовать после определения победителей")
        if terms["type"] == "FIXED":
            discount = money(terms["amountKopecks"])
        elif terms["type"] == "PERCENTAGE":
            bp = terms.get("basisPoints")
            if not isinstance(bp, int) or isinstance(bp, bool) or not 0 < bp <= 10000:
                raise ValueError("Некорректный процент скидки")
            discount = f"{bp / 100:g}%"
        else:
            raise ValueError("Unsupported promo type")
        minimum = money(terms["minSubtotalKopecks"])
        cap = f"Максимальная скидка — {money(terms['maxDiscountKopecks'])}." if terms.get("maxDiscountKopecks") is not None else ("Скидка равна указанной сумме, но не превышает стоимость товаров в заказе." if terms["type"] == "FIXED" else "Отдельного денежного предела скидки не установлено; скидка не превышает стоимость товаров в заказе.")
        start = f"Код действует не ранее {stamp(terms['startsAt'])}." if terms.get("startsAt") else "Код действует с момента выдачи после определения победителя."
        end = f"Код перестаёт действовать {stamp(terms['endsAt'])}." if terms.get("endsAt") else "Срок окончания действия не установлен."
        prize_paragraphs.extend([
            f"4.2. Каждый победитель получает один персональный промокод со скидкой {discount}. Код применяется к стоимости товаров заказа на сайте Artmate при сумме товаров от {minimum}, без учёта доставки. {cap}",
            f"4.3. {start} {end}",
            "4.4. Код используется один раз в аккаунте победителя. На заказ действует один промокод. Скидка рассчитывается от текущих цен товаров, включая сниженные, и не уменьшает стоимость доставки. Неиспользованный остаток скидки деньгами не выплачивается. Бесплатная доставка по коду не предоставляется.",
            "4.5. После объявления результатов код можно скопировать в «Моих призах» или выбрать среди личных промокодов в корзине при оформлении заказа. Временное резервирование кода при оформлении не считается отдельным использованием. Код используется либо снова становится доступным в зависимости от состояния заказа."
        ])
    prize_paragraphs = [re.sub(r"^4\.\d+\.", f"4.{index}.", text) for index, text in enumerate(prize_paragraphs, 1)]
    sections.append({"title": "4. Приз и получение", "paragraphs": prize_paragraphs})
    sections.append(make_section("5. Документы и данные",
        "5.1. Публикация работ, использование фотографии, налоги и обращения регулируются Правилами. Согласия на обработку и распространение персональных данных предоставляются отдельно, каждое на 15 лет с правом досрочного прекращения по закону.",
        "5.2. До отправки заявки участник видит Правила, эти Условия и свои согласия. Организатор сохраняет принятую редакцию. Использование фотографии в социальных сетях и рекламе разрешено в пределах лицензии и оснований обработки данных. Подписка на рекламу для участия не нужна.",
        "5.3. Вопросы по участию, правам на работу, публикации и призу принимаются по support@artmate.ru. Условия не ограничивают предусмотренные законом права и способы защиты."))
    return {"slug": "contest-event-conditions", "title": f"Условия конкурса «{name}»",
        "lead": f"В Условиях указаны задание, сроки и приз конкурса «{name}». Они применяются вместе с Правилами конкурсов Artmate.",
        "sections": sections}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--supplements", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    supplements = json.loads(args.supplements.read_text(encoding="utf-8")) if args.supplements else {}
    result = generate(payload, supplements)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
