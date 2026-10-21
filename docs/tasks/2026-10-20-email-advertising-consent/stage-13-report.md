# Этап 13 — общая приёмка авторизации и согласий

Дата: 21.10.2026. Ветка `codex/email-advertising-consent`, worktree `/Users/denis.voropayev/.codex/worktrees/email-advertising-consent/artmate-monorepo`, HEAD `c3e21a2f`. Коммит/push/deploy/SSH не выполнялись; рабочая БД и основной checkout не менялись. Прежние изменения/index сохранены.

## Результат

Выполнена свежая общая локальная приёмка этапов 1–9/12. Исторические PASS не перенесены в текущие числа. Проверены password/signup/guest activation/recovery, недостающие контакты и согласия, общий withAuth/useAuth/host, Яндекс continuation, contact/partner/promo/loyalty callers, settings/public unsubscribe, сохранение доказательств и backup/restore. Архив/экспорт/рассылка этапов 10/11 остаются отложенными.

Карта покрытия — [stage-13-acceptance.md](./stage-13-acceptance.md). Проверки проводились на синтетических данных без реального SMTP, Яндекса, платежей, Telegram и production.

## Найдено и исправлено

1. **Секреты в MutationCache при ожидающем запросе.** Браузерный probe с удержанным HTTP ответом подтвердил password/code/reset/OAuth values в mutation variables; после завершения они очищались. Все семь sensitive auth hooks теперь удерживают payload только в локальном request ref и вызывают TanStack mutation без variables; finally освобождает ref/observer, повторный одновременный вызов не перезаписывает payload. Внешние `mutateAsync(input)`, DTO и callbacks сохранены. Регрессионные проверки используют настоящий QueryClient/MutationObserver, проверяют pending и settled success/error, а не только исходный текст.
2. **Токены во внутренней истории Next.** Reset оставлял token в history.state после успеха; удержанные callback и activation exchange показывали ту же проблему до cookie/RSC обновления. Теперь официальный `router.replace` очищает route tree вместе с адресом. Reset сохраняет mounted capability и подтверждённый success при clean RSC props. Автоматические callback/activation действия ждут окончания navigation transition; исходные provider input/activation entry остаются transient mounted data, не становятся новой identity или обычной сессией. Повторный exchange/лишний код не добавлены.
3. **Недостаточные области нажатия.** «Изменить почту» на CodeStep имело 32px; fallback/cancel/error/success кнопки route/reset/callback тоже 32px (18 измеренных CTA instances на 320/390). Локально добавлен min44px, shared Button глобально не менялся. Круглая Close44px и 20px checkbox не признаны дефектами автоматически: реальный центр Close работает, а label checkbox даёт проверенную 44×44 область клика. Скрытые Radix inputs не считаются видимыми controls.
4. **Контраст основного CTA.** Axe не смог вычислить контраст градиента. Независимый pixel probe подтвердил белый текст на фоне(255,100,126), около 2.85:1, с диапазоном 2.55–3.37 по кнопке. `primaryButtonClassName` внутри Auth теперь задаёт тёмный текст; градиент и shared/global дизайн сохранены. Финальный минимум на rendered pixels — **6,71:1** при пороге 4,5:1.
5. **Четыре падения устаревших backend test adapters.** Первый полный batch:1660 tests, 1656 PASS / 4 FAIL. Welcome mock не отдавал published product price; SQL throttle adapter ссылался на прежнее имя private method и не поддерживал новый настоящий advisory-lock statement. Исправлены только `welcome-promocodes.spec.ts` (+price fixture в копейках) и `throttle-sql.spec.ts` (актуальный `_incrementRecoveryThrottle`, исполнение tagged SQL в PGlite). Адресные 16/16 и повторный полный набор прошли. Backend runtime этим не менялся; историческое baseline issue из этапа 2 закрыто.

Исходные finding artifacts сохранены отдельно от clearing; harness ошибки (неоднозначный OTP selector, disabled input после resend, coordinates после сдвига modal, radius corner hit-test) не названы дефектами продукта.

Для навигации использованы публичные [Next useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router) и [React useTransition](https://react.dev/reference/react/useTransition), без изменения private history internals. Ожидание transition относится к технической очистке URL, не к дополнительному продуктовому шагу авторизации.

## Свежие проверки

| Проверка | Результат |
| --- | --- |
| Полный API общий batch | **1660/1660 PASS**,224 suites,0failed/skipped |
| Native auth PostgreSQL/HTTP | **134/134 PASS** |
| Native PostgreSQL полный backup/restore | **1/1 PASS** |
| Итого реально выполненных API tests | **1795 PASS**,0FAIL |
| Полный сайт после последних исправлений | **577/577 PASS**,0failed/skipped |
| Полный affiliate suite | **123/123 PASS**,0failed/skipped |
| Infrastructure suite | **32/32 PASS**,0failed/skipped |
| Браузер на финальной сборке | **92/92 уникальных checks PASS**, финальная production сборка |
| API Prisma validate/types/test-types/lint/build | PASS |
| Site types/lint/build; affiliate types/lint/build | PASS |
| Admin types/lint | PASS |
| Dummy env validator / Compose config / shell syntax | PASS |
| Caddy полный validate и реальные loopback HTTP200/502 header/redaction probes | PASS |
| Standalone-пакет по Docker layout | **9/9 HTTP checks PASS**: страницы, privacy headers, PDF bytes и assets |
| Diff/architecture audit | PASS в проверенном объёме |

У PostgreSQL runner есть **1 skipped test** (affiliate payouts) и **10 skipped suites** (delivery tracking +9 loyalty) без их отдельных opt-in test env. Это не 1795 дополнительных прохождений и не проверка этих рабочих БД; точный список в backend summary. Auth и backup были реально запущены на отдельном PostgreSQL62351, не skipped. Его test schemas/backup DB удалены, cluster остановлен, listener отсутствует. Native версия 15.12; production Compose17 не запускался.

API types/test-types/lint/build выполнены после правок test adapters. UI types/lint/build и весь site suite повторены после последнего исправления activation/контраста; финальная сборка использована браузером. Affiliate проверяет действующий role-bound endpoint consumer, admin сохранённый контракт проверен типами/линтером и API cases. Admin build и полная браузерная приёмка всех его страниц не выполнялись: admin UI/routes не менялись.

## Браузер и документы

На финальной сборке прошли 92 уникальные проверки: pending7, sensitive3, routes13, callers13, withdraw13, supplemental7, route-targets14, focus1, axe7, legal14.32 проверки повторены с дополненной console/network telemetry на той же сборке и не прибавлены к 92. Console/page errors0, unexpected request failures0.643 ожидаемых ERR_ABORTED относятся к navigation/prefetch/context close,4 предупреждения браузера — к попытке закрыть напрямую открытый callback tab.

На 320/390/1280 проверены светлая тема, ввод/ошибки/Eye, keyboard/focus, ширина и реальные области нажатия, full caller/consent/unsubscribe states. Семь PDF в общем viewer проверены на 320/1280:14 document/viewport cases,102 отрисованные страницы, canvas/text layer/download и совпадение bytes с public source. Сохранены viewer screenshots и contact sheets всех страниц. Axe в 7 состояниях не нашёл автоматических violations;5 состояний имеют incomplete (градиенты/transparent OTP), поэтому это не всеобщая контрастная или accessibility сертификация. Контраст основного CTA отдельно измерен и исправлен. Root визуально просмотрел итоговые mobile login и activation screenshots.

Standalone копия повторяет layout Dockerfile и запускает `node apps/site/server.js`:9 HTTP checks прошли, включая auth/activation/reset/unsubscribe/callback/legal, PDF и обе 3D-иконки; sensitive responses имеют no-store/no-referrer. Это smoke отдельного Node bundle, Docker image/engine этим не запускались. Backend URL намеренно указывал на недоступный loopback; реальные HTTP действия проверены браузерными и native suites отдельно. Собственный standalone процесс 62358 остановлен.

Источник UI — настоящий Next production build, routes, React и server actions. Внешний локальный HTTP fixture моделирует backend/provider ответы для управляемых веток и ошибок; настоящий backend/Nest/Prisma/PostgreSQL проверен отдельно. Это не совместный real-SSO/SMTP/production E2E. В приложении не появились test panels, demo routes, fake-auth adapters или QA endpoints. Внешние запросы browser перехватывались до отправки.

Cross-tab refetch использует настоящий второй tab и контролируемое window visibility событие headless browser. Late-owner case публикует синтетическую fresh session в actual QueryClient перед release старого held action (Next сериализует server actions); это проверка изоляции результата, не real SSO смены аккаунта. Эти ограничения сохранены в artifacts. Performance/полевые Core Web Vitals и полный accessibility аудит всего сайта не заявляются.

## Архитектура

Повторная source сверка и исполняемые тесты подтвердили route binding в `app`, composition в `_pages`, сценарии/HOC/coordinator/UI-state в feature lib, отдельные mutations в model и transport-only shared actions. RHF+zod, DTO mappers и public APIs сохранены. Изменения очистки маршрута находятся в Auth lib; model refs обслуживают только lifetime HTTP payload, не координируют UI. Локальные min-height/foreground corrections не меняют handlers или global primitives.

На backend Auth владеет identity/credentials/session/operation; Consents — решениями, permission/history и revoke; Users — profile/User, Orders — заказами. Completion использует persisted commands/receipts и финальный version check. SiteActionGuard читает actual publication/acceptance, не клиентские booleans; optional advertising не становится обязательным gate. Owner/cancel/unmount/late-result guards и session cache publication до callback сохранены. Role-bound admin/affiliate входы имеют реальных consumers и role checks; заменённых customer bypass routes нет.

Отписка остаётся доступной без нового grant secret/registry/profile: GET/HEAD read-only, human POST с обычным CSRF, RFC receiver с узким исключением, old random hash-only capability без grant/profile/session access. Recipient lock и publication revision fences сохраняются. Source review не подменяет runtime evidence: исходные browser defects найдены после первого source audit и исправления отдельно перепроверены.

Подробный source/delta audit — verification/stage-13/architecture-audit.md. Caddy no-store/no-referrer/token redaction/strict COOP сохранены; stage12 backup/env chain не изменялись.

## Что остаётся перед выпуском 14

- J1/J2/J3: согласованные цели/редакции/оператор, механизм принятия ПДн и сроки/доступы к данным. Renderer показывает читаемый PDF, но не подтверждает юридическое согласование. Новые legal revisions/registry автоматически не публиковались.
- Production GitHub secrets и key-version mapping: локальная проверка примеров/доставки не подтверждает реальные значения. Настройки GitHub/production `.env` не читались и не менялись.
- Закрытые внешние копии, доступ/шифрование/вместимость/операционное хранение и restore-порядок на сервере. Same-VPS pre-migration snapshot не заменяет offsite; восстановление старого snapshot требует сверки последующих отзывов/заказов/платежей.
- Отдельное поручение на выпуск и его конкретные production-действия; SSH требует разрешения по AGENTS. Готовность локальной приёмки не запускает commit/deploy/migration/backup/restore автоматически.

Этапы 10/11 по-прежнему отложены, рекламного sender нет. Логи/screenshots/до-после/driver/cleanup — [verification/stage-13](./verification/stage-13/README.md). Следующий этап 14 — только по отдельному поручению.
