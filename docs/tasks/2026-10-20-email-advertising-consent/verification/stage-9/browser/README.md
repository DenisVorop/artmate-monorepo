# Stage9 browser verification

Финальный результат: **13/13 сценариев PASS** на actual Next production build. Console/page errors0, unexpected request failures0, new-control target failures0. Из953 запросов139 отменены при ожидаемой навигации/закрытии context;24 внешних запроса перехвачены до отправки.

Маршруты `/account/settings`, `/unsubscribe`; светлая тема;320×844 и390×844 с touch/mobile emulation,1280×900 desktop. Продуктовый код этим QA-агентом на этапе9 не менялся. Только внешние `/tmp` fixture/driver/evidence.

## Что проверено

- Публичная ссылка: GET не отписывает; явный POST, клавиатурный Enter, защита от double-click, success heading focus;400/неверный формат не показывают успех;500 сохраняет retry, повтор ссылки идемпотентен.
- Public server action не пересылает cookie/access другой открытой сессии; payload толькоtoken. В подписанном request evidence raw capability отсутствует.
- Реальный TanStack QueryCache/MutationCache: до/во время/после подтверждения capability отсутствует; у pending mutation variables отсутствуют, после завершения mutation удалена. localStorage/sessionStorage/history/referrer/dataLayer чистые. Необходимый explicit POST body содержит capability.
- `history.replaceState`+official router cleanup сохраняет capability только в mounted feature ref для одного подтверждения; actual RSC cleanup не сбрасывает UI. URL и Next history tree чистые; Back/Forward не восстанавливают capability и не делают POST.
- Sensitive response no-store/no-referrer/noindex; аналитические scripts отсутствуют даже при включённых fake analytics IDs и forged client sensitive marker. Public server-action Referer/next-url/router-tree capability не содержат.
- Settings: загрузка/error/retry; cancel восстанавливает focus и off;12 Tab остаются внутри dialog; unchecked ads+Continue остаётсяoff без ложного success; checked ads+Continue включает подписку, fresh read/reload подтверждаютon, source notification_settings. Дополнительного кода/пароля нет.
- Revoke:500 и subscribed:true response не показывают успех; pending не оптимистичный; acknowledged false и reload показываютoff. Пустой authenticated body.
- Cross-tab public unsubscribe обновляет settings при visibility refetch. Задержанный A revoke не затирает B owner subscription/cache и не показывает A feedback.
- New controls>=44px effective hit area,320/390/1280 без горизонтального overflow и nested forms. Финальные screenshots визуально просмотрены; стабильная320px legal-link capture отдельно.

## Два найденных дефекта исправлены root и перепроверены

1. Capability оставалась в `history.state.__PRIVATE_NEXTJS_INTERNALS_TREE` при уже чистой видимой строке. До/после: `privacy-history-before-320.json`, `history-before-paths.json` → `privacy-unsubscribe-before/pending/after-320.json`, `privacy-unsubscribe-after-back/forward.json`.
2. Standalone legal link имела20px высоту. До/после: `targets-settings-link-before-320.json` → `targets-settings-off-320.json` (216.45×44px, effective44 true), `visual-clearing-320.json`, `settings-off-clearing-320.png`.

Подробные verification blocks: `findings-cleared.json`.

## Артефакты

- `summary.json` — краткий итог и ограничения.
- `route-checks.json` —13 результатов, target metrics, all console/network observations.
- `browser-final.log` — финальный clean result.
- `privacy-*.json`, `targets-*.json`, `*.png` — измерения и captures.
- `harness-notes.md` — отдельные исправленные ошибки/ограничения QA fixture; промежуточные `failure.*` не являются финальным результатом.
- `verify.cjs`, `fake-api.cjs` — внешний одноразовый harness; в app ничего не добавлено.
- `cleanup.json` — собственные Next62331/fakeAPI62332 остановлены; lsof пустой; Chrome закрыт.

## Ограничения

Только local fakeAPI и синтетические cookie/data. Реальные Яндекс/SMTP/payments/working DB/SSH не использовались. Cross-tab — настоящая вторая вкладка, но window visibility event подаётся вручную, потому что headless bringToFront не гарантирует lifecycle event. Account-switch — synthetic HTTP-only cookie + fresh session publication в настоящий QueryClient: Next сериализует server actions за held revoke, поэтому одновременный session-action refetch не используется. Это проверка late-result owner guard, не полный login второго аккаунта.

Не запускались axe (пакет отсутствует), performance/layout-shift attribution (локальная latency нерепрезентативна), pixel-delta focus-ring, dark/RTL/pseudo-locale и полный sitewide target audit. Проверка targets ограничена новыми feature controls; существующие profile/Telegram/header/footer вне scope.
