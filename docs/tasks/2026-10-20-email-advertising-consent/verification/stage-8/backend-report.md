Этап 8 — backend, 21.10.2026

HTTP доступ к POST `/contacts/messages` и POST `/partner-applications` защищён `SiteActionGuard` и фиксированной серверной меткой действия. Оба действия используют общий prerequisite `site_auth`; новых юридических purpose или публикаций registry нет. Guard сам проверяет access JWT, authVersion, активный аккаунт и точный email через актуальную Users directory, подтверждённый email и готовый профиль; Consents отдаёт текущую обязательную редакцию и точный сохранённый факт acceptance. Совпадение actor snapshot проверяется, когда snapshot существует. Согласие на рекламу не требуется. Отсутствующая/неоднозначная registry закрывает доступ; публикация документов и J1 остаются задачами допуска к выпуску.

`SiteActionAccessV1` — server-only результат guard: action, purpose, actor userId/email, requiredConsent acceptanceId/revisionId. DTO не принимают actor/purpose/action/старые boolean. Contact reply email и partner contact email могут отличаться от actor email; они не становятся получателями рекламы. Business-сервисы не меняют Auth/Users/Consents: они получают только опубликованный контракт доступа, отправляют/сохраняют собственные данные. До успешной защиты нет Telegram и partner DB side effects.

PartnerApplication сохраняет authenticatedUserId и настоящий consentAcceptanceId, связанный FK с неизменяемым required_consent_acceptances. Старое поле consent nullable и служит только историей: прежние true/false сохраняются с пустой provenance; новым записям поле не выставляется, они сохраняются с реальной парой actor/acceptance. Нет backfill, fake consent:true и новой рекламной подписки. Admin read DTO отражает nullable historical boolean и optional provenance.

Удалены `/auth/register`, `/auth/email-verification/confirm`, `/auth/email-verification/resend`, старый EmailVerificationService и его DTO, registerUser/getCredentialsUserById и заменённые тесты. Общий `/auth/login` удалён; оставлен роль-ограниченный `/auth/affiliate/login` (partner), `/auth/admin/login` не меняет существующий admin контракт. Новый customer flow и гостевой checkout не требуют старых endpoints. EmailVerificationMessage сохранён: это общий реально используемый Notifications-шаблон нового registration-code сценария. Пароли, гостевые заказы и предметные checkout согласия не переписывались.

Миграция: `20261021100000_business_form_consent_provenance`. Применена только к временной схеме изолированной локальной тестовой PostgreSQL, не к рабочей БД. Новых env/dependencies нет. Коммита, SSH, production, SMTP и внешней Telegram отправки не было.

Проверки:
- 122 native PostgreSQL/HTTP сценария (PASS).
- 94 адресных regression-теста (PASS), включая новую PGlite provenance migration.
- `api check-types:test` (PASS), scoped ESLint (PASS); api check-types/build выполнял root.
- Native границы: anonymous/pending/forged JWT; отсутствующая registry/acceptance; ads skipped + successful actions; forged actor/action/purpose/legacy boolean; incomplete profile/unverified email/stale session; retired revision; projection без реального факта; old HTTP route 404 и affiliate/customer/admin role проверки. Telegram boundary заглушён, controllers/guard/pipeline/database реальные.

Логи: /tmp/artmate-stage8-backend/native-final.log, regression.log, test-types-final.log, lint-final.log. Собственный PostgreSQL остановлен чисто после checkpoint; lsof:62311 не показывает listener (cleanup.log).

Последняя архитектурная сверка: отдельный smoke test реальных PrismaModule, ContactsModule и PartnerApplicationsModule обнаружил ошибку области Nest DI, незаметную в плоском HTTP harness: CustomerDirectoryReader не экспортировался для SiteActionGuard method enhancer в ContactsModule. AuthModule теперь явно экспортирует свою read-only зависимость. Test `business-form.module.spec.ts` запускает фактическое создание Nest приложения без init/listen, с dummy localhost:9 DATABASE_URL и fail-canary на Prisma lifecycle. До исправления воспроизведён DI failure; после — PASS 1/1. Логи module-before.log и module-final.log. Новых БД подключений и бизнес-веток не добавлено. После изменения module export требуется финальная API сборка root.
