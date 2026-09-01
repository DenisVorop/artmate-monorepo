# Аналитика `apps/site`

Инструкции для агентов, которые добавляют или изменяют аналитику Artmate. Перед работой также прочитайте корневой [`AGENTS.md`](../../../../../../AGENTS.md).

## Архитектурный паттерн

Аналитика следует проверенному паттерну `msb-loans-v2-frontend`, адаптированному к требованиям Artmate:

```text
shared/lib/analytics/create-analytics
  → feature-local lib/analytics.ts
  → useAnalytics() при наличии feature/session context
  → подтверждённая business success-точка
```

- `shared/lib/analytics` содержит только transport, общие типы, sanitization, ecommerce mapper и дедупликацию. Этот слой не импортирует `entities`, `features`, `_pages` или `widgets`.
- Каждая feature объявляет собственный registry builders в `features/<feature>/lib/analytics.ts`. Здесь доменная модель преобразуется в разрешённый обезличенный payload.
- UI и mutation hooks вызывают семантические методы feature и не собирают `dataLayer` payload вручную.
- Если analytics callbacks замыкают данные feature/session, вызывающий код использует объект без деструктуризации:

```ts
const analytics = useAnalytics();
analytics.orderCreated(order);
```

- Прямые обращения к `window.dataLayer`, `window.ym`, counter ID и `reachGoal` вне shared transport запрещены.

Известное legacy-исключение — `features/partner-application/lib/analytics.ts`. Не используйте его как образец и не добавляйте новые прямые вызовы. При следующем содержательном изменении партнёрской аналитики перенесите её transport в shared-слой, сохранив действующие event IDs и consent-поведение.

## Источник события

Конверсия отправляется после подтверждённого бизнес-результата, а не по намерению пользователя:

- mutation — только в `onSuccess` после валидного server response;
- cart mutations сериализуются в одном mutation scope; снимок cache читается
  непосредственно перед фактическим запросом, а дельта считается по нему и итоговой
  корзине из `onSuccess`; requested quantity не заменяет server result;
- `undefined` pre-mutation snapshot означает неизвестное состояние, а не пустую
  корзину: если точную дельту доказать нельзя, событие пропускается;
- полная очистка корзины отправляет один ecommerce `remove` со всеми фактически
  удалёнными позициями, без отдельной цели Метрики;
- page view сущности — только после успешной client-загрузки и прохождения error/404 guards;
- `begin_checkout` — только после свежего успешного чтения непустой корзины; stale cache
  во время refetch, loading/error и empty cart не являются входом в checkout;
- `order_created` — первым действием после ответа create-order и до cache cleanup/payment redirect;
- `order_paid` и ecommerce `purchase` — только по свежему полному `OrderDTO` с
  `order.payment.status === "paid"`; paid из status polling сначала только инвалидирует
  detail query и не является достаточным purchase snapshot;
- промокод — только после свежего успешного server preview, инициированного ручным
  apply или retry; cached/in-flight preview до клика не подтверждает конверсию, поэтому
  попытка запускает собственный exact fetch и перед отправкой сверяет текущие account,
  cart signature, cart ID и code;
- welcome `promoView` — только после committed состояния `presented` с активным offer;
  `promoClick` и `welcome_promo_click` — только на основном CTA, а close и «Не сейчас»
  событий не создают;
- регистрация — только в configured `onSuccess` успешного `confirmEmailVerification`,
  если ответ содержит `session.user` и flow начат успешным `register`; login→resend,
  password reset и OAuth не создают `sign_up`; registration origin сохраняется при resend
  и сбрасывается при выходе назад из verification flow;
- цифровой каталог, тематика и картина — только после успешной client-загрузки реальной
  сущности и прохождения loading/error/404 guards; переход со страницы товара считается
  отдельным diagnostic click и отправляется только с CTA цифровой версии;
- disabled, out-of-stock, pending, failed, redirect и 404 не являются конверсией.

Не отправляйте client analytics из server actions, metadata builders или RSC data builders: один route может прочитать данные несколько раз, а crawlers и 404 создадут ложные события.

## Яндекс Метрика

- Существующий контейнер — только `window.dataLayer`; второй data layer не создаётся.
- Counter ID берётся из текущего `#yandex-metrika[data-counter-id]`; бизнес-код не хардкодит `109148727`.
- `ym(counterId, "reachGoal", eventId, params)` получает строковый `eventId`, никогда числовой `goalId`.
- Разрешённые goal event IDs:
  - `product_view`;
  - `add_to_cart`;
  - `begin_checkout`;
  - `promo_apply_success`;
  - `welcome_promo_click`;
  - `sign_up`;
  - `digital_versions_opened`;
  - `digital_coloring_open`;
  - `order_created`;
  - `order_paid`.
- CRM-цели заказа остаются серверным/offline источником истины. Не вызывайте их числовые ID из браузера.

## Ecommerce

Используйте официальный формат Яндекс Метрики:

- `currencyCode: "RUB"` находится в объекте `ecommerce`;
- `click`, `detail`, `add`, `remove` передают `products`;
- `promoView`, `promoClick` передают `promotions`;
- `purchase` передаёт `actionField` и `products`;
- товар проходит через единый mapper: непустые `id`/`name`, цена в рублях, optional `category`, положительное целое `quantity`;
- `undefined`, `NaN`, infinite и отрицательные цены не отправляются;
- revenue заказа равен `subtotal - discount`, без `deliveryPrice`;
- `coupon` берётся только из подтверждённого ответа заказа.

## Конфиденциальность

В analytics payload, URL, referrer и UTM запрещены:

- email, телефон, имя, адрес;
- user ID и содержимое Telegram user payload;
- access/refresh token, auth/hash, password, verification code;
- `tgWebAppData` и остальные Telegram auth query params.

Payload строится по allowlisted типизированному контракту и дополнительно очищается в runtime. Никогда не передавайте форму или DTO целиком в generic event.

URL и referrer перед отправкой проходят через `sanitizeAnalyticsUrl`. Sanitization не должна менять URL приложения или ломать auth flow.

## Дедупликация

Дедупликация включается осознанно и всегда привязана к событию и сущности:

- view event — в рамках соответствующего lifecycle/посещения;
- `begin_checkout` — в рамках конкретного checkout attempt;
- `promo_apply_success` — memory key конкретной ручной попытки; новая ручная попытка
  или retry получает новый key, а смена account/cart context аннулирует старую;
- welcome `promoView`/`promoClick`/goal — session key по безопасной кампании и
  московскому дню, в соответствии с sessionStorage lifecycle показа;
- `sign_up` — memory key непрозрачной технической попытки регистрации; одна попытка
  сохраняется через resend и повторный success callback, новая регистрация получает
  новый key; email, verification code и user ID не входят ни в payload, ни в key;
- открытия цифрового каталога, тематики и картины — memory key конкретного mount/view;
  Strict Mode и повтор effect не дублируют показ, новый реальный вход создаёт новый key;
- `order_created` — session key по уникальному `orderId`, но не по `cartId`;
- `order_paid` и `purchase` — persistent key по `orderId`;
- polling и React Strict Mode не должны создавать дубли;
- одинаковые реальные повторные `add`/`remove` не дедуплицируются глобально;
- goal и ecommerce action имеют разные namespaces, чтобы парные `order_paid` и `purchase` не блокировали друг друга.
- `entityKey` содержит только публичный/технический ID товара, корзины, заказа или показа; email, телефон, имя, токен и другие персональные данные запрещены даже для ключей в browser storage.
- Значение промокода и account/user ID не входят ни в promo payload, ни в promo dedupe key.

Не используйте один глобальный boolean или вечный ключ только по `eventId`.

## Feature-local adapter

Ожидаемая форма:

```ts
const analytics = createAnalytics({
  orderCreated: (order: Order) => [
    /* typed goal command */
  ],
});

export function useAnalytics() {
  return {
    orderCreated: (order: Order) => analytics.send("orderCreated", order),
  };
}
```

Builder находится рядом с feature и отвечает за минимальный безопасный payload. Shared transport не должен знать тип `Order`, `Product`, `Cart` или другие entity types.

## Проверки

При изменении analytics обязательно проверить:

- SSR/no-window и отключённый/не загруженный счётчик;
- точную форму `dataLayer.push` и `reachGoal`;
- ecommerce payload;
- фильтрацию PII и невалидных чисел;
- выбранную дедупликацию;
- success и error paths изменённой feature;
- `pending`/`failed` не создают paid/purchase;
- `yarn workspace site test` либо релевантный targeted test;
- `yarn workspace site check-types`;
- `yarn workspace site lint`;
- `yarn workspace site build`, если изменены route boundaries, initialization или hydration.

Не ослабляйте типы и не заменяйте behavioral tests одной проверкой исходного текста, если код можно выполнить с fake window/storage.
