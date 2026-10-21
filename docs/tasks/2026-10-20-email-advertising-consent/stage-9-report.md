# Этап 9 — настройки рекламной подписки и отписка

Выполнен 21.10.2026 в ветке `codex/email-advertising-consent`, worktree `/Users/denis.voropayev/.codex/worktrees/email-advertising-consent/artmate-monorepo`. HEAD `c3e21a2f` не изменён. Этап не закоммичен; прежние изменения и index сохранены. Основной checkout не менялся.

## Результат для пользователя

В настройках аккаунта появилась карточка «Письма Artmate»: почта текущего пользователя, реальный статус подписки, ссылка на документ и «Подписаться» либо «Отписаться». Статус берётся с сервера, обновляется после действий и при возвращении во вкладку.

«Подписаться» открывает существующий общий `withAuth/useAuth` с `source: "notification_settings"`. Для подтверждённой почты не добавляется код или отдельное подписное письмо. Согласие и его доказательства проходят прежний Auth → Consents pipeline. Продолжение без необязательной рекламной галочки успешно завершает авторизацию, но не включает подписку; карточка перечитывает фактический результат, не рисует успех заранее.

«Отписаться» сразу вызывает отдельный revoke без повторного входа, пароля, кода или выбора причины. Успех показывается только после ответа сервера. Отзыв не зависит от публикации новых legal revisions, полноты профиля и наличия ключей для нового grant. После отзыва новый явный `onAuth` снова показывает недостающие согласия.

Публичная `/unsubscribe` позволяет отписаться по ссылке без входа. Открытие страницы и scanner GET/HEAD ничего не меняют; человек нажимает «Отписаться». После подтверждённого ответа показывается «Вы отписались». Неверная ссылка и временная ошибка различаются; при временной ошибке доступен повтор. Исходящие рекламные письма пока не создаются, поэтому в реальную рассылку ссылки не вставлялись.

## Архитектура

- `Auth` сохраняет владение identity, credentials, flow и session. Прямого grant endpoint из настроек нет.
- `Consents` владеет permission, immutable grant/revoke history, revoke-only capabilities, общей блокировкой получателя и publication revision.
- `Users` сохраняет профиль; `Notifications` не меняет согласия. Рекламная queue/SMTP не подключена.
- Frontend `app/unsubscribe/page.tsx` — metadata и binding searchParams; `_pages` только собирают UI. `features/email-subscription-settings` и `features/email-unsubscribe` содержат сценарии; UI-state/owner guards в `lib`, отдельные mutation hooks в `model`, transport в `shared/actions/consents`.
- `entities/email-subscription` — read-only owner-keyed query/hook. Новые private query очищаются при session publication/logout; version/owner fencing и отмена чтений защищают от старого ответа и смены аккаунта. QueryClient не содержит unsubscribe capability даже во время mutation.
- Общий `RequestEvidenceProxyHeaders` и backend `TrustedProxyEvidence` выделены в инфраструктуру для Auth и Consents. Auth-owned wrapper по-прежнему требует свой secret; direct revoke остаётся доступен без него. Старые auth-only aliases удалены. `isSensitivePath` объединяет token-bearing страницы для proxy, Link и analytics gates.

Существующие shadcn components, site tokens и public APIs переиспользованы. Демопанели, preview routes, runtime mock adapters и зависимости не добавлены. Отдельной suppression table нет: авторитетное `EmailAdvertisingSubscription.state = REVOKED` уже означает запрет рекламы.

## HTTP-контракты

| Метод и путь | Поведение |
| --- | --- |
| `GET /consents/email-advertising` | AuthGuard; только server session email; `{email, subscribed, version}` |
| `POST /consents/email-advertising/revoke` | AuthGuard + обычный CSRF; пустой body; actor/email только из сервера; тот же status DTO |
| `GET/HEAD /consents/email-advertising/unsubscribe?token=...` | Проверка формы token, только 303 на фиксированный `SITE_URL/unsubscribe?token=...`; без DB write |
| `POST /consents/email-advertising/unsubscribe?token=...` | Receiver для RFC 8058; exact `List-Unsubscribe=One-Click`, urlencoded или bounded multipart без файлов; без cookies/session/redirect |
| `POST /consents/email-advertising/unsubscribe/confirm` | Human JSON `{token}`, обычный CSRF, без login; `{unsubscribed:true}` |

Лишние actor/email/subscribed/body/query fields отвергаются. Единственное исключение CSRF ограничено точным receiver POST/path/content type; остальные endpoints сохраняют защиту. Public API получает no-store/no-referrer/noindex до validation/errors.

Receiver проверен по [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058.html). Это поддержка принимающего HTTP-контракта. Отправительские `List-Unsubscribe`/`List-Unsubscribe-Post`, DKIM-покрытие этих headers и доставка относятся к отложенному этапу 11; готовность полной email-кампании здесь не заявляется.

## Данные и конкурентные действия

Миграция `20261021110000_email_advertising_unsubscribe` добавляет `email_advertising_unsubscribe_tokens`:

| Поле | Назначение |
| --- | --- |
| `id` | ID записи capability |
| `subscription_id` | FK на подписку, `ON DELETE RESTRICT` |
| `token_hash` | Unique domain-separated SHA-256, проверка формата 64 hex |
| `created_at` | Серверное время выпуска |

Внутренний `UnsubscribeTokenIssuer` создаёт 32 random bytes, возвращает canonical base64url token один раз и сохраняет только hash. Публичного issuer нет. Несколько ссылок могут относиться к одной подписке; срока действия и consumed marker нет. Старые ссылки работают после повторного согласия и отзывают актуальный grant. Token не даёт прочитать профиль, войти или подписать человека.

Под общим recipient advisory lock одна транзакция переводит ACTIVE → REVOKED, добавляет immutable event, увеличивает permission version и очищает activeGrantId. Каждый валидный явный revoke увеличивает `UserConsentState.revision`, включая уже выключенную или отсутствующую подписку: ранее подготовленный grant/completion больше не может её включить. Повторный отзыв не дублирует REVOKED event, subscription row или permission version. Внутренняя publication revision при этом меняется намеренно.

В истории остаются факт отзыва, серверное время, source (`notification_settings`, `email_unsubscribe`, `email_one_click`), requestId, очищенный requestContext и actor snapshot, когда он действительно известен. Публичному отзыву не приписывается подтверждённая личность. Новых `initial_checked`, `final_checked`, `continue` или описаний кликов нет.

Граница семантики: запоздалый повтор старого token POST после нового grant технически неотличим от нового клика по той же ссылке. Выбрано требование работающей отписки по старым письмам: такой POST снова отзывает разрешение. Повторы при уже выключенном состоянии не дублируют историю перехода.

## Privacy и UI-проверка

Capability захватывается в память mounted feature. URL очищается до первого action; поддерживаемый `router.replace` также очищает Next renderedSearch/private history tree. Token не используется в local/session storage, query keys или mutation variables; явный POST body остаётся необходимой передачей capability на сервер. Public server action не пересылает session cookies. Серверное HTML/RSC начальной страницы содержит capability для её передачи mounted feature и не кешируется.

У `/unsubscribe` отдельный документ без site shell и analytics; ссылки на чувствительные routes не используют prefetch. Caddy и middleware выставляют no-store/no-referrer; query token/code/state редактируются в логах, включая error path. URL-like request headers (`referer`, `next-url`, `x-original-url` и другие) очищаются от query secrets; cookie/authorization/signature и `x-invoke-query` не сохраняются в evidence. Доступный контекст сохраняется с происхождением данных; IP/UA не объявляются доказательством личности.

Браузер нашёл два дефекта, оба исправлены и перепроверены:

1. После одного `history.replaceState` адрес уже был чистым, но Next сохранял token в history.state. Добавлен `router.replace` с сохранением mounted capability при обновлении RSC props. Финальные проверки до, во время и после POST, Back/Forward подтвердили отсутствие token и повторных автоматических POST.
2. Legal link в settings имел высоту 20px. Область нажатия увеличена до 44px. Новые feature controls проверены на 320/390/1280 CSS px; overflow и target failures отсутствуют.

Тексты и финальные mobile/desktop screenshots просмотрены в контексте интерфейса. Успех не показывается при ошибке или продолжении без рекламного согласия.

## Проверки

| Проверка | Результат |
| --- | --- |
| Настоящие Nest HTTP/Prisma/PostgreSQL auth/consents сценарии | **134/134 PASS**, из них 12 новых stage9 |
| Целевые API regression/unit/protocol/migration checks | **141/141 PASS**, включая 9 новых unit/SQL/crypto checks и настоящий module wiring |
| Полный suite сайта | **573/573 PASS**, 0 failed/skipped; 18 новых settings и 9 unsubscribe checks |
| Реальный Next production build/routes/server actions в Chrome | **13/13 PASS**, errors0, unexpected request failures0, target failures0 |
| API types, test-types, lint, build | PASS |
| Site types, lint, build | PASS |
| Prisma validate | PASS |
| Полный Caddy config validate + локальные runtime HTTP200/502/privacy/log-redaction probes | PASS, строгая COOP сохранена |
| `git diff --check` | PASS |

Native проверки покрывают server actor binding/forged fields, прямой отзыв без registry/profile/keys, read-only GET/HEAD, обычный и узкий CSRF, invalid token, urlencoded/multipart/unknown fields/files, concurrent repeats, old token after regrant, no-subscription fences и отклонение final Auth JWT после отзыва. Capability plaintext отсутствует в проверенных DB/requestContext результатах.

Browser проверяет settings off/on на трёх ширинах, unsubscribe без входа и cookies, invalid/retry/duplicate click, возврат во вкладку после отзыва во второй вкладке, запоздалый revoke предыдущего owner и отсутствие false subscribed после unchecked Auth. Измерены actual QueryClient pending/settled cache, history state, storage, referrer и network headers. Источник — actual production Next и внешний локальный HTTP fixture; это не реальный SSO/SMTP/production E2E. Для focus/refetch использован синтетический visibility event после настоящего второго browser tab. Для late-owner guard fixture меняет synthetic HttpOnly session cookie и публикует fresh session B в actual QueryClient перед release задержанного revoke A: проверка изоляции результата, не доказательство real SSO смены аккаунта.

Полный API suite не объявляется зелёным: историческое baseline-падение welcome-promocodes mock задокументировано в stage-2-report. Отдельный backend module smoke проверил настоящий Nest DI graph с ConsentsModule. Рабочая БД и внешние сервисы для проверок не использовались.

Логи, drivers, screenshots, до/после privacy/targets и README с границами — [verification/stage-9](./verification/stage-9/README.md). Собственные PostgreSQL/Next/fakeAPI/Caddy процессы остановлены; cleanup probes сохранены.

## Граница этапа и продолжение

Рабочая БД/production/SSH, реальные Яндекс/SMTP/Telegram/payment и GitHub settings не использовались. Миграция применялась только в изолированной тестовой PostgreSQL schema. Новых env/dependencies нет. Реальные legal registry revisions не публиковались; прежние выпускные J1/J2/J3 и инфраструктурные проверки остаются на своих этапах.

Этапы **10 и 11 отложены пользователем**: архив/экспорт/расширенная retention и рекламная доставка не реализованы. Коммит/push/deploy не выполнялись. Следующий текущий этап — **12: production env и резервное копирование текущих данных**, только по отдельному поручению, затем 13 и 14.
