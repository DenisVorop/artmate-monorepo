# Отчёт этапа 2 — хранение и междоменные контракты

Дата: 20.10.2026. Ветка: `codex/email-advertising-consent`. Предыдущий UI-этап закоммичен по запросу пользователя: `c3e21a2f` — `feat(auth): add reusable sign-in step UI`. Этап 2 оставлен незакоммиченным для review. Актуальное продолжение — [progress.md](./progress.md).

## Результат

Добавлены 14 таблиц, одна транзакционная миграция и конкретные TypeScript-контракты. Данные распределены по владельцам, без вызовов соседних бизнес-сервисов и без пустых NestJS providers:

| Владелец | Схема и назначение |
| --- | --- |
| Auth | `auth-flow.prisma`: challenge с HMAC hash/key version/nonce, browser-bound pending draft, immutable exact-email identity, completion operation/result |
| Users | `customer-profile.prisma`: опубликованный профиль/version/status и канал EnsureCustomerProfile с intent, claim/lease и terminal result |
| Consents | `consents.prisma`: версии документов/форм, required acceptance, decision command/result, required-readiness, subscription и grant/revoke timeline |
| Notifications / Consents | `advertising-evidence.prisma`: попытки доставки с точными MIME-байтами/outcome и append-only audit доступа к evidence |

`User` получил только inverse relation к текущей Users-owned projection; столбцы аккаунтов и их содержимое не изменяются. Evidence содержит снимки User ID, без каскадной связи с аккаунтом. Временные challenge/pending flow можно удалить независимо от долговечных identity/operation/evidence.

Серверные контракты находятся в `src/auth/contracts`, `src/users/contracts`, `src/consents/contracts`. Команда имеет стабильный operationId, неизменяемый payload и подтверждённый результат. Создание команды ещё не означает вход или принятие согласия; атомарные handlers/claims/recovery подключаются на этапах 3–5. Общий command bus и дублирующие outbox/inbox таблицы без собственной роли не добавлены.

## Инварианты хранения

- PDF/form/MIME сохраняются точными байтами вместе с проверяемым SQL SHA-256. Новая редакция требует новой записи; публикация и retirement не переписывают содержание или прежние даты.
- Согласие связано с exact email, identity, operation, purpose и конкретной опубликованной редакцией. Неподтверждённый/другой email, неподходящий тип документа, неопубликованная/отозванная редакция отклоняются.
- RequiredConsentAcceptance хранит факт принятия со ссылкой на редакцию формы/документа. Рекламная история хранит granted/revoked; состояния чекбоксов и код кнопки удалены. Optional source обозначает место получения согласия, например auth_form/account_notifications, и не участвует в разрешении рекламы.
- Consent decision в DB-канале принимает boolean, отклоняет строки/null и дубли редакций. Неизменяемый intent нельзя заменить на retry; уникальные operation/identity-source/version keys предотвращают дубли записей.
- Subscription по умолчанию revoked. Deferred constraint не разрешает commit event без соответствующего актуального permission: grant/revoke и projection меняются одной локальной транзакцией. Старый grant не восстанавливает permission после revoke.
- Delivery attempt привязана к точному адресату grant, хранит исходящее содержимое и различает accepted/rejected/not_sent/uncertain. Accepted — приём SMTP, не доставка/прочтение. Неопределённый outcome не переписывается задним числом.

## Уточнение контекста запроса

По запросу пользователя ограниченные IP/User-Agent/source-поля заменены обязательным `requestContext` JSON v1 в identity fact, consent command/acceptance/event и audit. Контракт `common/request-evidence.ts` включает method/URL/HTTP version, timestamp, все доступные headers/query с повторными значениями, адреса/порты/TLS соединения, client IP/цепочку forwarded и server-derived признак доверия proxy. Ограничения 512 символов для User-Agent больше нет. Credentials/cookies/OTP/password/CSRF/provider/unsubscribe tokens не сохраняются; очистка URL/query/header values обязательна на HTTP-границе при подключении capture. Никакого request logger или сбора живых запросов этим уточнением не подключено.

PDF по-прежнему хранится в БД один раз на редакцию, а acceptance/event содержит revisionId. По последнему запросу initial_checked/final_checked и submit_action удалены. Факт принятия/отзыва, revisionId, время и полный requestContext сохранены. source — optional VARCHAR(255), без значения сохраняется NULL.

## Проверки и ограничения

- Prisma validate, API check-types, check-types:test, lint и build — пройдены.
- В изолированном PGlite применена вся реальная история миграций, включая новую; 15 адресных тестов passed, 0 failed/skipped. Старый User вставлен до новой миграции: автопубликации/подписки/verification backfill нет.
- Проверены сохранение evidence при смене/удалении User и очистке временных данных, SHA/immutability, неправильные decisions JSON/identity/revision и optional source, повторные ключи, command results, grant/revoke consistency, SMTP uncertainty и audit.
- Общий API runner до уточнения requestContext: первый batch — 1622 tests, 1621 passed, 1 failed. Старый `welcome-promocodes.spec.ts` не предоставляет `product.findMany` в Prisma mock, используемый неизменённым `readProductPrices`. То же падение воспроизведено на временном архиве исходного коммита `c3e21a2f` со старой схемой и отдельным Prisma Client: 10 passed / 1 failed. Промокоды не изменялись. Runner останавливается после этого batch; отдельные postgres suites не запускались.
- Это проверка SQL в embedded PostgreSQL, не гонок независимых соединений/SMTP handoff. Такие проверки относятся к handlers/send gate.
- Триггеры защищают обычные операции, но не заменяют выделенные runtime/maintenance DB-роли: владелец БД может отключать триггеры. Привилегии, контролируемый retention/legal hold и архив/экспорт остаются этапами 10/12.
- Юридические документы не публиковались, новые согласия/identity не собирались; J1/J2/J3/Q2 не объявляются закрытыми. Читаемость новых PDF проверяется при их реальной подготовке. Временный/production DB, production env, OAuth, SMTP и реальные auth handlers этим этапом не менялись. Миграция проверена локально, не применена к рабочей базе.

Демонстрационные панели/preview routes/mock adapters в приложение не добавлялись. Следующий этап — запрос/подтверждение email-кода и ограниченный pending flow.
