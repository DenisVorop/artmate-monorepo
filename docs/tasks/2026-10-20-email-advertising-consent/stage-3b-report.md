# Этап 3b — гостевая активация и восстановление доступа

Выполнен серверный срез в ветке `codex/email-advertising-consent`: ссылка после гостевой покупки теперь может продолжать общий Auth flow без немедленной выдачи сессии. Действующие форматы ссылок, guest checkout и восстановление пароля переиспользованы. Коммита и выпуска нет.

## Поведение

- Действующая ссылка подтверждает почту и открывает шаг пароля с повтором. Повторный код не отправляется. Продолжение привязано к браузеру, прежнему userId и сроку ссылки.
- Пароль сохраняется как временный scrypt hash в общем draft-механизме регистрации/активации. Действующий credential и сессия появятся только при общем завершении на этапе 5.
- Известные контакты и заказы сохраняются. При наличии контактов после пароля можно идти к общим согласиям; при нехватке сервер возвращает контактный шаг. Обработчики профиля/согласий/completion ещё не подключены, поэтому готовность downstream пока представлена `preparing`.
- Повтор своего запроса после потери ответа возвращает тот же flow. Параллельные запросы не расходуют ссылку дважды. Другой браузер использованную ссылку не присваивает.
- При отмене временный hash удаляется, подтверждение почты остаётся. Через восстановление можно получить новую ссылку и продолжить ту же запись без дублирования пользователя и заказов.
- Восстановление сохраняет общий ответ: гостю отправляется активация, аккаунту с паролем — прежняя reset-ссылка. Смена пароля проверяет повтор, сохраняет прежнюю политику authVersion/отзыва сессий и заканчивается обычным входом. Сам reset не выдаёт сессию или рекламное согласие.

## Архитектура

`ActivationFlowService` выполняет только Auth-транзакцию: проверка прежнего token protocol, CAS consume, immutable `ORDER_ACTIVATION_LINK` proof и `ORDER_ACTIVATION` authentication, browser-bound pending flow. Users читается через опубликованный read-only directory. Новый coordinator не создаёт User, не переписывает профиль, не меняет Order или рекламную подписку.

`AuthFlowStore`, `FlowReadiness`, `RegistrationDraftService` и lifecycle переиспользуются. Для activation draft не нужны ФИО/телефон: известный профиль не дублируется в password форме. Устаревшая версия пользователя или конкурентно созданный credential/provider не дают продолжить старую активацию. Финальный CAS credential остаётся общим completion 5.

`RecoveryFlowService` использует действующие Auth services для выбора/отправки recovery и password reset; новые token/email/reset реализации не создавались. Прежний guest provisioning и повышение User.authVersion при reset сохранены как существующий механизм. Сам PasswordResetService и обе token utilities не менялись. В OrderActivationService исправлена только гонка создания recovery throttle: начальный upsert и increment сериализуются advisory lock на subject, политика лимитов прежняя.

Frontend `shared/actions` — только transport. Отдельные feature mutation hooks вызывают подготовку capability и обмен ссылки, сохранение activation draft, recovery/reset; ошибки для пользователя преобразуются в feature lib. До выдачи сессии нет session-cache updates или вызова внешнего действия. UI 1b, live AuthForm, app/_pages, схемы и env не менялись. Демонстрационные страницы/панели/adapters не добавлялись.

## API и повтор после потери ответа

Добавлены:

- `POST /auth/flow/prepare`;
- `POST /auth/flow/order-activation/exchange`;
- `POST /auth/flow/order-activation/password`;
- `POST /auth/flow/recovery/request`;
- `POST /auth/flow/password-reset/confirm`.

Prepare автоматически устанавливает HttpOnly capability до расходования ссылки. Это отдельный технический запрос, завершённый в браузере перед exchange, без нового экрана или действия пользователя. При потере ответа exchange у браузера уже есть ключ своего продолжения. Подготовка не проверяет/не расходует ссылку и не является входом; чужие capabilities, replay и TTL проверяет сервер. Ни один новый handler не выставляет обычный access-token cookie. POST защищены действующим CSRF middleware; ответы `no-store`.

Activation evidence использует общий очищенный requestContext с подписанными доступными frontend metadata и фактическим API HTTP/socket. Сырые token/password/cookies не архивируются. TTL flow не превышает оставшийся срок ссылки и общий Auth TTL; retry его не продлевает.

Старые live endpoints и UI пока обслуживают текущий сайт. Переключение route adapters/callers и удаление старого `order-activation/confirm → createCookieSession` остаётся этапами 7/8, после готового completion. Новый pipeline старый endpoint не вызывает. Наличие новых handlers не объявляет всю авторизацию сайта переключённой.

## Проверки

- **44/44 native PostgreSQL + HTTP tests**, в том числе 28 прежних и 16 новых. Полная история миграций в случайной изолированной схеме, настоящий PrismaPg и Nest controller/validation/CSRF. Два настоящих гостевых заказа проходят прежний attachGuestOrderInTransaction; новая активация сохраняет пользователя, заказы и профиль. Проверены lost response/retry, параллельные обмены, разные браузеры, подпись/purpose/expiry, mismatch, draft idempotency, отмена и новая recovery-ссылка, конкурентный credential, status/authVersion, neutral recovery и reset replay/race. Ранней сессии, credential, OTP или рекламной подписки нет.
- **127/127 адресных API tests**, 9 suites: auth protocol, обе consent/auth migrations, auth versions, прежние guest activation/recovery/password reset и order Telegram regression.
- **436/436 site tests**; site `check-types`, `lint`, `build` прошли.
- API `check-types`, `check-types:test`, `lint`, `build` прошли; `git diff --check` чистый.
- Native проверка выявила существующую P2002 recovery throttle race, которую mock-upsert не воспроизводил. После исправления параллельные запросы дают один общий успешный ответ и ограничения для остальных, без дублирующих писем.
- SHA-256 сравнение подтверждает: прежний UI 1b, Prisma-схемы, PasswordResetService и token utilities не изменены этим этапом. Новых зависимостей/миграций/env нет.

Логи и сводка: [verification/stage-3b/summary.json](./verification/stage-3b/summary.json). Тестовый PostgreSQL остановлен, порт 62311 освобождён. SMTP в test fixture подменён; реальные письма и рабочая/production-БД не использовались. Полный API suite этим адресным запуском не заменён; известный прежний welcome-promocodes mock issue остаётся описан в историческом отчёте 2.

Следующий срез — **4: Users-owned недостающие контакты**, затем общий consent/completion. Выдача сессии нового pipeline, полный UI cutover и финальная гонка credential insert относятся к зависимым этапам и здесь не объявлены готовыми. Автоматического перехода, коммита, push или deploy не было.
