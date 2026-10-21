# Проверенные факты

Проверка: 20 октября 2026 года. Репозиторий для плана — чистый worktree от `02a5045f36103fa3fe313d88e69ef1a439f4da71`. Пути Artmate ниже относительны его корню. Команд production и обращений к реальным почтовым ящикам не выполнялось.

## Авторизация Artmate

| Факт                                                                                                                                                                                       | Источник                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Регистрация создаёт credentials account с `emailVerifiedAt: null`; существующий email вызывает конфликт                                                                                    | `apps/api/src/auth/credentials-auth.service.ts:57`                                                                  |
| Контроллер скрывает конфликт регистрации за общим ответом; это не подтверждает принадлежность email                                                                                        | `apps/api/src/auth/auth.controller.ts:109`                                                                          |
| Подтверждение почты — отдельная форма с кодом, уже существующей кнопкой «Подтвердить» и явным submit; автоотправки на шестую цифру в просмотренном UI нет                                  | `apps/site/src/features/auth/ui/auth-form.tsx:559`                                                                  |
| Confirmation request сейчас содержит только `email` и шестизначный `code`                                                                                                                  | `apps/api/src/auth/dto/confirm-email-verification-request.dto.ts:3`                                                 |
| Успешный confirm ставит `consumedAt` и `emailVerifiedAt`; затем контроллер создаёт cookie с access token                                                                                   | `apps/api/src/auth/email-verification.service.ts:181`, `apps/api/src/auth/auth.controller.ts:146`                   |
| Проверка кода и его update разделены чтением вне транзакции; update по ID не проверяет повторно `consumedAt: null`. Для новой связанной операции нужна проверка конкурентных подтверждений | `apps/api/src/auth/email-verification.service.ts:141`, `:181`                                                       |
| OTP HMAC включает user ID и код; сама запись не содержит снимок email                                                                                                                      | `apps/api/src/auth/email-verification.service.ts:263`, `apps/api/prisma/schema/auth.prisma:120`                     |
| Resend потребляет активные старые коды и создаёт новый; есть TTL, лимиты попыток и отправок                                                                                                | `apps/api/src/auth/email-verification.service.ts:54`, `:196`, `apps/api/src/auth/auth.constants.ts:11`              |
| Парольный вход требует ACTIVE account и подтверждённый email                                                                                                                               | `apps/api/src/auth/credentials-auth.service.ts:100`                                                                 |
| Guard проверяет access token и устанавливает `request.user`; публичного session ID в `AuthUser` нет                                                                                        | `apps/api/src/auth/auth.guard.ts:23`, `apps/api/src/auth/auth.types.ts:5`                                           |
| Используется JWT с `authVersion`; наличие `AuthSession` в Prisma само по себе не означает использование этой таблицы данным guard                                                          | `apps/api/src/auth/auth.service.ts:35`, `:141`, `apps/api/prisma/schema/auth.prisma`                                |
| Yandex OAuth получает `default_email`, может привязать существующий user; новый OAuth user создаётся без `emailVerifiedAt`                                                                 | `apps/api/src/auth/yandex-oauth.service.ts:115`                                                                     |
| Активация гостевого заказа подтверждает адрес отдельным существующим email-токеном; менять её на рекламную подписку сейчас не требуется                                                    | `apps/api/src/auth/order-activation.service.ts:76`, `:218`                                                          |
| Админские/env credentials также могут получить `emailVerifiedAt`; не следует объявлять его всегда фактом локального OTP                                                                    | `apps/api/src/auth/credentials-auth.service.ts:415`, `:448`                                                         |
| Настройки показывают профиль и Telegram, подписок нет; email заказа может использоваться как display fallback                                                                              | `apps/site/src/features/account/ui/settings.tsx:43`                                                                 |
| Публичного self-service изменения email или удаления аккаунта в просмотренных controllers нет                                                                                              | `apps/api/src/users/users.controller.ts:27`, `apps/api/src/auth/auth.controller.ts`                                 |
| Checkout — отдельный сценарий с офертой и согласием на данные; рекламного флага в payload нет                                                                                              | `apps/site/src/features/checkout/ui/legal-field.tsx:14`, `apps/site/src/features/checkout/lib/checkout-form.ts:100` |

## Уведомления, инфраструктура и проверки

| Факт                                                                                                                                                           | Источник                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Отдельной модели email-подписки нет                                                                                                                            | `apps/api/prisma/schema/users.prisma:17`, `apps/api/prisma/schema/notifications.prisma:17`        |
| Notification queue хранит JSON, статусы и повторы; enqueue принимает transaction writer                                                                        | `apps/api/src/notifications/notification-queue.service.ts:94`                                     |
| У очереди есть освобождение зависших задач; фиксация захвата/завершения не использует отдельный lease token                                                    | `apps/api/src/notifications/notification-queue.service.ts:197`, `:229`, `:471`                    |
| `MailerService.sendMail()` возвращает `void`; `messageId` пишется только в непродакшеновый лог                                                                 | `apps/api/src/mailer/mailer.service.ts:44`, `:219`                                                |
| В режиме `MAIL_LOG_ONLY` отправка не происходит; успешный возврат метода нельзя всегда трактовать как SMTP receipt                                             | `apps/api/src/mailer/mailer.service.ts:44`                                                        |
| Есть предметный outbox с lease token, который можно изучить как образец без заимствования аналитических бизнес-правил                                          | `apps/api/src/analytics/analytics-outbox.service.ts:71`, `:173`                                   |
| Caddy перезаписывает forwarding headers; AuthController нормализует адрес и доверяет частным proxy IP                                                          | `infra/caddy/Caddyfile:43`, `apps/api/src/auth/auth.controller.ts:539`                            |
| Server actions уже пробрасывают IP headers; User-Agent посетителя нужно отличать от User-Agent server-to-server fetch                                          | `apps/site/src/shared/lib/api-security.ts:6`, `apps/site/src/shared/actions/auth/auth.actions.ts` |
| Общий CSRF middleware требует `x-artmate-csrf: 1` для POST, кроме конкретных webhooks; one-click отписка потребует отдельного узкого token-authorized маршрута | `apps/api/src/common/csrf.middleware.ts:24`                                                       |
| Пример разделения HTTP/domain modules уже есть                                                                                                                 | `apps/api/src/loyalty/loyalty-http.module.ts`, `apps/api/src/loyalty/loyalty.module.ts`           |
| API использует `node:test`; PostgreSQL specs запускаются отдельно по распознаваемому суффиксу                                                                  | `apps/api/scripts/test.mjs:7`                                                                     |
| `docs` целиком игнорируется Git; подготовленные документы нужно явно добавить с `git add -N -f`, не меняя глобальное правило                                   | `.gitignore:44`                                                                                   |

## Документы сайта

Реестр `apps/site/src/_pages/legal/source-documents.ts:53` уже содержит `/legal/advertising-consent` и PDF от 22.09.2026. `PersonalDataConsentCheckbox` ссылается отдельно на политику и согласие на данные: `apps/site/src/shared/ui/personal-data-consent-checkbox.tsx:16`.

PDF проверены в предыдущем исследовании этой же задачи, текст извлечён из всех страниц двух соответствующих документов:

- `apps/site/public/documents/legal/advertising-consent-2026-09-22.pdf`: перечислены email, SMS, звонки, приложения, push, мессенджеры; предусмотрены отдельное действие, добровольность, настройки в кабинете, ссылка отписки и support email. Наличие документа не является фактом принятия.
- `apps/site/public/documents/legal/personal-data-consent-2026-09-22.pdf`: одновременно перечислены исполнение заказа и маркетинговые цели; есть срок 20 лет и условие об обязательной теме письма/попадании отзыва в спам. Перенос этих условий в новый сценарий не предрешён.

Это выводы о локальных файлах. Актуальность того, что развёрнуто в production, не проверялась.

## Локальный референс Sravni

Корень: `/Users/denis.voropayev/Desktop/projects/msb-bg-v2-frontend`.

- `src/shared/lib/auth/ui/consents-modal/index.tsx:39`: экран «Ваш личный кабинет почти готов», отдельный рекламный checkbox и «Продолжить».
- `node_modules/@sravni/react-silent-authentication-form/dist/esm/helpers/utils.js:19`: реклама по умолчанию `false`; обработка персональных данных — `true`. На момент первоначального исследования это было наблюдением о Sravni. Позже пользователь отдельно выбрал такой default для Artmate; актуальное решение зафиксировано в task/decisions.
- `.../dist/esm/components/Form/validationSchema.js:70`: personal data требует `true`, advertising допускает `false`.
- `.../dist/esm/hooks/useCheckConsents.js:37`: код и телефон передаются для проверки, результат содержит reference token.
- `.../dist/esm/components/Form/view.js:53`: `loginV2` получает reference token и `agreements.advertising`.
- `.../dist/esm/components/AgreementAdvertisingCheckbox/view.js:14`: фактическая подпись библиотеки — «Даю согласие на получение рекламных сообщений», с документом по ссылке. Переданный компоненту `children` не используется для отображения.

Из frontend нельзя установить состав и достаточность серверного архива доказательств Sravni. Реализация другой компании не заменяет юридическую оценку Artmate.

## Проверка подключаемого модуля по новому запросу пользователя

- В Artmate публичный `features/auth/index.ts` экспортирует AuthForm, но не `withAuth`/`useAuth`. Текущий callback `onAuthenticated?: () => void` не передаёт fresh user: `apps/site/src/features/auth/ui/auth-form.tsx:73`, `:217`, `:613`.
- Два найденных места установки AuthForm: standalone `apps/site/src/_pages/auth/index.tsx:1` и собственный checkout dialog `apps/site/src/features/checkout/ui/checkout.tsx:91`. Embedded режим скрывает OAuth.
- Login/verification mutation уже обновляют session query перед callback, но AuthForm отбрасывает user при вызове внешнего callback: `apps/site/src/features/auth/model/use-login.ts:17`, `use-confirm-email-verification.ts:18`.
- Session provider расположен ниже Query/Hydration/Device в `apps/site/src/_app/providers/app-providers.tsx:21`; UserProvider читает query и даёт user/isPending, не общий auth coordinator: `apps/site/src/entities/session/lib/user-provider/user-provider.tsx:10`.
- OAuth сейчас уходит полным redirect и возвращается на фиксированный success URL: `apps/site/src/features/auth/ui/auth-form.tsx:719`, `apps/api/src/auth/auth.controller.ts:259`, `:517`. Механизма продолжения произвольного callback компонента в этом пути нет.
- Contact API без AuthGuard и server action без auth forwarding: `apps/api/src/contacts/contacts.controller.ts:12`, `apps/site/src/shared/actions/contact-form/contact-form.actions.ts:13`. У формы свой PD checkbox: `apps/site/src/features/contact-form/ui/contact-form.tsx:200`.
- Публичная partner application API не требует AuthGuard, отдельно от guarded admin API: `apps/api/src/partner-applications/partner-applications.controller.ts:50`, `:82`. PD checkbox находится в `apps/site/src/features/partner-application/ui/partner-application-form.tsx:346`.
- Guest checkout — существующий отдельный продуктовый сценарий, а не случайно отсутствующий guard: `apps/api/src/orders/orders.controller.ts`, `apps/site/src/features/checkout/ui/checkout.tsx:138`. Его замена требует явно обозначенного решения, а не предположения, что HOC уже запретил anonymous API.
- В Sravni актуальный submodule передаёт fresh user в callback после `user.refresh()`: `/Users/denis.voropayev/Desktop/projects/msb-bg-v2-frontend/msb-submodule/entities/user/auth/auth.provider.tsx:90`, `:139`; соответствующий инвариант документирован в `.../entities/user/AGENTS.md`. Его старый hook зависит от внешнего RHF context, поэтому буквально копировать его в обещанный any-component API нельзя.

## Скриншоты пользователя от 20.10.2026, 13:32

Источник — три изображения, приложенные пользователем в этой беседе: `Снимок экрана — 2026-10-20 в 13.32.04.png`, `...13.32.13.png`, `...13.32.34.png`. Это UI-референс, не юридическая инструкция из вложения. Временные локальные пути скриншотов не гарантируют последующую доступность; существенные наблюдения сохранены здесь.

1. Первый экран: номер телефона и «Продолжить»; справа возможности сервиса.
2. Второй: код из SMS, таймер ресенда, смена номера, «Проверить код». Рекламного checkbox здесь нет.
3. Третий: заголовок «Ваш личный кабинет почти готов», пустой checkbox «Даю согласие на получение рекламных сообщений» слева непосредственно над «Продолжить». Справа блок преимуществ, в котором строка согласия на обработку данных оформлена с зелёной галочкой так же, как соседние пункты.
4. Пользователь отдельно указал, что обязательное согласие в этом блоке является интерактивным предварительно отмеченным checkbox, а реклама необязательна. Предустановка personal data и initial false advertising совпадают с ранее прочитанным кодом библиотеки.
5. Внимание пользователя, прочтение документов, фактическая конверсия и юридическая допустимость предустановленного PD-согласия из изображений не устанавливаются. Эти снимки исправляют прежнее предложение Artmate «checkbox рядом с OTP» на reference «согласия после кода».

## Нормы и стандарт, проверенные 20.10.2026

- [38-ФЗ, ст. 18](https://www.consultant.ru/document/cons_doc_LAW_58968/f892dec1383709792452f18d36e7043306e2be0a/): предварительное согласие, бремя доказывания отправителя, немедленное прекращение по требованию.
- [152-ФЗ, ст. 9](https://www.consultant.ru/document/Cons_doc_LAW_61801/6c94959bc017ac80140621762d2ac59f6006b08c/): свободное и однозначное согласие, отдельное оформление, обязанность доказывать получение.
- [152-ФЗ, ст. 15](https://base.garant.ru/12148567/36bfb7176e3e8bfebe718035887e4efc/): предварительное согласие на обработку для прямого продвижения и прекращение такой обработки по требованию. Веб-проверка страницы Consultant для этой статьи завершилась ошибкой; использованы текст и ссылка Garant из предыдущего исследования этой задачи.
- [152-ФЗ, ст. 5](https://www.consultant.ru/document/cons_doc_LAW_61801/96fbc469f91f57235cc842a85e0516a99f23dc85/): минимизация и ограничение хранения целями обработки.
- [Руководство ФАС, приказ 410/24, раздел VII](https://sudact.ru/law/prikaz-fas-rossii-ot-20062024-n-41024/): идентификация адресата и его волеизъявления. Двойное email-подтверждение как обязательный конкретный механизм в просмотренных нормах не предписано.
- [RFC 8058, §§ 3–4](https://www.rfc-editor.org/info/rfc8058/): HTTPS POST для one-click unsubscribe; непрозрачный токен, отсутствие зависимости от cookies/HTTP auth, корректная DKIM-подпись заголовков. Автоматические GET-запросы встречаются у почтового ПО.

Юридические вопросы, которые требуют выбора или согласования, перечислены в `progress.md`; их нельзя превращать в якобы уже утверждённые условия.

## Инфраструктура архива: дополнительная проверка при пересборке плана

В исходном `docker-compose.prod.yml:134` уже есть отдельные mounts для `api-uploads`, private colorings и private workshops; declarations volumes находятся внизу файла. Поэтому отдельный закрытый volume для архива согласий предложен по существующему pattern. Нового archive volume в исходном compose нет; создание/backup/restore включены в план, production наличие не проверялось.

## Дополнения после макетов и контактного шага

- В исходном `apps/api/prisma/schema/users.prisma` у User есть nullable `name` (varchar 120) и `phone` (varchar 80). Это контактные поля, их наличие не доказывает SMS verification и не обосновывает требование ровно трёх слов в имени.
- `apps/affiliate/src/shared/actions/auth/auth.actions.ts` действительно использует `/auth/login`. Удаление парольного UI сайта не даёт оснований удалять этот endpoint без миграции реального consumer.
- Comfortaa/Nunito подключены в `apps/site/src/_app/layouts/root-layout.tsx`; визуальные tokens/градиент берутся из существующего сайта и CTA. Последний прототип фиксирует светлую тему по прямому запросу пользователя.
- Официальный компактный SVG «Я» извлечён из [образцов Яндекс ID](https://yandex.com/dev/id/doc/ru/codes/buttons-design): вариант 44 × 44, rx 12, исходный цвет. Иконка в прототипе встроена. Контактное поле default_email в исследованном OAuth-контракте не установлено как гарантия exact-email verification; Q2 сохраняется до проверки конкретного способа.
- Снимок семи интерактивных маршрутов, оригиналы и уменьшенные 3D-палитра/галочка, официальный SVG сохранены в `mockups/`; `manifest.json` содержит SHA-256 и размеры. Это переносимый образец планирования, не приложение и не архив реальных пользовательских согласий.
- Новые междоменные переходы спроектированы по актуальному AGENTS.md: persisted contracts/read models, commands/results, local ownership/outbox/inbox. Текущий исходный auth-код не считается доказательством, что эти новые механизмы уже существуют.

## Проверено при реализации UI-этапа 1

- На базе `02a5045f` consumer map подтверждена: site `AuthForm` используется страницей auth и checkout embed; affiliate `/auth/login` — самостоятельный действующий consumer. Эти production сценарии UI-срезом не заменены. Источники: `apps/site/src/_pages/auth/index.tsx`, `apps/site/src/features/checkout/ui/checkout.tsx`, `apps/affiliate/src/shared/actions/auth/auth.actions.ts`.
- В root layout со streaming вызов page-level `notFound()` для preview в production дал HTTP 200 с 404 fallback. Ранний gate в `apps/site/proxy.ts` исправил status до 404; site route сохраняет собственный environment gate. Источник: реальный HTTP smoke и `verification/stage-1/production-headers.txt`.
- Браузерные measurements по новому React UI: семь сценариев и 20 сочетаний mobile step/width без overflow; обязательные ПДн до кнопки. Источник: `verification/stage-1/browser-checks.json`, screenshots и `stage-1-report.md`. Это проверка UI/симуляции, не доказательство настоящего server auth.

- После последующего запроса пользователя временный preview harness и его route/proxy изменения удалены. Browser/HTTP результаты выше относятся к завершённой проверке до этой очистки; текущий состав кода и проверки после удаления указаны в stage-1-report.

## Проверка гостевой активации при возвращении паролей

- В текущем worktree OrderActivationService создаёт User для нового guest email с `emailVerifiedAt: null`, name/phone из заказа, затем связывает заказ и при необходимости создаёт credentials account без credential. User existence не равен завершённой регистрации. Источник: `apps/api/src/auth/order-activation.service.ts:76`, `:95`, `:317`.
- Новая гостевая привязка выполняется уже при создании заказа, не только после банковского подтверждения: `apps/api/src/orders/orders.storage.ts:405`. Внизу storage остаётся fallback для прежних guest orders (`:2283`). Сохранение заказа само по себе не подтверждает доступ к почте или оплату.
- Recovery блокирует перебор/частые запросы и внутри различает наличие credential: без пароля ставит activation письмо, с паролем передаёт в password reset; наружу общий `{ ok: true }`. Источник: `apps/api/src/auth/order-activation.service.ts:106`, `:152`.
- Activation link TTL в исходнике 24 часа. Validate/confirm проверяют hash/signature, consumedAt/expiry, ACTIVE user, отсутствие credential и несовместимого OAuth account. Confirm создаёт hash credential, устанавливает emailVerifiedAt, увеличивает authVersion и расходует токены. Источник: `apps/api/src/auth/order-activation.service.ts:33`, `:174`, `:218`, `:281`.
- Сейчас `POST order-activation/confirm` сразу вызывает createCookieSession после confirmActivation — это конкретный путь, который при миграции нужно перевести на общий pending/completion. Источник: `apps/api/src/auth/auth.controller.ts:198`, `:204`.
- Существующий activation UI уже имеет passwordConfirm/schema refine, а mutation сразу кладёт session в cache и направляет в account. Источник: `apps/site/src/features/order-activation/lib/form.ts:8`, `:10`, `apps/site/src/features/order-activation/model/use-confirm-activation.ts:40`. Заменять этот path единым adapter, не дублировать согласия в прежней feature.
- Подготовленный новый identity enum пока содержит только EMAIL_CODE/YANDEX_VERIFIED_EMAIL: `apps/api/prisma/schema/auth-flow.prisma:1`, `apps/api/src/auth/contracts/verified-identity.contract.ts`. Пароль/link proof/session continuation требуют адаптации 2b, а не переименования password success в OTP fact.

Это факты локальной базы ветки c3e21a2f с незакоммиченным schema-срезом. Production состояние/секреты не проверялись, SSH не использовался.

- **20.10.2026 · Разделение 2b без новых runtime producers.** Поиск по `src` до изменений: VerifiedIdentityFact/Completion contracts использовались только декларациями; старый enum не был подключён к живому password login. Новая миграция не требует compatibility alias или выдуманных фактов; при непустых V1 flows/operations намеренно останавливается. Проверено реальной историей миграций в PGlite.
- **20.10.2026 · Историческая дата не всегда OTP evidence.** `apps/api/prisma/migrations/20260507120000_add_email_verification_codes/migration.sql:6` заполняет `users.email_verified_at = created_at` для прежних аккаунтов. Поэтому одной даты недостаточно для публикации RECORDED_EMAIL_VERIFICATION. Проверить реальное происхождение в 3a; password login не превращать в обязательный повторный OTP. Никакого нового backfill в 2b нет.
- **20.10.2026 · Хеш и активация.** `credentials-auth.service.ts:createPasswordHash` использует `scrypt:<32 hex salt>:<128 hex hash>`; 2b сохраняет этот формат. AuthOrderActivationToken уже хранит userId/hash/TTL/consumedAt; 2b не меняет формат ссылки или прежние строки. Новый flow содержит только token ID/expiry, не bearer secret.


### Этап 3a — подтверждённые кодом и native HTTP/DB проверки

- Старые scrypt hashes/политика длины, парольный throttle, HTML-письмо и Mailer/Notifications очередь переиспользованы. Параллельная запись throttle теперь сериализуется advisory lock на subject. Регистрационный OTP выводится из nonce/generation HMAC, сырые codes/secrets не пишутся в challenge/outbox/logs.
- В старом signup credential создавался до проверки почты. Поэтому `email_verified_at IS NULL` — operational признак незавершённой регистрации: одним введённым паролем её нельзя превратить в готовый аккаунт. Код для email с существующим credential/provider/configured env направляет к обычному входу/recovery; credential не переписывается.
- Customer directory — live read-only Users publication, а не обновляемая Auth копия профиля. OFFSET 0 убирает auto-updatable свойства PostgreSQL view. Auth delivery projection аналогично read-only. Auth core не меняет User/Order/Consent permission.
- При native проверке Prisma обнаружен NULL id при optional составной relation activeGrant с required parent id. Scalar relation/direct FK исправляет ORM insert; прежний recipient-scoped SQL FK сохранён. Native тест доказывает, что flow/completion без proof допустим, чужой proof и рекламный grant без реального proof отклоняются.
- Timestamp без TZ хранится UTC; локальная PostgreSQL с Europe/Moscow выявила ошибку сравнения draft TTL с timestamptz. Новая миграция сравнивает UTC с UTC, старые неприменённые этапы 2/2b не переписывались.
- У Next server actions через headers() отсутствуют исходные method/URL/version/socket. Signed upstream metadata хранит эти поля null, реально доступные headers/client metadata — с provenance; внешний API context сохраняет actual HTTP/socket. Подпись привязана к конкретным target method/path/body и времени.
- 28 native PostgreSQL/HTTP tests включают конкурентные confirm/resend/cancel/draft, bounded attempts, worker claim, credential races и изоляцию браузеров. SMTP заменён test-only fake Mailer; мини-Nest не поднимает реальный NotificationQueueModule. Production/рабочая БД не использовались.


### Production-проверка и упрощение существующего подтверждения email

По явному разрешению пользователя выполнен только SELECT через SSH в PostgreSQL-транзакции READ ONLY, UTC, с statement/lock timeouts. В production 79 пользователей; созданных до применения `20260507120000_add_email_verification_codes` — 0, email_verified_at = created_at — 0, миграционных кандидатов — 0. Миграция применена 07.05.2026 20:55:27 UTC. Ни БД, ни приложения этим аудитом не менялись. Агрегированный лог и SQL без персональных данных — verification/verified-email-reuse.

Вывод: специальная ветка для миграционных аккаунтов не нужна. Пользователь прямо поручил её удалить и не требовать новый код при рекламном согласии для уже подтверждённого email. Текущий код Users publication сохраняет исходный emailVerifiedAt; Auth публикует его как RECORDED_EMAIL_VERIFICATION. Согласие по-прежнему отдельное действие, повторной проверки почты нет. Это заменяет прежнее предположение Q5; старые записи выше описывают ход исследования, не текущий сценарий.


### Этап 3b — ссылки покупки и восстановление

- Новые ActivationFlowService/AuthLinkFlowController используют прежний order-activation-token протокол и общий AuthFlowStore; формат/секреты ссылок и legacy PasswordResetService не менялись. Схема 2b уже содержит token snapshot, immutable proof/authentication и credential draft — новая миграция не потребовалась.
- Изолированная native PostgreSQL/HTTP приёмка создаёт два настоящих Order и вызывает прежний attachGuestOrderInTransaction, затем новый exchange/password draft. userId, оба заказа и профиль остаются прежними; credential/session/subscription не создаются.
- Фоновый prepare нужен до token consume: у браузера должна быть capability до возможной потери ответа exchange. Весь порядок остаётся внутри feature mutation, не server transport и не UI шаг. Retry своего browser-bound exchange идемпотентен; иной browser, истёкшая/использованная/поддельная ссылка, чужой purpose отклоняются.
- Native parallel recovery воспроизвёл P2002 при начальном Prisma upsert AuthRecoveryThrottle. Advisory transaction lock на recovery scope/hash перед upsert исправляет создание и дальнейший increment без изменения политики лимитов. Unit mock-upsert скрывал этот случай; старые регрессии сохранены.
- RecoveryFlowService вызывает действующие Auth recovery/reset services. Новый activation core не пишет User/Order; прежние guest provisioning и reset authVersion policy остаются существующим механизмом, не новой копией этих обязанностей.


### Этап 4 — Users profile publication и command consumer

- До этапа 4 CustomerProfileState/EnsureCustomerProfileCommand были только схемой/контрактами; producers/consumers отсутствовали. Auth readiness проверял лишь непустые name/phone и не возвращал prefill контактного шага. Текущий UI уже требовал полный телефон 10–15 цифр, тогда как прежний registration backend допускал 7; публичный Users value contract согласует authoritative validation с существующим UI.
- `20261020200000_customer_profile_pipeline` публикует реальные существующие User данные и поддерживает projection атомарно Users trigger-ом. Новая revision появляется только при изменении опубликованных полей. Ни User, ни verification, ни consent/grant backfill не меняются. Directory остаётся read-only.
- Новые ProfileDraftService/POST flow/profile не создают команд/постоянных контактов. Auth использует Users-owned value contract, сохраняет bounded draft/profileRevision; Profile/Registration UI получает missingFields и readonly для уже корректных значений. Контакты/акторы из тела не подменяют пользователя.
- Users consumer читает Auth operation/proof publication и свой immutable intent, пишет только User/свою projection/receipt. Применение и результат — одна transaction. Row lock/recipient lock защищают claim/создание; несколько worker-ов не создают дубликат. Metadata retry — только при инфраструктурном rollback, без ложного terminal success.
- Native тест с ошибкой записи receipt показывает полный rollback User/projection и последующий успех того же intent. Два разных concurrent new-profile intent на один email дают одного User, один COMPLETED и один ACCOUNT_CHANGED, без credential/session.
- Согласия и выдача команды — этап 5. Native fixtures создают доверенные внутренние intent напрямую; ни один HTTP контактный submit этапа 4 не отправляет такую команду до consent boundary.

### Этап 5 — Consents runtime и общее завершение

- Consents обрабатывает факты, permission и terminal receipt одной транзакцией; false-реклама не создаёт события, [] не подменяет недостающую готовность · `apps/api/src/consents/consent-decision-command.handler.ts`.
- Auth выдаёт Users command только после confirmed Consents receipt; credential появляется в одной Auth-транзакции с terminal operation. Восстановление требует pending/browser capabilities · `apps/api/src/auth/completion.service.ts`, `completion-account.store.ts`.
- Native тест выявил изменение порядка ключей JSONB; канонизация каждого decision исправляет hash повторов · `apps/api/src/auth/completion-payload.ts`, `apps/api/test/auth-flow.postgres.spec.ts`.
- Table SHARE lock registry запрещает phantom publication между проверкой и final commit; актуальные роли/изображение публикуются Users view · `apps/api/src/consents/contracts/consent-read-model.ts`, `apps/api/prisma/migrations/20261020220000_auth_completion_pipeline/migration.sql`.
- Site transport синхронизирует access cookie только для COMPLETED, подтверждено отдельными исполняемыми тестами · `apps/site/test/auth-completion-transport.test.mjs`.


### Этап 6 — подключаемая авторизация и действующая сессия

- До нового SESSION producer существующая сессия не имела входа в общий limited flow. `session-flow.service.ts` переиспользует прежнюю Auth validation и Users confirmation publication; повторный код/новые выдуманные даты подтверждения не нужны. Binding хранится в immutable authentication fact; миграция не изменяет User и не содержит JWT/пароля.
- `features/auth/lib/auth-flow-coordinator.ts` владеет только transient UI/continuation, `lib/auth-provider/*` связывает context/HOC/hooks, model — отдельные mutations. App root подключён HOC. Одного глобального User event недостаточно для owner-specific callback; используются owner/epoch и захваченные options/payload.
- Browser probe воспроизвёл потерю focus: захват после открытия Dialog давал BODY после закрытия. Перенос захвата в start port до network/open исправляет возврат исходной кнопке. Другая проверка выявила перенос scrollTop между шагами; `ui/auth-host.tsx` сбрасывает его только при смене шага/открытии. Before/after сохранены в verification/stage-6.
- Глобально mounted mutation observer удерживал raw password/OTP даже после завершения запроса. gcTime=0 само по себе недостаточно при active observer: secret hooks дополнительно reset в finally. 8 тестов с настоящими QueryClient/MutationObserver проверяют success/error, callback и освобождение variables/cache.
- Потеря complete response вместе с временно недоступным resume не должна возвращать editable согласия. Recovery-only snapshot и запрет мутации до resume фиксируют неизвестный исход без второй отправки; покрыто coordinator и browser tests.
- Browser стенд вынесен в /tmp, compiled из реального UI/provider/coordinator, mock только action responses. В приложении нет preview route/test panel/mock adapter. Полная route/backend интеграция остаётся этапами 7/8; native PostgreSQL HTTP tests отдельно покрывают настоящий backend.


### Этап 7 — Яндекс, route adapters и чувствительные URL

- В прежнем `auth.controller.ts` OAuth callback создавал JWT до profile/consents; `yandex-oauth.service.ts` писал User и автоматически связывал по default_email. Теперь adapter только нормализует серверный профиль, `yandex-flow.service.ts` публикует Auth provenance, `completion-account.store.ts` связывает AuthAccount после receipts. Старые OAuth handlers/upsert удалены.
- Официальная [user-information](https://yandex.ru/dev/id/doc/ru/user-information) описывает default_email как адрес связи, без email_verified. [Authorization code](https://yandex.ru/dev/id/doc/ru/codes/code-url) поддерживает S256 PKCE. Принятие exact provider email без OTP — явное решение пользователя 21.10.2026, а не новая гарантия API; recorded Users proof переиспользует исходную дату.
- Пользовательский переход на Яндекс при [COOP same-origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy) может оборвать opener. Изменение общей политики на allow-popups автоматическая проверка отклонила из-за широкого ослабления. Сохранили строгую политику и перешли на authoritative bound result polling; same-origin signals лишь wakeup. `features/auth/lib/yandex-popup.ts`, `use-yandex-callback.ts`; browser case отдельно отключает BroadcastChannel.
- Real Next browser воспроизвёл возврат raw token/code/state в URL после позднего history.replaceState: cookie server action запускает RSC refresh текущего URL. Первой ранней очистки оказалось недостаточно: Next 16.2.6 `node_modules/next/dist/client/components/app-router.js:270` пропускает ACTION_RESTORE при передаче внутреннего __NA/_N state. Исправление — transient capture/initialEntry и `replaceState(null,...)` до первого action; Next сам переносит свои внутренние поля и обновляет canonical URL. `features/auth/lib/use-route-auth.ts`, `use-yandex-callback.ts`; до/после artifacts — verification/stage-7.
- `getSafeAuthRedirectPath` раньше принимал `/\evil.test`, который URL нормализовал во внешний origin; dot/control/encoded paths также обходили auth loop guard. Теперь URL normalization/проверка origin и запрет опасных separators/decoded auth namespace. `features/auth/lib/redirect.ts`, behavioral tests `account-recovery.test.mjs`.
- На token surfaces root раньше всегда подключал GA+Метрику (включая initial config/Webvisor). Trusted proxy marker и root gate исключают scripts до рендера; pageview transport фильтрует sensitive paths. `proxy.ts`, `_app/layouts/root-layout.tsx`, `shared/lib/is-sensitive-auth-path.ts`, `shared/lib/analytics/*`.
- Caddy обычный header handler не сохранял no-referrer/no-store на generated 502. Scoped sensitive headers переиспользуются в error handler; runtime log filter редактирует query token/code/state, убирает Referer. Полная конфигурация проверена локальным официальным Caddy с checksum; отдельный loopback probe проверяет HTTP200/502 и URI redaction. COOP значения не ослаблялись. `infra/caddy/Caddyfile`.
- Инвентаризация non-test apps/packages не нашла consumers `/auth/order-activation/{validate,confirm}`, `/auth/recovery/request`, `/auth/password-reset/confirm` после site cutover. Удалены заменённые endpoints/DTO/старые service entry methods. HTTP-тесты проверяют 404 и новый recovery; живые checkout/affiliate password consumers сохранены до8. Подробности — verification/stage-7/backend-cleanup-report.md.


## Этап 8: фактические consumers и common consent · 21.10.2026

- До cutover единственным consumer старого site AuthForm был checkout (`apps/site/src/features/checkout/ui/checkout.tsx`). В cart ссылка promo login уводила со страницы; теперь оба caller используют общий host.
- Contact/partner прежние PDn поля использовали один `PersonalDataConsentCheckbox` с одним маршрутом документа; `source-documents.ts` описывает его применение к формам Artmate. Поэтому техническая карта содержит два fixed action и один prerequisite site_auth, без выдуманных отдельных purposes. Юридическая публикация registry этим не подтверждена.
- `/auth/login` имел реального affiliate consumer (`apps/affiliate/src/shared/actions/auth/auth.actions.ts`); `AffiliateService.getCurrentPartner` уже требовал partner role/active profile. Endpoint перенесён на `/auth/affiliate/login` с role check; `/auth/admin/login` сохранён.
- Таблица `auth_email_verification_codes` после удаления старого service не имеет runtime consumer. Её historical rows не удаляются произвольным DROP; это не compatibility route и не источник нового proof. Источник нового письма — Notifications RegistrationEmailAdapter и действующий EmailVerificationMessage.
- Новая partner provenance миграция сохраняет исторические true/false без actor/acceptance backfill; новые записи требуют пару authenticated_user_id/consent_acceptance_id и FK. Файл: `apps/api/prisma/migrations/20261021100000_business_form_consent_provenance/migration.sql`.

## Этап 9 · фактическая реализация и privacy · 21.10.2026

- `apps/api/src/consents/email-advertising.service.ts`: permission/history/revoke транзакция принадлежит Consents; `contracts/recipient-consent-lock.ts` переиспользуется существующим grant handler. No-op revoke меняет publication revision и fences pending grant без выдуманного permission event.
- `apps/api/prisma/migrations/20261021110000_email_advertising_unsubscribe/migration.sql`: единственная новая таблица `email_advertising_unsubscribe_tokens`, hash/createdAt/FK; без plaintext/expiry/consumed. Старая ссылка сохраняется при regrant и не выдаёт grant/session.
- `apps/api/src/consents/email-advertising.controller.ts`, `common/csrf.middleware.ts`: read/account revoke и разделённые human/RFC receiver boundaries. DTO отвергает лишние поля/actor/email, RFC body bounded без файлов. Native HTTP проверяет GET/HEAD read-only и точный CSRF scope.
- Receiver контракт сверён с [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058.html): фиксированный POST body, form content types, без cookies/redirect. Полная sender integration с headers/DKIM не входит в этап 9 и остаётся отложенной с 11.
- Браузер обнаружил, что простой history.replaceState(null, cleanUrl) очищал адресную строку, но Next сохранял token в renderedSearch/private tree; добавлен поддерживаемый router.replace(cleanUrl) с сохранением mounted capability. Найденная 20px legal link в settings увеличена до min44px. До/после, ограничения fixture и финальный clearing run — verification/stage-9 и stage-9-report.
- Shared инфраструктура `RequestEvidenceProxyHeaders`/`TrustedProxyEvidence` используется Auth и Consents без обязательного secret для отзыва. URL-like headers (включая next-url/x-original-url) очищаются от query token, x-invoke-query redacted. Auth wrapper сохраняет собственную обязательную secret policy; прежние auth-specific aliases удалены.
- Никаких product preview routes/panels/mock adapters, рассылки/архива/экспорта/production migration/SSH/новых env или dependencies этап 9 не добавляет.

## Этап12 · env delivery и резервирование · 21.10.2026

- Цепочка трёх task env уже существовала: `.github/workflows/deploy.yml` GitHub secrets/vars и append_secret; `docker-compose.prod.yml` API proxy/recipient/version и site proxy; оба env examples; `infra/required-prod-env.txt`; `turbo.json/globalEnv`; runtime readers. Разрывов доставки не обнаружено, секреты не читались. Новых env нет.
- Прежний `infra/validate-prod-env.sh` проверял только непустоту, оба новых example secrets совпадали. Runtime recipient требует length>=32/version<=32 (`apps/api/src/consents/consent-decision-command.handler.ts`). Validator теперь также отвергает short/placeholder/whitespace/reuse keys и malformed version, без печати значений; examples различаются и намеренно не deployable. Проверки через синтетический overlay.
- До12 deploy делал stop API → migrate без backup, а upload не включал backup tool. Теперь `.github/workflows/deploy.yml` доставляет `infra/backup-database.sh`, запускает verified private snapshot после stop и до migrate; фактический remote shell block проверяется с command doubles, включая failed backup.
- `infra/backup-database.sh`: matching pg tools внутри postgres service, полный DB custom format, full parse/decompress без исполнения SQL, mode600/700, SHA-256 и POSIX link, не трактующий concurrent target-directory как output file. Failure/concurrent file+directory/symlink scenarios — `infra/test/database-backup.test.mjs`.
- Локальные pg_dump/pg_restore/PostgreSQL доступны версии15.12; production Compose объявляет17-alpine. Real data round trip выполнен на native15 с Docker-command adapter; это не production17/container/SSH E2E. Базовые свойства инструментов сверены с официальными [pg_dump17](https://www.postgresql.org/docs/17/app-pgdump.html) и [pg_restore17](https://www.postgresql.org/docs/17/app-pgrestore.html). Полные результаты — stage-12-report/verification stage-12.
- `apps/api/test/auth-backup.postgres.spec.ts`: реальный round-trip всех public rows/bytea/JSON и schema CHECK/FK/views/triggers, сохранность password/guest Order/REVOKED и reusable old-token после нового grant. Отрицательные проверки immutable acceptance/document hash/token uniqueness/orphan FK/ACTIVE без grant проходят. Executable discovery через PATH, process.env восстанавливается, обе уникальные DB и synthetic archive удаляются. Итог1/1 PASS;32 infra PASS.

## 21.10.2026 · Общая приёмка13

- Actual held-response browser подтвердил sensitive variables в pending MutationCache, хотя settled state уже очищался. Actual Next history содержала raw reset/OAuth/activation capability до clean navigation. Исходные и clearing артефакты — verification/stage-13/browser/before, after; точные7+3cases и исходники — browser/summary.json, stage-13-report.
- Pixel probe подтвердил2,85:1 white CTA, min2,55; min6,71:1 после auth-only dark text. Local target defects32px закрыты min44px; реальная associated label checkbox и круглая Close отдельно проверены. Полноценный accessibility аудит не заявляется — browser/a11y/route-checks.json и contrast-pixels.json.
- Первый свежий API batch1660 имел4fail из2test adapters. Обновлённые mocks/actual tagged SQL дали16/16 regression и1795 реально выполненных API PASS; список отдельных opt-in skips — backend/summary.json. Исторический baseline issue этапа2 закрыт; backend runtime не менялся.
- Docker-shaped standalone copy реально обслужила9HTTP routes/assets/PDF с privacy headers, без backend/external services; checks/limitations — verification/stage-13/standalone/checks.json. Browser actual Next+HTTP fixture и real Nest/PG проверены отдельно, не совместный production E2E.
- Все7legalPDF/102page renderings загрузились на320/1280, bytes совпали сpublic; это техническая проверка renderer, не юридическое согласование — browser/legal и stage-13-report.
