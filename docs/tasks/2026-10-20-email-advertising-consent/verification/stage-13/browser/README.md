# Общая browser-приёмка этапа13

**92/92 уникальных checks PASS** на одной финальной production-сборке Next (`final2`, `BUILD_ID=TGDY6zdSbzOLYKSLBP4ht`). Это новый прогон текущего кода, а не перенесённые результаты этапов7–9. Дополнительные32 checks повторены на той же сборке с общим console/network observer; в92 повтор не включён.

Console/page errors: **0**. Неожиданные request failures: **0**. Отдельно сохранены643 `net::ERR_ABORTED` при navigation/RSC/prefetch/context close, преимущественно запросы навигации `/cart`, `/catalog`, `/`, `/account` и legal. Четыре browser warnings относятся к попытке закрыть callback, открытый напрямую, а не script popup; реальные popup cases пройдены отдельно. Подробности — `console-network.json`.

## Сессия

- Реальные production routes, React components, RHF, withAuth/useAuth, coordinator, QueryClient, Dialog и server actions.
- Изолированный Google Chrome155.0.8059.85 через Playwright; light theme; основные widths320/390/1280, дополнительный activation viewport360. Mobile widths с touch/mobile emulation.
- Next62353 → отдельный внешний local HTTP fakeAPI62354. Синтетические пользователи/cookie/данные. Все чужие HTTP origins перехвачены до отправки. Реальных OAuth/SMTP/payments/analytics/working DB/SSH не было.
- Для popup case production Caddy COOP `same-origin` добавляется в локальные document responses; сохранение этой политики отдельно проверяет root. Остальные sensitive headers приходят из настоящего Next proxy.
- Product source этим QA-агентом не менялся. Harness, фикстуры и evidence только в `/tmp`; в приложение не добавлены панели, demo routes или mock adapters.

## Матрица

| Suite | Checks | Что подтверждено |
| --- | ---: | --- |
| routes |13| Пароль без OTP; ready SESSION; missing-consents cancel; activation missing-profile; invalid activation; reset valid/expired; recovery; Yandex lost-opener/BC-disabled bound polling; spoof ignored; blocked/closed popup |
| callers |13| Contact/partner validation, cancel preserves fields/DOM, source/UTM snapshot, password→consents→business, ready-session skip, business retry; cart/checkout promo fresh retry; loyalty cancel; guest order without auth |
| withdraw |13| Settings loading/error/retry/cancel/ads-false/grant/revoke ACK+retry/reload; second-tab change and late owner result; public GET no mutation, explicit POST/no-cookie, invalid/500/retry/idempotent/double-click; cache/history/headers/Back/Forward |
| supplemental |7| Wrong-password/no-session/no default code; Eye/EyeOff; signup wrong-code+resend+generation, passwordConfirm mismatch, registration, required ПДн vs optional ads; activation with existing contacts skips contacts/code |
| sensitive |3| Activation/reset/Yandex settled history/query/mutation/storage/referrer/analytics and action headers clean |
| pending |7| Password/code/registration/activation exchange/activation password/reset/Yandex held responses: initial/between/settled cache/history clean, pending variables absent, action headers clean |
| route-targets |14| Reset ready/success/invalid/error, activation error, auth cancel, Yandex fallback controls ≥44px at320/390; no overflow/nested forms |
| focus |1| Реальная keyboard focus-visible индикация Close:22.96% pixel delta, threshold2%; основной matrix также проверяет trap/restoration |
| a11y |7| Scoped axe on login/code/registration/consents/reset/public/settings:0violations; auth CTA independently measured6.71:1 contrast |
| legal |14|7 PDF×320/1280: все102 страницы rendered, непустой canvas/text layer, PDF200/type/bytes/SHA256 совпадают source files, download links, no overflow |

`runner-final2.log` — полный92-case run. `runner-telemetry.log` — повтор32 checks с новым observer. `runner-results.json` связывает оба запуска. В каждом suite `route-checks.json` содержит реальные измерения и результаты.

## Найдено и исправлено root, затем перепроверено

1. Password/code/reset/Yandex секреты находились в `mutation.variables` во время pending, хотя после завершения очищались. Теперь все7 sensitive hooks проверены с held HTTP: serializable cache не содержит секретов, pending variables отсутствуют.
2. Чистый visible URL ещё оставлял capability в Next persistent history: reset после успеха, Yandex и activation при held response. Финальные probes подтверждают clean history до/between/после; activation/Yandex exchange ждёт чистую router navigation, исходный mounted capability остаётся доступен только для своей операции. Явный POST и success UI продолжают работать.
3. CodeStep «Изменить почту» и reset/route/callback fallback CTA имели32px высоту. Финальные target probes подтверждают≥44px.
4. Белый auth CTA text на градиенте имел около2.85:1 contrast в области надписи. После auth-only изменения цвет текста подтверждён вычислением и пикселями: минимум6.71:1 при пороге4.5. Глобальный shared дизайн не менялся этим агентом.

До: `before/`. Финальные clearing snapshots: `after/`. Структурированный отчёт — `findings-cleared.json`. Исходные before evidence сохранены; промежуточные `failure.*`/старые logs не являются финальным результатом.

## Подтверждённые исключения и ограничения

- Close44×44 имеет круглые углы: corner hit-test попадает в header, центр работает настоящим кликом на3 widths. Это не перекрытие кнопки.
- Визуальные checkbox20px имеют связанную label с проверенной44×44 patch: hit-test исключает вложенные legal links, настоящий клик меняет checkbox. Radix native inputs с opacity0 исключены из видимых targets. Диагностика — `supplemental/targets-consents-*.json`.
- Axe не умеет подтвердить contrast поверх gradients:5 states имеют `color-contrast` incomplete; auth CTA проверена отдельно. Прозрачный input-otp с отображаемыми слотами также остаётся manual-review incomplete. Это не полный WCAG pass.
- Cross-tab использует настоящую вторую вкладку и controlled window visibilitychange event. Для late-owner case synthetic HTTP-only cookie и свежая fake session опубликованы в настоящий QueryClient: Next сериализует server actions за held revoke. Это не полный browser login второго аккаунта.
- Backend hashes, TTL/replay, DB ownership/order preservation и transaction races проверяются отдельными root native tests; HTTP fixture не доказывает их повторно.
- Performance/CLS/Web Vitals, полный sitewide targets/contrast audit, dark/RTL/pseudo-locale, paste/IME и real-device pinch zoom здесь не измерены.
- PDF проверены технически: actual rendered canvases всех страниц, реальные viewer captures и source byte hashes. Все102 page captures просмотрены в contact sheets; отдельно просмотрены full-size образцы. Юридическое утверждение редакций, актуальность содержания законам и разрешение на публикацию из этого не следуют.
- Этапы10/11, настоящая рекламная доставка и production rollout не проверялись и не выполнялись.

## Визуальные артефакты

- `a11y/login-390.png` — финальная форма и контраст CTA.
- `supplemental/registration-320.png`, `supplemental/pdn-validation-390.png` — регистрация и согласия.
- `routes/yandex-consents-390.png` — общий gate после Яндекса.
- `withdraw/unsubscribe-ready-320.png`, `withdraw/settings-off-390.png` — отписка/настройки.
- `legal/viewer-advertising-consent-320-first.png` — реальный mobile viewer.
- `legal/contact-sheet-{320,1280}-{1,2,3}.jpg` — все страницы документов; отдельные PNG получены из реально отрисованного canvas, чтобы sticky header/viewport clipping не попадали в page capture.

Все собственные Next/fakeAPI/Chrome завершены;62353/62354 свободны. `cleanup.json` содержит финальную проверку. Порты/процессы других агентов не затрагивались.
