# Проверки этапа 8

Итог: 122 native PostgreSQL/HTTP, 132 targeted API, 546 site, 123 affiliate, 13 browser — passed. Types/lint/build/schema описаны в stage-8-report.md.

- `api-targeted-final.log` — финальный общий адресный backend прогон; backend-regression.log частично пересекается, числа не складывать.
- `backend-native-final.log` — настоящие Nest/Prisma/PostgreSQL сценарии; `backend-cleanup.log` — остановка PG62311.
- `backend-module-before.log` воспроизводит найденную ошибку Nest DI; `backend-module-final.log` — actual-module smoke после исправления. Финальная API build включает исправление.
- `site-tests-final.log` — весь frontend suite. `forms-guarded-final.log` — отдельные snapshot/cancel/errors/cookie/analytics проверки, входят в общий suite.
- `browser-README.md`, `browser-summary.json`, `browser-route-checks.json`, screenshots и driver/HTTP-fixture — фактический Next production build и внешняя локальная QA инфраструктура. В приложении demo кода нет.
- `browser-harness-diagnostics/` — промежуточные ошибки самого fixture/probe; это не итоговый product run. Финальный полный строгий прогон 13/13.
- `browser-cleanup.json` — остановка Next62325/fakeAPI62326. Внешние provider/SMTP/payment/production не использовались.

Full API suite не объявлен green; прежний baseline issue — stage-2-report.md. Никакие логи не доказывают production rollout или правовую публикацию registry.
