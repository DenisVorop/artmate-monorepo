# Этап 6 — подключаемый модуль авторизации

Выполнен в ветке `codex/email-advertising-consent`, worktree `/Users/denis.voropayev/.codex/worktrees/email-advertising-consent/artmate-monorepo`. Публичные `withAuth/useAuth` связаны с общим host, действующими серверными шагами и session cache. Реальные страницы/формы ещё не переключены: route/Яндекс — этап 7, callers/guards — этап 8. Коммита и выпуска нет.

## Публичный контракт

```tsx
function BaseSaveButton({ itemId }: { itemId: string }) {
  const { mutateAsync: save } = useSaveItem(); // mutation своей feature
  const { onAuth, isPending } = useAuth<{ itemId: string }>({
    onSuccess: async (_user, payload) => {
      await save(payload);
    },
  });

  return (
    <Button disabled={isPending} onClick={() => void onAuth({ itemId })}>
      Сохранить
    </Button>
  );
}

export const SaveButton = withAuth(BaseSaveButton, {
  source: "item_save",
  purpose: "site_auth",
});
```

Это пример подключения, не добавленная тестовая кнопка в продукт. `useSaveItem` и обработка его ошибок принадлежат вызывающей feature. Payload типизирован; без payload допустимы `useAuth()` и `onAuth()`. HOC сохраняет props и допускает конфигурацию как pure-функцию props. `onAuth` возвращает `Promise<AuthOutcome>`; business continuation error отклоняет её и обрабатывается инициатором. Не следует запускать одну business mutation одновременно через callback и через await-result.

Пока поддерживается серверный purpose `site_auth`; дополнительные business purposes и независимые API guards входят в этап 8. `source` опционален и не предоставляет прав.

## Поведение

- Один coordinator и один Dialog portal на приложение. Вложенные `withAuth` задают локальную конфигурацию и используют тот же host. `AuthRoot` подключён через HOC ниже Query/User providers; без явного `onAuth` ничего не открывает.
- Owner, payload и callbacks фиксируются на запуске. Двойной вызов того же owner возвращает ту же Promise; другой инициатор получает `busy`. Caller RHF остаётся mounted, внутренний form находится в portal, вложенных HTML form нет.
- После server completion сначала отменяется устаревший session query и публикуется свежий user в общий cache, затем вызывается callback исходного owner. Ошибка business callback не запускает auth retry и не вызывает auth onError.
- Отмена и unmount подавляют позднее продолжение. Пока незавершённый запрос может изменить cookies, coordinator завершает его обработку/cancel перед следующим owner. Поздний ответ не исполняет действие другой формы.
- Действующая сессия проходит SESSION continuation без пароля и кода. Если контакты и согласия готовы, окно не открывается. Если чего-то не хватает, используются общие шаги. Отмена сохраняет прежнюю сессию. Вход по паролю не требует повторного подтверждения почты.
- Регистрация использует прежние серверные code → данные/password/passwordConfirm → consents → completion. Контактные/activation/recovery presentation-состояния собраны в том же host; входящие token routes подключаются в этапе 7. Яндекс adapter пока не подключён.
- Реклама по умолчанию выключена, ПДн включены. Реклама false не создаёт grant/revoke и не мешает завершению текущего действия при принятой обязательной части; новый самостоятельный onAuth снова покажет шаг без рекламы. Checkbox change сам ничего не сохраняет.
- Неизвестный результат completion восстанавливается по той же операции: bounded polling, затем «Повторить» только для resume. Editable решения скрываются; повторного complete с другим решением нет.
- Фокус удерживается внутри окна и после закрытия возвращается исходной кнопке, если она ещё существует. При смене шага сбрасывается прокрутка; длинная мобильная форма прокручивается внутри окна без горизонтального переполнения. Правовые ссылки используют существующие страницы документов.

## Архитектура и безопасность данных

Frontend: transient coordinator/provider/UI-state и чистые mappers находятся в `features/auth/lib`; отдельные mutation hooks — в `model`; `shared/actions/auth` — только server transport; `entities/session` — существующая общая read model/cache. UI отвечает за RHF/разметку/ошибки. Страницы и shared primitives не получают orchestration. Public API экспортируется через index; обязательная структура provider/HOC соблюдена.

Пароли и коды не помещаются в coordinator или persistent browser storage. Глобально mounted MutationObserver раньше мог удерживать raw variables после запроса. Для четырёх секретных mutations добавлены `gcTime: 0` и `reset()` в finally; success/error callbacks сохранены. Это удаляет ссылку на завершившийся input из observer/cache, а не обещает физическое стирание памяти браузера.

Backend: `POST /auth/flow/start` использует существующую Auth session validation. Без пригодной access cookie возвращает login; с ней создаёт ограниченный browser-bound SESSION flow. Он связан с исходным actor/credential/authVersion и живёт не дольше исходного JWT/15 минут. Подтверждение почты переиспользует настоящую прежнюю дату Users publication. Нового OTP, backfill User или фиктивного подтверждения нет.

SESSION binding проверяется до и после completion. Смена текущего аккаунта, пароля/authVersion или истёкшая сессия не позволяют получить чужой результат. JWT выдаётся существующим AuthService только после общих receipts/gates. Auth не пишет напрямую профиль Users, permission Consents или заказы Orders.

Start/completion передают прежнюю access cookie только для проверки текущей сессии/actor. Только успешный `COMPLETED` completion transport устанавливает access cookie; start её не устанавливает. Остальные pending actions не передают access token и не принимают JWT.

Новая миграция `20261020230000_session_continuation_binding` добавляет immutable binding snapshot и SESSION constraint. Она не меняет пользователей/пароли/согласия, не хранит JWT или raw credential. Подготовлена и проверена в изолированной БД; к рабочей БД не применялась. Новых env-переменных и зависимостей в этапе 6 нет.

## Проверки

| Проверка | Результат |
| --- | --- |
| Native PostgreSQL + HTTP, настоящие Nest/Prisma/validation/CSRF | 95/95, включая 15 новых SESSION случаев |
| Адресные API tests, 9 suites | 130/130, включая 32 SQL migration tests |
| Site tests | 476/476: 28 coordinator, 8 secret-mutation, 4 transport и прежние регрессии |
| Public API compile-only tests | typed payload, no-payload, props и конфигурация HOC проверены TypeScript |
| API/site check-types, lint, build | Passed |
| Backend test-types и scoped lint, Prisma validate | Passed |
| Изолированный browser fixture | 11/11, ширины 320/360/390/430/1280 px |
| diff check | Passed |

Browser fixture находится вне приложения в `/tmp`, компилирует настоящий UI/HOC/provider/coordinator и site Tailwind/fonts; подменяет только ответы server actions. Проверены RHF и отдельная кнопка с произвольным payload, неверный/верный пароль без OTP, signup passwordConfirm, ready session без Dialog, отмена действующей сессии, unmount/late result/новый owner, session cache до callback, восстановление потерянного ответа без повторной отправки решения. Фокус, portal/form boundaries, прокрутка и отсутствие горизонтального overflow проверены на мобильных и desktop размерах. Page errors и failed requests отсутствуют. Зафиксированные focus/scroll дефекты исправлены и повторно проверены.

Это component integration, не полный production route → Next action → API E2E: реальные callers ещё не переключены. Backend отдельно проверен настоящими HTTP/PostgreSQL тестами. Axe/WCAG audit, web vitals и production loading этим стендом не измеряются. Полный API suite не объявляется green: прежняя unrelated welcome-promocodes mock-проблема описана в stage-2-report.

Логи, browser measurements и screenshots: [verification/stage-6](./verification/stage-6/). Миграции тестировались только в изолированной схеме; собственный PostgreSQL и browser server остановлены, порты 62311/62322 свободны. Рабочие БД, production, SSH, SMTP и GitHub settings не использовались. Env delivery этапа 5 не менялся и повторно не выпускался.

## Точка продолжения

Следующий этап — 7: Яндекс и standalone/activation/recovery route adapters на общий pipeline. Затем 8 — переключение реальных callers/backend guards и удаление заменённых путей. Они не запускались автоматически. Test panels, preview routes и mock-auth adapters в приложение не добавлены.

Legal registry автоматически не публиковалась, реальные рекламные письма не отправлялись. Прежние J1/J2/J3/Q2 и этапы отписки/evidence/delivery/production остаются в плане; выполнение 6 не означает готовность рассылки или разрешение deploy. Все прежние незакоммиченные изменения сохранены, HEAD `c3e21a2f` не изменён.
