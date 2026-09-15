-- Source: public GET https://api.artmate.ru/catalog/products, checked 2026-09-16.
-- This is a one-off, conservative backfill for the exact existing SKUs below.
-- Each fact must still be present in its original title/description at deploy time.
-- Unknown products and products already edited in the characteristics UI are untouched.
-- In particular, A4, paper density, binding and printing are NOT album defaults.

BEGIN;

-- Instructions are exact, plain-text excerpts from these three descriptions.
-- Run before inserting characteristics so even intentionally empty instructions
-- on products already edited in the new UI remain untouched.
WITH instructions (id, slug, title, source_text) AS (
  VALUES
    (
      'product_markers_artmate_168',
      'akrilovye-markery-artmate-168-cvetov',
      'Акриловые маркеры Artmate, 168 цветов',
      'Перед использованием хорошо встряхните маркер с закрытым колпачком. Направьте наконечник вниз и аккуратно нажимайте им на поверхность до появления краски. После работы плотно закрывайте колпачок. Заправка не предусмотрена.'
    ),
    (
      'cms7z2t4q003j01lg87klgqer',
      'pixel-raskraska-po-nomeram-srednevekovie',
      'Раскраска по номерам, по пикселям, средневековье, 25 картин',
      'Каждая страница представляет собой сетку из клеточек с цифровыми и буквенными обозначениями, а внизу размещена готовая цветовая палитра. Следуйте подсказкам, подбирайте соответствующие оттенки и клеточка за клеточкой собирайте цельную картину.'
    ),
    (
      'cmro3l37q003b01lgtmdgfa97',
      'raskraska-po-nomeram-mandali',
      'Раскраска по номерам «Мандалы», 25 картин',
      'Каждая иллюстрация разделена на пронумерованные области, а внизу страницы размещена готовая палитра из 8–17 оттенков. Следуйте цветовым подсказкам или создавайте собственные сочетания.'
    )
)
UPDATE products p
SET usage_instructions = i.source_text
FROM instructions i
WHERE p.id = i.id AND p.slug = i.slug AND p.title = i.title
  AND p.usage_instructions IS NULL
  AND position(i.source_text IN COALESCE(p.description, '')) > 0
  AND NOT EXISTS (
    SELECT 1 FROM product_characteristics existing WHERE existing.product_id = p.id
  );

WITH known_albums (id, slug, title, has_a4, has_190gsm, has_spiral) AS (
  VALUES
    ('cmpyaoifi000701qio3irdekb', 'raskraska-po-nomeram-fantasy', 'Раскраска по номерам «Фэнтези», 25 картин', true, false, false),
    ('cmougkcsm000501p79weu6w0i', 'raskraska-po-nomeram-zhivotnie', 'Раскраска по номерам «Животные», 25 картин', true, false, false),
    ('cmougisyx000301p7w8m7rus8', 'raskraska-po-nomeram-kotiki-2', 'Раскраска по номерам «Котики 2», 25 картин', true, false, false),
    ('cmouggbdz000001p7txxxmq6i', 'raskraska-po-nomeram-peizaji', 'Раскраска по номерам «Пейзажи», 25 картин', false, false, false),
    ('prod_otpusk_5741065761', 'raskraska-po-nomeram-otpusk', 'Раскраска по номерам, отпуск, 25 картин', false, false, false),
    ('cms7z2t4q003j01lg87klgqer', 'pixel-raskraska-po-nomeram-srednevekovie', 'Раскраска по номерам, по пикселям, средневековье, 25 картин', true, true, true),
    ('cmro3l37q003b01lgtmdgfa97', 'raskraska-po-nomeram-mandali', 'Раскраска по номерам «Мандалы», 25 картин', true, true, true),
    ('prod_yaponiya_1232256239', 'raskraska-po-nomeram-yaponiya', 'Раскраска по номерам «Япония», 25 картин', true, false, false),
    ('cmougm5r0000801p73xta4gkt', 'raskraska-po-nomeram-peizaji-2', 'Раскраска по номерам «Пейзажи 2», 25 картин', true, false, false),
    ('cmougll2i000701p7u90vr5w9', 'raskraska-po-nomeram-food', 'Раскраска по номерам «Еда», 25 картин', true, false, false),
    ('cmougkzbp000601p7tp5c3puq', 'raskraska-po-nomeram-princesses', 'Раскраска по номерам «Принцессы», 25 картин', true, false, false),
    ('cmougjoql000401p79un81qnf', 'raskraska-po-nomeram-flowers', 'Раскраска по номерам «Цветы», 25 картин', true, false, false),
    ('cmougi23d000201p70dnxtyg4', 'pixel-raskraska-po-nomeram-mystic-forest', 'Пиксельная раскраска по номерам «Загадочный лес», 25 картин', false, false, false),
    ('cmough56b000101p7h5au1d25', 'raskraska-po-nomeram-anime', 'Раскраска по номерам «Аниме», 25 картин', true, true, false),
    ('cmoslofsh000001qrj9mmaelu', 'raskraska-po-nomeram-kotiki', 'Раскраска по номерам «Котики», 25 картин', false, false, false)
), album_facts AS (
  SELECT p.id AS product_id, fact.name, fact.value, fact.is_highlighted, fact.position
  FROM known_albums k
  JOIN products p ON p.id = k.id AND p.slug = k.slug AND p.title = k.title
  CROSS JOIN LATERAL (
    VALUES
      ('Количество картин', '25', true, 0, p.title ~ '(^|[^0-9])25[[:space:]]+картин([^[:alnum:]]|$)'),
      ('Формат', 'А4', true, 1, k.has_a4 AND COALESCE(p.description, '') ~ '[Фф]ормата?[[:space:]]+[АA]4([^[:alnum:]]|$)'),
      ('Плотность бумаги', '190 г/м²', false, 2, k.has_190gsm AND COALESCE(p.description, '') ~ '[Пп]лотная бумага 190 г/м²'),
      ('Печать', 'Односторонняя', false, 3, k.has_spiral AND COALESCE(p.description, '') ~ 'Иллюстрации напечатаны с одной стороны листа'),
      ('Переплёт', 'Металлическая пружина, раскрытие на 360°', false, 4, k.has_spiral AND COALESCE(p.description, '') ~ 'металлическая пружина позволяет раскрывать альбом на 360 градусов')
  ) AS fact(name, value, is_highlighted, position, source_matches)
  WHERE fact.source_matches
), marker_facts AS (
  SELECT p.id AS product_id, fact.name, fact.value, fact.is_highlighted, fact.position
  FROM products p
  CROSS JOIN LATERAL (
    VALUES
      ('Количество цветов', '168', true, 0, p.title ~ '(^|[^0-9])168[[:space:]]+цветов([^[:alnum:]]|$)'),
      ('Тип краски', 'Акриловая', false, 1, COALESCE(p.description, '') ~ 'Акриловая краска на водной основе'),
      ('Основа', 'Водная', false, 2, COALESCE(p.description, '') ~ 'Акриловая краска на водной основе'),
      ('Наконечник', 'Гибкая нейлоновая кисть', true, 3, COALESCE(p.description, '') ~ 'Гибкий нейлоновый наконечник-кисть'),
      ('Толщина линии', '1–5 мм', false, 4, COALESCE(p.description, '') ~ 'толщину линии от 1 до 5 мм'),
      ('Комплектация', '168 акриловых маркеров и коробка для хранения', false, 5, COALESCE(p.description, '') ~ 'Комплектация: 168 акриловых маркеров и коробка для хранения[.]'),
      ('Заправка', 'Не предусмотрена', false, 6, COALESCE(p.description, '') ~ 'Заправка не предусмотрена[.]')
  ) AS fact(name, value, is_highlighted, position, source_matches)
  WHERE p.id = 'product_markers_artmate_168'
    AND p.slug = 'akrilovye-markery-artmate-168-cvetov'
    AND p.title = 'Акриловые маркеры Artmate, 168 цветов'
    AND fact.source_matches
), verified_facts AS (
  SELECT * FROM album_facts
  UNION ALL
  SELECT * FROM marker_facts
)
INSERT INTO product_characteristics (id, product_id, name, value, is_highlighted, sort_order)
SELECT
  md5(f.product_id || ':' || f.name),
  f.product_id,
  f.name,
  f.value,
  f.is_highlighted,
  (row_number() OVER (PARTITION BY f.product_id ORDER BY f.position) - 1)::INTEGER
FROM verified_facts f
WHERE NOT EXISTS (
  SELECT 1 FROM product_characteristics existing WHERE existing.product_id = f.product_id
);

COMMIT;
