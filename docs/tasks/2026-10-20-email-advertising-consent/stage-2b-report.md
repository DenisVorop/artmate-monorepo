# Этап 2b — схема и контракты паролей и активации

Работа выполнена в ветке `codex/email-advertising-consent`. Этот срез готовит хранение и междоменные контракты; новые HTTP handlers и выдача сессии в него не входят.

## Что изменено

- `VerifiedIdentityFactV1` хранит подтверждение конкретного email и его реальную дату. Добавлены методы ссылки активации и прежней подтверждённой проверки, а также user snapshot. Старый enum заменён на `AuthEmailVerificationMethod`.
- Новый `AuthAuthenticationFactV1` отдельно хранит способ текущего входа, источник операции, пользователя/аккаунт, `authVersion`, время и полный очищенный requestContext. Для пароля обязателен snapshot `credentialUpdatedAt`. Верный пароль не изображается новым вводом email-кода.
- Flow и completion связаны с одним authentication/email proof составными FK. Браузерная привязка, capability, пользователь, purpose и expiry flow неизменяемы; другой login с тем же email не может подменить provenance операции.
- В `AuthPendingFlow` добавлены `credentialPasswordHash`, `credentialExpiresAt`, `credentialOperationKey`: только scrypt hash нового пароля, ограниченный срок и intended operation. Только signup/activation, без passwordConfirm. Hash/key/TTL нельзя заменить; закрытие flow требует очистки. Active credential и сессия при сохранении этого состояния не создаются.
- Activation flow хранит уникальный token ID и expiry без bearer-секрета. Deferred constraint связывает flow с расходованием существующей ссылки того же пользователя в одной Auth-транзакции. Ссылка не создаёт обычную сессию. Старые ссылки и записи не меняются.
- Добавлены безопасные read/intent/result contracts для pending flow, completion и обмена ссылки. Published contracts не содержат пароль, хеш или секрет токена.

Auth владеет только своей новой записью authentication/flow/operation. Users по-прежнему владеет профилем, Consents — разрешениями и историей, Orders — заказами. Общей транзакции записи всех доменов и новых прямых вызовов чужих business services нет. Поля состояния галочек и `continue` не возвращены; optional `source`, версии документов/формы и requestContext сохранены.

## Миграция

Добавлена `apps/api/prisma/migrations/20261020160000_password_activation_contracts/migration.sql`. Прежняя миграция этапа 2 не переписана. Новая не меняет пользователей, credentials, заказы, действующие activation tokens или подписки.

Если уже есть V1 flows/completion operations без authentication provenance, миграция останавливается до DDL и требует явного переноса. Она не выдумывает password/code evidence и не удаляет старые операции. Это проверено откатом всей транзакции. Рабочая и production-БД не мигрировались.

## Проверки

- Prisma validate; имена новых FK/индексов сверены с DDL Prisma.
- API `check-types`, `check-types:test`, `lint`, `build` — прошли на Node 22.13.1.
- **106 tests, 7 suites: passed; failed/skipped — 0.** В том числе **31 SQL migration test**: 15 прежних и 16 новых.
- Миграции применены по полной реальной истории в изолированном PGlite, без `DATABASE_URL` и внешней БД. Проверены сохранность legacy данных, разные даты verification/authentication, контекст, immutable facts, FK/unique binding, TTL/формат/очистка hash, CAS-предикат одноразовой ссылки, неправильный user/expiry/consume и сохранение evidence после TTL cleanup.
- Адресные регрессии: auth versioning, прежняя order activation и password recovery. Полный API suite этим запуском не заменён.
- `git diff --check` прошёл. Форматирование посторонних Prisma-схем убрано; UI 1b и основной checkout не изменялись.

Лог: [verification/stage-2b/auth-tests.log](./verification/stage-2b/auth-tests.log). Сводка: [verification/stage-2b/summary.json](./verification/stage-2b/summary.json).

Первый lint запуск пересёкся с регенерацией Prisma Client и завершился ENOENT по generated-файлу. После завершения генерации повторный lint прошёл. Дальнейшие проверки выполнялись без этой гонки.

## Что требует следующего этапа

В истории обнаружен backfill `email_verified_at = created_at` в миграции `20260507120000`. Такую дату нельзя автоматически объявлять доказательством владения почтой. До публикации прежнего email proof в 3a нужно проверить реальный источник; парольный вход остаётся без кода. Никакого нового backfill в 2b нет.

HTTP-проверка секрета ссылки, предварительный browser binding, восстановление своего flow при потере ответа, проверка парольного хеша и статуса аккаунта — runtime 3a/3b. Финальная проверка версий, отсутствие конкурентного credential, его insert/CAS и выдача сессии после domain results — этап 5. Две реальные параллельные HTTP/DB-сессии в этом срезе не тестировались: проверены SQL ограничения и локальные транзакции, а не будущий обработчик.

Следующий срез — **3a: password login и регистрационный email-code pipeline**. Commit, push, deploy, реальные письма и переход к 3a не выполнялись.
