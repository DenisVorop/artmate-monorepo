# Этап 3a — парольный вход и регистрационное подтверждение почты

> Исторический отчёт этапа. Последующее упрощение отменяет описанную здесь nullable-proof ветку: подтверждённая почта используется без повторного кода. Текущее решение — [verified-email-reuse-report.md](./verified-email-reuse-report.md), design/progress.

Работа выполнена в ветке `codex/email-advertising-consent`. Реализован серверный участок от проверки пароля или регистрационного кода до ограниченного продолжения регистрации. Существующая авторизация переиспользована. Ветка не закоммичена; рабочая и production-БД не мигрировались.

## Поведение

- Email + действующий пароль проверяются существующим scrypt-форматом без запроса кода. Ошибки неизвестного email, неверного пароля и недоступного аккаунта нейтральны. Версия credentials/status/authVersion перепроверяется; старый pending после смены пароля не принимается.
- Код используется только для подтверждения почты в регистрации. Новый адрес переходит к ФИО, телефону, паролю и повтору. Гостевой адрес сохраняет прежний userId и известные контакты. Адрес с уже существующим credential/provider направляется к обычному входу или восстановлению: код не заменяет пароль и не становится самостоятельным способом входа.
- Сохранение регистрационной формы записывает только временный hash нового пароля и контактный draft с TTL. Активный credential, User, рекламная подписка и обычная сессия при этом не создаются. После отмены или истечения срока draft очищается; immutable proof остаётся.
- Pending capability находится в отдельных HttpOnly/SameSite cookies с привязкой к браузеру. Она не JWT, не передаётся в UI-ответах и не принимается обычным AuthGuard. Новые handlers не выставляют access-token cookie.
- Новый UI пока не переключён на эти handlers: общие Users/Consents/completion gates ещё предстоит реализовать. Ответ `preparing` намеренно оставляет процесс незавершённым до готового downstream, а не изображает успешный вход.

## Решение о старых аккаунтах

Пользователь подтвердил: **«Да, вход без кода; рекламу пока не включать»**. Дата `email_verified_at`, автоматически заполненная старой миграцией, не публикуется как доказательство владения почтой. Парольный authentication/flow/completion может не иметь email proof; строгие ограничения advertising grant сохраняются. Подтверждённая новая регистрационная проверка может использоваться как настоящий exact-email proof.

Отдельный случай — незавершённая старая регистрация: в ней credential создавался до проверки email. При `email_verified_at IS NULL` такой пароль не становится действующим автоматически. Новый код не активирует и не переписывает старый пароль. Безопасное восстановление с новым паролем — задача 3b. Это не повторная OTP-проверка после нормального парольного входа.

## Архитектура и переиспользование

Auth переиспользует формат scrypt, парольную политику, CredentialsAuthService, throttle и существующие аккаунты. PasswordHasher выделен из прежнего кода без смены формата хешей. Для конкурентных неудачных входов throttle сериализуется на subject. Env credentials проверяются по текущей конфигурации без мутации User и без выдуманного credential timestamp.

Auth владеет challenge, immutable verification/authentication facts, временным flow и draft. Users публикует live read-only `customer_auth_directory_v1`; Auth не пишет профиль и не меняет заказы. `registrationCompleted` в этой публикации — признак старой завершённой регистрации, а не доказательство email. OFFSET 0 запрещает автоматические изменения через view.

Письма идут через persisted Notifications command и существующую очередь/Mailer. Notifications читает Auth-owned read-only delivery projection; не вызывает Auth business service. HTML/text прежнего письма выделен в общий renderer. В БД и job payload хранятся nonce/generation/digest, код выводится в памяти при доставке. Просроченные, использованные и заменённые поколения пропускаются. Завершение SMTP и рекламная отправка этим этапом не реализованы.

На сайте `shared/actions` отвечает только за транспорт. Отдельные mutation hooks находятся в `features/auth/model`, перевод ошибок для человека — в `features/auth/lib`. UI 1b, app/_pages и текущий AuthForm не изменялись. Cache/session/owner callbacks будут подключены своим этапом. Новых demo routes, тестовых панелей и runtime mock adapters нет.

## API и контекст запроса

Добавлены:

- `POST /auth/flow/password`;
- `POST /auth/email-code/request`, `/confirm`, `/resend`;
- `POST /auth/flow/registration`;
- `GET /auth/flow`;
- `POST /auth/flow/cancel`.

Контроллер содержит transport binding; проверки и транзакции вынесены в services/store/policy. Responses используют discriminated PENDING/LOGIN_REQUIRED contract и `Cache-Control: no-store`. Прежний `/auth/login` пока нужен существующему affiliate consumer; удаление заменённых site путей выполняется при переключении callers и backend guards.

RequestContext сохраняет полный доступный API HTTP/socket-контекст, повторные headers/query, server time и происхождение client IP. Next server actions отдельно подписывают доступные frontend headers/client metadata; исходные method/URL/version/socket через `headers()` недоступны и явно записываются null. Фиктивный контекст из target API route не создаётся. Cookies/Authorization/пароли/OTP/CSRF и другие секреты редактируются, сырой body не архивируется.

Подпись отдельным `AUTH_FLOW_PROXY_SECRET` привязана к method/path/body hash и ±60 секундам. Неподписанные forwarded headers не становятся доверенным адресом клиента. Новый secret проведён через examples, required env, deploy workflow, compose API/site и Turbo. Перед будущим выпуском требуется задать GitHub secret; реальное значение и production-конфигурация не менялись. `ARTMATE_AUTH_TEST_DATABASE_URL` зарегистрирован только как тестовый env в Turbo и не доставляется в production.

## Миграция

Добавлена `20261020180000_registration_pipeline`; исходные миграции 2/2b не переписаны. Изменения: read-only публикации, ENV_PASSWORD с snapshot binding, nullable email proof для допустимых authentication методов, прямые authentication FK и null-safe binding guards. Чужой proof нельзя приписать операции с null proof. Advertising constraints остаются строгими.

Native Prisma проверка выявила проблему вставки subscription с optional составной relation activeGrant и required parent id. Prisma relation заменена на scalar FK, прямой SQL FK добавлен; прежний recipient-scoped composite SQL FK сохранён. UTC TTL сравнивается с UTC независимо от timezone PostgreSQL.

Миграция не backfill-ит Users/credentials/orders/subscriptions и не создаёт фиктивных verification/consent facts.

## Проверки

- **28/28 native PostgreSQL + HTTP tests**: полная история миграций, настоящий PrismaPg, отдельные соединения/HTTP requests. Проверены password/legacy/env/provider/guest состояния; неправильные коды/лимиты/параллельные попытки; confirm/resend/cancel/draft гонки; retry после потери ответа; cross-browser scope; credential races; stale versions; read-only views; две очереди и один claim; отсутствие рекламного grant без proof.
- **134/134 адресных API tests**, 10 suites: protocol, 31 SQL migration test, auth-versioning, order activation, password reset, roles и order Telegram regression. После последнего уточнения upstream metadata дополнительно прошли **8/8 protocol tests**.
- **436/436 site tests**.
- API `check-types`, `check-types:test`, `lint`, `build`; site `check-types`, `lint`, `build`; Prisma validate — прошли.
- Env validation и `docker compose ... config --quiet` — прошли. `git diff --check` — прошёл. UI 1b и посторонние Prisma-схемы сверены по SHA-256 с состоянием до этапа: не изменены.

Логи и сводка: [verification/stage-3a/summary.json](./verification/stage-3a/summary.json). Native тесты использовали собственный временный PostgreSQL на 127.0.0.1:62311 и случайную схему; сервер остановлен, порт освобождён. Реального Mailer/SMTP в тестовом mini-module не было. Полный API suite этим адресным запуском не заменён; известное прежнее падение welcome-promocodes описано в отчёте 2.

## Следующий срез

**3b — гостевая активация и восстановление пароля**, включая безопасное завершение старого неподтверждённого signup. Затем Users profile и общий consent/completion. На этапах 4/5 нужно явно поддержать разрешённую authentication без mailbox proof для legacy входа; существующие обязательные profile/acceptance контракты не ослаблены автоматически. Advertising grant всегда требует настоящий proof.

Этот отчёт не объявляет готовыми выдачу сессии нового pipeline, рекламное согласие/рассылку, юридические редакции, Яндекс linking или retention. Следующий этап, commit/push/deploy и production migrations автоматически не запускались.
