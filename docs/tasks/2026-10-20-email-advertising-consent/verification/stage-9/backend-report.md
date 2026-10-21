Backend этапа 9, 21.10.2026

Реализовано чтение и отзыв рекламной подписки в домене Consents:
- GET /consents/email-advertising — AuthGuard, только текущий серверный account email, ответ {email,subscribed,version}.
- POST /consents/email-advertising/revoke — обычный CSRF, пустой body, тот же ответ. Клиентский actor/email/subscribed не принимаются.
- GET/HEAD /consents/email-advertising/unsubscribe?token=… — только 303 на фиксированную SITE_URL/unsubscribe?token, без DB write и cookie.
- POST на тот же unsubscribe URI — стандартное List-Unsubscribe=One-Click; application/x-www-form-urlencoded и bounded multipart без файлов. Доступ не зависит от cookies/JWT; нет redirect. Исключение CSRF ограничено ровно этим POST/path/content-type, точный body проверяется DTO. Ответ {unsubscribed:true}.
- POST /consents/email-advertising/unsubscribe/confirm — human JSON {token}, обычный CSRF, без login; тот же результат. Invalid capability — generic 400. Public API получает no-store/no-referrer/noindex через middleware до ошибок/validation.

Авторитетное REVOKED в email_advertising_subscriptions является suppression. Отдельной таблицы suppression нет. Consents сериализует grant/revoke общим RecipientConsentLock: advisory consents:<exact email>, затем свои state/permission row locks. ACTIVE→REVOKED атомарно добавляет immutable REVOKED event и обновляет state/version/activeGrantId. UserConsentState.revision увеличивается на каждый валидный явный отзыв, включая off/no-subscription; requiredAcceptances сохраняются. Повтор off не дублирует permission transition/event, но является новой publication fence против подготовленного до отзыва grant. Это точная семантика, а не полная неизменность внутренних revision при повторах.

Revoke не читает legal registry и не требует профиля, grant HMAC key/version, Auth proxy key или нового identity proof. Публичные запросы сохраняют непосредственный очищенный RequestEvidenceCapture; account/human могут сохранить подписанный доступный upstream context через общий TrustedProxyEvidence. Этот общий инфраструктурный verifier извлечён из Auth; Auth wrapper по-прежнему отдельно требует настроенный proxy secret для своих сценариев. Auth остаётся владельцем identity/session, Users — profile, Consents — permission/history. Auth completion продолжает читать persisted Consents publication/receipt и отклоняет устаревшие revision/version.

Токены: внутренний UnsubscribeTokenIssuer, нет публичного issuer/admin UI/SMTP. 32 random bytes, передаются как canonical base64url; в DB только domain-separated SHA-256, FK на subscription и createdAt. Не JWT, нет raw token/TTL/consumed. Несколько hash rows на subscription: все прежние ссылки действуют после regrant и отзывают актуальный grant; повтор уже off не создаёт второго REVOKED event. Токен не даёт доступ к profile/grant/session. Новых env/dependencies нет.

Подготовлена миграция 20261021110000_email_advertising_unsubscribe. Применялась только в изолированной локальной тестовой PostgreSQL schema. Рабочая БД/production/SSH/SMTP/внешний Telegram не использовались, коммита нет. Этапы 10/11 не реализовывались: исходящие List-Unsubscribe/DKIM headers и рекламная доставка не подключены. Поддержка HTTP endpoint формата RFC 8058 не объявляется готовой email-кампанией. Проверен первичный RFC: https://www.rfc-editor.org/rfc/rfc8058.html.

Проверки:
- 134/134 PostgreSQL/HTTP (122 прежних + 12 новых) — PASS.
- Реальный Nest module wiring PrismaModule + ContactsModule + PartnerApplicationsModule + ConsentsModule без DB init/listen — PASS 1/1.
- api check-types:test — PASS, включая финальный прогон.
- Scoped ESLint изменённых backend TS и новых unit-файлов — PASS.
- git diff --check — PASS.
- API official types/build/lint подтверждены root как PASS; общий targeted regression root запускает отдельно, полный API suite здесь не объявляется green.

Новые native случаи: account-only state/forged inputs; off/no-sub fence без registry/profile/keys; active revoke при retired registry/missing keys/profile; read-only GET/HEAD и invalid GET; normal human CSRF/invalid token/unknown fields; RFC urlencoded+multipart без cookie/auth; bounded body/unknown fields/file rejection/exact CSRF scope; 5 concurrent repeats = один revoke event/version и 5 fences; старый token после нового согласия; first grant без subscription и повтор off перед queued regrant; отзыв после grant receipt с отклонением final Auth JWT. Только внешний Telegram boundary mock; контроллеры/guard/Prisma/DB/Auth/Consents pipeline настоящие.

Собственный PostgreSQL 62311 остановлен чисто после checkpoint; lsof listener отсутствует. Логи рядом: native.log, module.log, test-types-final.log, lint.log, cleanup.log. Privacy RequestEvidenceCapture URLheaders редактирует root; дополнительные frontend/Caddy проверки входят в общий отчёт root.

Дополнительно 9/9 backend unit/protocol/SQL migration tests — PASS: unsubscribe-token.spec.ts (3 crypto/canonical capability), consent-request-evidence.spec.ts (5 optional direct capture/mandatory Auth secret/HMAC binding/tamper/privacy), unsubscribe-token.migration.spec.ts (1 PGlite multiple hash rows, unique/hash/FK constraints, no raw/expiry/consumed columns, retention across state changes). Финальные check-types:test и scoped ESLint после добавления файлов — PASS. Логи unit.log, lint-units.log. Native JSON DB dump и requestContext явно проверяются на отсутствие raw token в case126/127/128, а SQL unit отдельно проверяет отсутствие plaintext capability.
