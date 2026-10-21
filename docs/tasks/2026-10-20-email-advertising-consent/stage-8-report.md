# Этап 8 — общий вход в бизнес-формах и checkout

21.10.2026. Ветка `codex/email-advertising-consent`, worktree `/Users/denis.voropayev/.codex/worktrees/email-advertising-consent/artmate-monorepo`. Этап выполнен без коммита и выпуска. Прежние изменения сохранены; HEAD `c3e21a2f`.

## Что изменилось

Контактная и партнёрская формы используют общий `withAuth/useAuth` и один host. После RHF validation feature создаёт отдельный frozen DTO, затем вызывает `onAuth(payload)`. Только fresh success запускает собственную business mutation. Отмена и ошибка отправки сохраняют поля; повторный submit блокируется до завершения. Success/reset появляются после подтверждённого ответа. Исходный email для связи, сообщение, Telegram и UTM не подменяются результатом входа. Он не становится адресом рекламной подписки.

Общие checkbox ПДн и клиентские boolean удалены из contact/partner UI/DTO. Серверный `SiteActionGuard` независимо проверяет JWT, актуального actor и профиль из Users directory, подтверждённый exact email и реальный acceptance текущей редакции из Consents. Подставленные actor/purpose/action/старое true отклоняются. Нет подходящего факта или registry — нет бизнес-действия. Согласие на рекламу не требуется для отправки формы.

Фиксированные actions `contact_message` и `partner_application` используют общий prerequisite `site_auth`: раньше обе формы ссылались на тот же общий документ ПДн для форм Artmate. `source` указывает место сбора, но не меняет права. Новые юридические purposes и публикация registry не создавались. J1 с конкретными документами/оператором/основаниями сохраняется до выпуска.

PartnerApplication хранит `authenticatedUserId` и настоящий `consentAcceptanceId` с FK на immutable факт согласия. Исторические consent true/false остаются историей без выдуманной provenance; новым заявкам true не выставляется. Contact notification ссылается на actor/acceptance. До успешной серверной проверки нет Telegram/partner DB side effects.

Checkout/cart promo и loyalty открывают общий вход. Promo continuation фиксирует cartId/signature/code, ждёт публикации нужного account и выполняет новый server preview. Отмена, сменившаяся корзина/код/аккаунт не используют старое продолжение. Checkout RHF и DOM сохраняются; гостевая покупка остаётся без обязательного входа, её оферта и ПДн сохранены.

Публикация fresh session централизована в Auth lib: отменяются устаревшие запросы, очищаются персональные achievement/orders/workshop/loyalty/banner/welcome caches, session обновляется до callback, pricing инвалидируется. Корзина и promo draft не удаляются. Partner analytics перенесена в typed shared transport с прежними четырьмя event IDs и cookie-consent поведением; PII не отправляется.

## Архитектура и удалённый код

- UI отвечает за разметку и RHF bindings; mappers/UI-state/provider/orchestration находятся в feature lib; отдельные mutation hooks — в model; shared actions — HTTP transport. Auth не отправляет бизнес-формы.
- Auth отвечает за identity/session и доступ; Users публикует текущий профиль; Consents владеет фактами/редакциями; Contacts и Partner сохраняют свои данные. Business DTO не могут сами дать согласие.
- Проверка настоящих Nest modules обнаружила отсутствующий export CustomerDirectoryReader, скрытый плоским native harness. Export из AuthModule исправлен. Новый `business-form.module.spec.ts` поднимает реальные imports и проверяет guard dependencies без init/listen/DB/worker connections; before/after evidence сохранены.
- Удалены site AuthForm, старые login/register/confirm/resend hooks/actions/DTO/state, мёртвый OAuth landing. Яндекс callback/new coordinator и используемые credential services сохранены.
- Удалены `/auth/register`, `/auth/email-verification/confirm`, `/auth/email-verification/resend` и общий `/auth/login`. Единственный affiliate consumer перенесён на `/auth/affiliate/login` с существующей partner role. `/auth/admin/login` сохранён. Старый EmailVerificationService удалён; рабочий email template нового регистрационного сценария сохранён.
- Историческая таблица auth_email_verification_codes оставлена без runtime consumer: произвольная очистка исторических записей не относится к этому этапу и не создаёт compatibility flow.

## Схема

Миграция `20261021100000_business_form_consent_provenance` добавляет nullable actor/acceptance provenance и FK, сохраняет прежние boolean без backfill. Новая запись требует реальной пары actor/acceptance вместо boolean. Полная история миграций проверена в изолированном окружении; рабочая БД не менялась. Новых dependencies/env-переменных нет.

## Проверки

| Проверка | Результат |
| --- | --- |
| Native PostgreSQL + Nest HTTP, полная история миграций | **122/122** |
| Адресные backend contracts/migrations/HTTP/module wiring | **132/132** |
| Полный site test suite | **546/546**, failed/skipped 0 |
| Affiliate test suite | **123/123** |
| Реальный Next build/routes/actions в браузере с локальным HTTP fixture | **13/13** |
| API/site/affiliate types, lint, build; backend test-types | Passed; финальная API build после DI fix |
| Admin types/lint; Prisma validate; git diff --check | Passed |

Native: anonymous/pending/forged JWT без side effects, missing/retired registry и acceptance, projection без реального факта, ads false с успешной отправкой, чужой reply email без grant, forged actor/purpose/action/boolean, unverified/incomplete/stale account, реальные partner rows/FK и HTTP404 старых путей. Проверены customer rejection на affiliate endpoint и сохранённые partner/admin password consumers. Notification boundary перехвачен, реальной отправки нет.

Browser: contact/partner на 320/390/1280, validation/cancel/повтор/ready session без окна, исходный payload/UTM/source, business failure/retry, cart/checkout свежий authenticated promo preview, сохранённые поля и идентичность DOM формы, loyalty cancel и гостевой заказ без auth. Проверены отсутствие overflow/nested forms и расположение общего Dialog вне caller form. Console/page errors и unexpected request failures — 0. Ожидаемые navigation/context aborts перечислены отдельно в JSON. Мобильный screenshot согласий просмотрен дополнительно.

Граница: browser использует настоящий site build и server actions с внешним локальным test API; настоящий backend проверен отдельно через Nest/Prisma/PostgreSQL. Это не production E2E, реальный SSO, SMTP или Telegram. Полный API suite не объявляется green: прежний unrelated baseline issue указан в stage-2-report. Axe/Web Vitals данным этапом не измерялись.

Материалы: [verification/stage-8](./verification/stage-8/). Own PostgreSQL62311, Next62325, fake API62326 остановлены; отсутствие listeners проверено. Рабочая БД, production/SSH, внешние отправки, Яндекс и GitHub settings не использовались.

## Продолжение

Следующий этап — **9: настройки подписки и отписка**, только по отдельному поручению. Этапы 10 и 11 отложены пользователем; рассылка не подключалась. После 9 остаются 12 → 13 → 14. До выпуска сохраняются J1/J2/J3 и публикация реальных юридических редакций; код fail-closed при отсутствующей registry. Коммита, push, deploy и миграций рабочей БД не было.
