# Проверки этапа 9 · 21.10.2026

Итог — PASS в разрешённом локальном объёме. Основной отчёт — [stage-9-report.md](../../stage-9-report.md).

- `api-native-postgres.log` — 134 настоящих Nest HTTP/Prisma/PostgreSQL cases. Схема изолирована, working DB/SSH не использовались.
- `api-targeted.log` — 141 целевая API regression/protocol/SQL/unit проверка. Включает 9 новых token/evidence/migration tests и module wiring; отдельные логи не суммировать повторно. Не full API suite: исторический baseline welcome-promocodes mock issue — stage-2-report.
- `api-module-wiring.log` — настоящий Nest DI graph, без внешней рабочей DB/init/listen.
- `site-tests-final.log` — полный site suite 573/573 (18 новых settings + 9 unsubscribe). `settings-*.log` и `unsubscribe-behavior-final.log` — адресные подмножества, не дополнительные tests.
- `*-types*.log`, `*-lint*.log`, `*-build*.log`, `prisma-validate.log` — итоговые code checks. Финальный site build содержит privacy history и min44px fixes.
- `browser/README.md`, `summary.json`, `route-checks.json`, `verify.cjs` и `fake-api.cjs` — 13 строгих actual Next production browser cases; внешний локальный fixture вместо настоящего API/SSO/SMTP. Эти файлы не product runtime.
- `browser/privacy-history-before-320.json`, `history-before-paths.json`, `targets-settings-link-before-320.json` — сохранённые реальные finding evidence до исправлений. `findings-cleared.json` и остальные final privacy/target JSON — clearing на новой сборке. `harness-notes.md` отличает исправления driver от product defects.
- `browser/*-{320,390,1280}.png` — финальные screenshots новых settings/public unsubscribe поверх настоящего site build. Target scope — новые feature controls; full-site accessibility/performance audit не заявлен.
- `caddy-*.log`, `caddy-checks.json`, `caddy-probe.py` и `caddy-probe.Caddyfile` — полный config validate и реальные loopback HTTP200/502 headers/log-redaction, strict COOP unchanged. Использован ранее checksum-verified official Caddy2.11.7, без production запросов.
- `backend-cleanup.log`, `browser/cleanup.json`, `root-cleanup.json` — собственные процессы остановлены, listener checks. Новые сервисы не оставлены работать.

Browser ожидаемые navigation/context ERR_ABORTED отдельно перечислены в JSON; unexpected failures0. Headless cross-tab focus требует injected window visibility event после реального второго tab. Late-owner case меняет synthetic HttpOnly cookie и публикует fresh session B в actual QueryClient перед release held revoke A — не real SSO. Axe/performance/pixel focus delta/full-site targets не проверялись. Внешние requests перехватывались до отправки; настоящие provider/analytics/mail/payment не вызваны.

Тестовые адреса/токены/actor IDs синтетические. Token нужен только для initial document и явного POST body; отсутствие в history/storage/query+mutation/cache/header измерено. Исходящие headers/DKIM/queue/SMTP и архив/экспорт/retention отложены с этапами10/11. Миграции к рабочей БД не применялись. Git commit/push/deploy не выполнялись.
