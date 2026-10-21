# Контракт подключаемого Auth

Актуальные сценарии — [password-flow.md](./password-flow.md): password login без кода, email-регистрация с кодом/паролем/повтором, guest activation по ссылке без кода и с сохранением заказов, Яндекс без локального пароля. Отдельного code login нет. Статус/точка продолжения только в progress.

Целевой API после всех уточнений: `withAuth(Component)` и `const { onAuth } = useAuth({ onSuccess, onError })`. Пользовательский порядок — [task.md](./task.md), серверные переходы — [design.md](./design.md), визуальные детали — [mockups.md](./mockups.md).

## 1. Ответственность

Любая feature, форма или компонент вызывает onAuth после своего действия. Auth подтверждает identity паролем без нового кода, регистрационным proof с новым credential draft, activation-link proof с draft либо Яндекс ID, собирает только недостающие контакты и согласия, завершает сессию и возвращает управление инициатору. Исходная mutation принадлежит бизнес-feature, не Auth.

При действующей сессии повторного кода нет. Если контакты/согласия готовы — immediate fresh success без UI. Если рекламы нет — общий шаг на каждом новом вызове; false разрешает текущий callback. При новом входе готовый аккаунт завершается сразу после пароля/provider result; если показаны контакты/согласия, ждём соответствующее «Продолжить».

## 2. Публичный API

Экспортировать через `features/auth/index.ts`: `withAuth`, `useAuth`, типы результата/ошибки и нужный route adapter. Внутренние формы, provider implementation и query/mutation wiring не становятся внешним API. Старый `AuthForm onAuthenticated` после миграции callers не остаётся вторым независимым public flow.

```ts
type AuthFailure = {
  code:
    | "cancelled"
    | "busy"
    | "authentication_failed"
    | "flow_expired"
    | "session_expired"
    | "state_unavailable"
    | "profile_incomplete"
    | "required_consent_missing"
    | "provider_unavailable";
};

type AuthOutcome =
  | { status: "success"; user: AuthUser }
  | { status: "error"; error: AuthFailure };

type AuthOptions<Payload> = {
  onSuccess?: (user: AuthUser, payload: Payload) => void | Promise<void>;
  onError?: (error: AuthFailure, payload: Payload) => void | Promise<void>;
};
```

`useAuth<Payload>(options)` возвращает `{ onAuth, isPending }`. Без payload работают `useAuth()` и `onAuth()`. При типизированном Payload вызов `onAuth(payload)` требует соответствующий тип; возвращает `Promise<AuthOutcome>`. Пользователь может продолжать через callback либо await, но не запускать ту же mutation обоими способами.

`withAuth(Component, options?)` сохраняет props. Options — статичный объект или pure-функция от props: source, серверно известный purpose и UX-prefill. Начальный email/name не являются доказанными identity/профилем. Не добавлять `autoAccept`, `requireAdvertising`, `skipServerCheck` или клиентский boolean «согласия уже есть».

Purpose выбирает серверно известный набор применимых документов/контактных требований. Backend бизнес-действия независимо проверяет свой профиль; browser configuration не ослабляет guard и не переключает operation на произвольный более слабый purpose.

```tsx
function BaseRequestForm() {
  const { mutate: send, isPending: isSending } = useSendRequest();
  const { onAuth, isPending: isAuthenticating } = useAuth<RequestValues>({
    onSuccess: (user, values) => send(toRequestInput(values, user)),
    onError: (error) => showAuthError(error),
  });

  return (
    <form onSubmit={form.handleSubmit((values) => void onAuth(values))}>
      <RequestFields />
      <Button disabled={isSending || isAuthenticating}>Отправить</Button>
    </form>
  );
}

export const RequestForm = withAuth(BaseRequestForm, {
  source: "contact_form",
  purpose: "site_auth",
});
```

Это пример orchestration для формы, которой нужен вход. Партнёрская заявка использует site_auth; source не меняет purpose и права. Контактная форма исключена из Auth: локальный чекбокс ПДн и публичная отправка с серверной проверкой boolean true. `useSendRequest` — mutation hook feature; `toRequestInput` — mapper в lib. Для защищённого сценария сервер получает actor из сессии, а не из callback DTO.

## 3. Момент success и отмена

- Каждый вызов получает flowId, scope/owner, known purpose и снимок payload. Callback принадлежит этому вызову, а не глобальному событию login.
- `onSuccess` только после успешного server completion и обновления session query; fresh user из ответа/refetch передаётся аргументом. Старый `useUser()` closure не является источником пользователя для продолжения.
- Готовый новый вход после пароля/Яндекса сразу завершает server completion; дополнительной кнопки нет. Выдача сессии остаётся решением сервера после gates, не клиентской проверкой количества шагов.
- Если показаны согласия, нажатие «Продолжить» передаёт выбранное решение; пустая реклама даёт success при обязательной части. Checkbox change сам не создаёт grant и не авторизует.
- Для уже авторизованного без рекламы открывается consent step без нового кода. Отмена такого шага не уничтожает старую сессию.
- Неверный email/code/телефон и исправимые временные ошибки показываются в текущей форме без terminal callback. Terminal failure/cancel/expiry вызывает onError только своему активному инициатору.
- Close/back/unmount очищают локальное продолжение; cancel отправляется серверу для pending flow. После unmount callback компонента не вызывается. Поздний server result не запускает действие другого/отменённого owner.
- Cancel до отправки final decision не создаёт consent/session. После отправки возможна гонка commit: не обещать откат уже принятого сервером факта; состояние выясняется по operation result, callback отменённого owner подавляется.
- Повторный onAuth при занятом host получает `busy` только своему owner, не открывает вложенную модалку и не ставит вторую mutation в очередь. Disabled trigger уменьшает double-click; значимые бизнес-операции имеют серверную защиту от повторов.
- Исправимое неизвестное completion проверяется тем же operation ID. Auth не создаёт новый grant/аккаунт при сетевом retry. Не произносить пользователю «согласие не сохранилось», если серверный исход неизвестен.
- Ошибка бизнес-mutation после onSuccess — ошибка бизнес-feature. Она не становится auth failure и не вызывает auth onError/повторный callback. Исключение continuation отклоняет onAuth promise как ошибка continuation без второго terminal auth callback.
- Raw exception/ответ провайдера/внутренние статусы не показываются в UI; typed error превращается в короткий понятный текст рядом с действием.

## 4. Frontend границы

Общая session read model — `entities/session`. Auth flow UI/provider/state/coordinator — `features/auth`. Рекламные настройки/withdraw UI могут жить в `features/email-advertising`; public read модели подписки — `entities/email-advertising`. Не создавать импорт-цикл Auth ↔ Advertising: общий host координирует public APIs, transport/константы не импортируют feature.

```text
features/auth/
  index.ts
  lib/auth-provider/
    auth.context.tsx
    auth-provider.tsx
    use-auth.ts
    with-auth.tsx
    index.ts
  lib/auth-flow-state.ts
  lib/auth-flow-coordinator.ts
  lib/to-profile-input.ts
  lib/to-consent-input.ts
  model/types.ts
  model/use-sign-in-with-password.ts
  model/use-update-registration-draft.ts
  model/use-exchange-order-activation.ts
  model/use-update-activation-credential.ts
  model/use-request-account-recovery.ts
  model/use-request-email-code.ts
  model/use-confirm-email-code.ts
  model/use-resend-email-code.ts
  model/use-update-flow-profile.ts
  model/use-complete-auth-flow.ts
  model/use-cancel-auth-flow.ts
  ui/auth-host.tsx
  ui/auth-dialog.tsx
  ui/login-step.tsx
  ui/registration-step.tsx
  ui/activation-step.tsx
  ui/recovery-step.tsx
  ui/email-step.tsx
  ui/code-step.tsx
  ui/profile-step.tsx
  ui/consents-step.tsx
  ui/provider-buttons.tsx
```

Имена проектные. Одна самостоятельная mutation — отдельный файл; UI state/provider — lib, server data/mutations — model. Provider подключать HOC по AGENTS, включая app host composition ниже Query/User providers; не расставлять ручные providers в каждой странице. Local withAuth scope не создаёт независимые одновременно открытые окна: один host/coordinator в пределах приложения.

Положение окна задаёт внешний host: центрировать Dialog/page container по горизонтали и вертикали; если форма выше доступного окна, разрешать прокрутку без обрезки верхних полей. AuthFlowView остаётся карточкой без привязки к viewport. Временный screenshot wrapper не является продуктовым layout.

Shared primitives не импортируют Auth. Обёртки размещаются на допустимом feature/widget/app уровне, внешние импорты через index. Страницы/route files только собирают experience, без query-driven orchestration. `shared/actions/auth` — только server transport, без toast/сценарных callbacks. Server hydration/query cache обновляются существующими helpers.

Внутренние формы — RHF + zod/resolvers, собственный FormProvider, без `useFormContext` потребителя. Нельзя вложить настоящий `<form>` в форму caller: Dialog portal и отдельный внутренний context. Caller RHF не размонтируется при auth/legal tab/retry; его введённые значения и ошибки сохраняются.

## 5. Server-driven flow

UI принимает discriminated union следующего шага:

```ts
type AuthFlowResult =
  | { status: "credentials_required"; login: LoginView }
  | { status: "registration_required"; registration: RegistrationView }
  | { status: "activation_required"; activation: ActivationView }
  | { status: "challenge_required"; challenge: EmailChallengeView }
  | { status: "profile_required"; profile: ContactProfileView }
  | { status: "consents_required"; form: ConsentFormView }
  | { status: "completing"; operationId: string }
  | { status: "completed"; user: AuthUser };
```

Это public presentation contract; в view нет raw capability/code/token. Cookie и безопасный proxy transport скрывают секреты от произвольного JS. UI не считает отсутствие формы признаком completed. Long-running completion допускает bounded loading/status query; это не дополнительный обязательный пользовательский экран.

При ready session onAuth проверяет fresh server view. После регистрационного proof, activation-link exchange и Яндекс adapter используются те же контакты/consent readiness. Email-code не является самостоятельным способом входа; password login никогда не возвращает challenge_required. При изменении email/account flow сбрасывает чужой draft choice/payload actor и повторяет серверную проверку. Session expiry во время flow не маскируется старым cache user.

## 6. Яндекс и route adapters

Яндекс открывается по явному клику в popup для component mode. Сохранность функции callback обеспечивается тем, что исходный компонент остаётся смонтированным; функция/полный payload не сериализуются в URL/storage. State/nonce/origin/source/flow binding и timeout/closed обрабатываются до сигнала успеха. Факт завершения перечитывается с сервера, postMessage не является identity proof.

После возврата: контакты недостающие → согласия недостающие → completion. Всё готово — completion сразу. Если popup заблокирован, показать retry и обычный email entry, сохранив исходную форму; не подменять на full-page redirect, который обещает пережить произвольный React callback.

Standalone `/auth` использует тот же pipeline с safe `next` redirect. Full-page provider adapter допустим для этого режима; после reload не исполняет тайно сохранённую бизнес-операцию. Order activation route обменивает действующую ссылку на ограниченный flow: activation_required с паролем/повтором → недостающие контакты → согласия → completion; без кода, прежнего прямого cookie и отдельного consent UI. Сохранить userId/заказы. Recovery возвращает общий ответ и отправляет activation либо reset по credential; после reset обычный password login. Действие токена не создаёт рекламного согласия. Q2 закрыт: exact default_email из server exchange принимается по прямому решению пользователя без нового кода.

## 7. Карта миграции

| Точка                                    | Что меняется                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Site `/auth`                             | Единый host: password login без OTP, signup с code/passwordConfirm, recovery и Яндекс; удалить заменённые tabs, сохранив методы    |
| Checkout auth для промокода              | Общий onAuth вместо локального isAuthDialogOpen/AuthForm; сохранить пересчёт промокода/суммы после fresh user                      |
| Contact form | RHF/zod → обязательный чекбокс ПДн → собственная mutation; public API проверяет true, Auth не вызывается |
| Partner application                      | Тот же контракт, организационные поля/honeypot/throttle/предметные условия сохраняются                                             |
| Сохранение/публикация и будущие callers  | Hook без RHF зависимости; права/предметные acceptance на backend своей операции                                                    |
| Guest checkout                           | Сохранить покупку без login и привязку заказов; activation-link adapter → password+confirm → общие gates; anonymous email не proof |
| Site activation/recovery/OAuth callbacks | Общий pipeline, без прежней прямой выдачи site session в обход contacts/consents                                                   |
| Affiliate `/auth/login` consumer         | Сохранить его отдельный действующий password scenario; это реальный другой consumer, а не legacy alias сайта                       |
| Admin/studio и прочие consumers          | Инвентаризация до удаления/изменения общих auth endpoints; незапрошенного перевода нет                                             |

На мигрированных business endpoints guard и обязательные факты проверяются независимо от HOC. Общие checkbox/DTO поля удаляются только после переноса назначения на сервер. Защита не достигается подстановкой `true` в mapper. Контактный email другой формы остаётся контактным полем, не рекламным recipient.

## 8. Приёмка контракта

- Кнопка без RHF и форма RHF одинаково вызывают onAuth; typed props/payload сохраняются.
- Все ветки password-flow, включая signup passwordConfirm, guest activation без кода/повторных контактов, восстановление и signup на guest email без второго User. Код готового аккаунта не превращается в login; пароль готового аккаунта не заменяется.
- Новый flow с незавершёнными contacts/consents не получает обычный JWT/guard access; ready flow заканчивается без лишнего клика.
- Все нужные факты читаются с сервера, prefill/checked/session cache не создают их.
- Exactly-one local terminal result/callback своего owner; double-click/busy/unmount/late provider event не дублируют действие.
- Отмена до final submit не создаёт grant; неизвестный результат и cancel/commit race восстанавливаются по server operation.
- Пустая реклама → success сейчас, повторный новый onAuth снова показывает шаг; revoke/новый device работает по серверу.
- OAuth origin/state/source/timeout/blocked/cancel/недостаточные provider claims; форма не теряется.
- Прямой API bypass без HOC, чужой actor/email/purpose, expired/replayed pending capability — отказ.
- Business error после success не вызывает auth retry/onError и не отправляет действие повторно.

Контактный серверный шаг возвращает известные name/phone, missingFields и profileRevision. При сборке AuthFlowView передавать initialProfile/missingFields; известные корректные поля readonly. Mutation useSaveProfileDraft сохраняет только Auth TTL draft. Ни owner callback, ни Users intent, ни session не запускаются на этом submit: дальнейшая граница — общий completion после согласий.

## Реализовано в этапе 6 · 21.10.2026

- `AuthRoot = withAuth(BaseAuthRoot)` подключён в AppProviders под Query/User providers. Локальный HOC задаёт scope-конфигурацию и переиспользует общий coordinator; второй host не создаётся. Без явного onAuth модуль не начинает flow.
- `useAuth<Payload>()` создаёт owner на экземпляр hook. Повтор своего запроса возвращает ту же Promise; другой owner получает busy. Payload/options захватываются при запуске, поздний результат отменённого/размонтированного owner не вызывает продолжение. Business callback error отклоняет Promise, не превращаясь в auth error.
- Перед onSuccess отменяется устаревший session query и публикуется completed user в существующий `sessionQuery` cache. Исходный RHF остаётся mounted; Dialog portal исключает вложенные form. После закрытия фокус возвращается исходному элементу, если он ещё существует; новый шаг начинается с верхней границы окна.
- `POST /auth/flow/start` проверяет существующую access cookie. Без пригодной сессии возвращает login; с ней создаёт ограниченный SESSION flow, привязанный к исходному actor/credential/authVersion и сроку JWT. Пароль и повторный код не запрашиваются. Ready session автоматически завершается без окна; недостающие gates показываются общими шагами. Отмена не удаляет прежний access cookie.
- Только completion может установить access cookie. Start/completion передают прежнюю cookie для проверки текущего actor; остальные pending actions её не передают и не принимают JWT. SESSION проверяется до и после координации; сменившийся аккаунт не получает чужой результат.
- Неизвестный completion переводит UI в восстановление той же операции. Editable решения скрываются, «Повторить» только читает resume; повторного complete с изменённым решением нет. Ограниченный polling не создаёт новый grant.
- Пароль/код отсутствуют в coordinator и persistent browser storage. Секретные mutation hooks используют gcTime=0 и reset после success/error; глобально mounted observer не удерживает raw input после запроса.
- Яндекс и token route adapters ещё не подключены (этап 7); миграция рабочих callers — этап 8. Исходные UI и действующие consumers удаляются при их переключении. Макеты/внешний browser fixture не являются fallback live-auth.

## Route и Яндекс adapters этапа 7 · 21.10.2026

- Public `AuthRoute` связывает standalone login/recovery/activation/resume с тем же coordinator/owner. `PasswordResetRoute` использует общий password UI/RHF, после reset предлагает обычный вход; сброс сам не выдаёт сессию/рекламу. Страницы/route files остаются сборкой и route binding.
- Activation/reset/OAuth callback захватывают секретный вход только в памяти и очищают URL. Activation и OAuth делают это перед первым server action: Next cookie-driven RSC refresh иначе возвращал старый query. Activation initialEntry не меняется при RSC без token; новая загрузка очищенного документа возобновляет сохранённую capability. До успешного exchange reload не доказывает владение/не создаёт согласия; исходная ссылка действительна до атомарного обмена.
- Яндекс не получает Artmate пароль/код. Новому exact default_email доверяем по принятой пользователем policy; прежняя Users verification связанного аккаунта сохраняет дату. State/S256 PKCE, TTL, browser/capability binding, одноразовый exchange и сохранённый результат. Callback не выдаёт JWT, не пишет User и не принимает произвольный redirect.
- Popup открывается синхронно по клику. Строгая COOP сохраняется: bound server polling продолжает работу без opener и BroadcastChannel. Сигналы только технические; postMessage дополнительно проверяет origin/source/attemptId. «Другой способ входа» отменяет ожидание и возвращает login с тем же owner/payload. Full-page fallback не теряет callback молча.
- Token surfaces не запускают GA/Метрику. Proxy marker перезаписывается сервером, root gate действует до scripts; known sensitive links открывают документ целиком, pageview transport дополнительно пропускает эти paths. Next/Caddy выставляют no-store/no-referrer, query secrets редактируются в runtime logs.
- Старые recovery/activation UI и четыре заменённых HTTP endpoints удалены. Старый checkout AuthForm/password/signup/email-confirm transport пока имеет реального consumer и переносится в этапе 8; affiliate/admin методы не удалялись. Email registration sign_up идёт после общего completed session только для подтверждённого registration origin, не для password/Yandex/activation/reset.


## Callers и независимая серверная защита этапа 8 · 21.10.2026

- Partner обёрнут в `withAuth`: RHF validation → frozen DTO → `onAuth` → собственная mutation. UI-state и orchestration — в lib, mutations — в model, transport — в shared/actions. Contact использует тот же принцип разделения слоёв, но без Auth и access cookie: обязательный чекбокс ПДн и публичный API.
- Checkout и cart используют общий host вместо собственного AuthForm и перехода на отдельную страницу. Promo continuation захватывает cartId/signature/code; ждёт публикацию exact fresh account и запускает новый server preview. Смена cart/code/account, отмена или размонтирование аннулируют продолжение. Loyalty открывает тот же вход; гостевой заказ сохраняет собственные оферту/ПДн и не требует onAuth.
- `publishAuthSession` отменяет старые session/personalized запросы, очищает achievement/orders/workshop/loyalty/banner/welcome caches, публикует fresh user до callback и инвалидирует pricing. Корзина, promo draft и формы сохраняются.
- `SiteActionGuard` проверяет access JWT, актуальные directory actor/email/authVersion/profile и реальный acceptance текущего common site_auth документа. Optional advertising не является условием бизнес-действия. DTO не принимает actor/purpose/action/старые booleans. Reply/contact email может отличаться от actor и не становится рекламным recipient.
- Partner сохраняет authenticatedUserId и FK на неизменяемый requiredConsentAcceptance. Исторический boolean остаётся только историей без backfill; новые заявки используют настоящий факт. Contact notification содержит контактный email и отметку ПДн; владение адресом не утверждается, actor и acceptanceId аккаунта не создаются. Ни один бизнес-сервис не выдаёт согласие или сессию.
- Старые site AuthForm/login/register/verification state/actions/hooks/DTO и OAuth landing удалены после переключения consumers. Callback Яндекса и credential/password services с реальными consumers сохранены. Customer legacy endpoints удалены; affiliate перенесён на role-bound /auth/affiliate/login; admin login сохранён.

Подробности и результаты — stage-8-report. Этап 9 выполнен ниже; следующая реализация — 12 только по отдельному поручению.

## Реализация этапа 9 · настройки и отписка

`features/email-subscription-settings` — самостоятельный consumer public `withAuth/useAuth`, source `notification_settings`. UI/действия и реакции в feature; UI-state/owner guards — lib, отдельная revoke mutation — model. `entities/email-subscription` — read-only query/hook с owner-keyed key, staleTime 0/focus refresh и version fence. `_pages/account-settings` только собирает карточки. Server actions в `shared/actions/consents` проверяют fresh session owner и передают HTTP; backend actor/email не берутся из клиента.

Subscribe после onAuth перечитывает реальный state: unchecked advertising не включает подписку. Direct revoke не открывает Auth и не требует legal registry, профиля или grant secret. Смена пользователя/logout очищает новый private cache вместе с существующими caches; cancelled/late read/revoke не перезаписывает состояние другого owner.

`app/unsubscribe/page.tsx` только metadata/searchParams binding → `_pages/email-unsubscribe` composition → feature UI/lib/model. Query capability удерживается только в mounted memory, снимается с URL и Next history; model вызывает mutation без variables, token не оказывается в QueryClient. Public server action не пересылает cookies, использует обычный CSRF и optional shared request evidence proxy. RFC receiver остаётся backend HTTP boundary. Общий `isSensitivePath` заменяет auth-only название для proxy/analytics/Link; `RequestEvidenceProxyHeaders` и `TrustedProxyEvidence` — shared инфраструктура, Auth сохраняет собственную обязательную secret policy.

Отчёт и границы QA — [stage-9-report.md](./stage-9-report.md). Следующая реализация — этап 12 только по отдельному поручению; 10/11 отложены.
